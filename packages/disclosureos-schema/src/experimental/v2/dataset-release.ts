import { z } from "zod";
import {
  compareUtcInstants,
  parseExperimentalClaimHistory,
} from "@disclosureos/records/experimental/v2";
import { parseAcquisitionContext } from "@disclosureos/instruments/experimental/v2";
import type { AcquisitionContext } from "@disclosureos/instruments/experimental/v2";
import {
  ReproductionPacketSchema,
  evaluateReproductionPacket,
} from "./reproduction-packet";
import type { ReproductionPacketResult } from "./reproduction-packet";
const text = z.string().min(1).regex(/\S/),
  id = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]*(?![\s\S])/);
const ref = (kind: string) =>
  z
    .string()
    .regex(new RegExp(`^${kind}:[A-Za-z0-9][A-Za-z0-9._-]*(?![\\s\\S])`));
const unknown = z.strictObject({ state: z.literal("unknown"), reason: text });
export const DATASET_RELEASE_SCHEMA_ID =
  "urn:disclosureos:experimental:dataset-release:0.1.0";
export const DATASET_RELEASE_PROFILE = Object.freeze({
  id: "urn:disclosureos:experimental:profile:dataset-release",
  version: "0.1.0",
  scope: "pinned_packets_and_nominal_session_membership",
} as const);
export const DatasetReleaseSchema = z.strictObject({
  kind: z.literal("dataset_release"),
  schemaVersion: z.literal("0.1.0"),
  id,
  version: text,
  title: text,
  description: text,
  createdAt: text,
  access: z.enum(["public", "restricted", "unknown"]),
  license: z.union([
    unknown,
    z.strictObject({ state: z.literal("declared"), identifier: text }),
  ]),
  packets: z
    .array(
      z.strictObject({
        id,
        packetId: id,
        sha256: z.string().regex(/^[a-f0-9]{64}(?![\s\S])/),
        byteLength: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
      })
    )
    .min(1),
  sessions: z
    .array(
      z.strictObject({
        id,
        title: text,
        time: z.union([
          unknown,
          z.strictObject({
            state: z.literal("known"),
            start: text,
            end: text,
            timeScale: z.literal("UTC"),
          }),
        ]),
        members: z
          .array(
            z.strictObject({
              packetRef: ref("packet"),
              acquisitionRef: ref("acquisition"),
            })
          )
          .min(1),
      })
    )
    .min(1),
  extensions: z
    .record(
      z.string().regex(/^[a-z][a-z0-9_-]*(?:\.[a-z0-9_-]+)+(?![\s\S])/),
      z.json()
    )
    .optional(),
});
export type DatasetRelease = z.infer<typeof DatasetReleaseSchema>;
export function datasetReleaseJsonSchema(): Record<string, unknown> {
  return {
    ...z.toJSONSchema(DatasetReleaseSchema, { target: "draft-2020-12" }),
    $id: DATASET_RELEASE_SCHEMA_ID,
  };
}
export interface DatasetPacketInput {
  manifest: Uint8Array;
  files: ReadonlyMap<string, Uint8Array>;
}
type Status = "passed" | "failed" | "not_checked";
export interface DatasetIssue {
  code: string;
  pointer: string;
  message: string;
  stage: "structural" | "semantic" | "profile" | "external";
}
export interface DatasetReleaseResult {
  success: boolean;
  profile: typeof DATASET_RELEASE_PROFILE;
  contract: {
    schemaId: typeof DATASET_RELEASE_SCHEMA_ID;
    rulesetVersion: "0.1.0";
  };
  checks: {
    structural: Status;
    semantic: Status;
    profile: Status;
    external: Status;
  };
  release?: { id: string; version: string };
  issues: DatasetIssue[];
  packets: {
    packetRef: string;
    manifestStatus: Status;
    expectedSha256: string;
    expectedByteLength: number;
    actualSha256?: string;
    actualByteLength?: number;
    validation: ReproductionPacketResult | null;
  }[];
  sessions: {
    sessionRef: string;
    status: Status;
    members: {
      packetRef: string;
      acquisitionRef: string;
      classification?: string;
      status: Status;
    }[];
  }[];
  scientificEligibility: "not_checked";
  authorization: "not_checked";
  crossInstrumentIdentity: "not_checked";
}
const pointer = (path: readonly PropertyKey[]) =>
  path
    .map((p) => `/${String(p).replace(/~/g, "~0").replace(/\//g, "~1")}`)
    .join("");
const decode = (bytes: Uint8Array): unknown =>
  JSON.parse(
    new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes)
  ) as unknown;
/** Verifies exact packet manifests and explicit nominal session membership. Does not infer simultaneity or physical identity. */
export async function evaluateDatasetRelease(
  input: unknown,
  options: { packets?: ReadonlyMap<string, DatasetPacketInput> } = {}
): Promise<DatasetReleaseResult> {
  const parsed = DatasetReleaseSchema.safeParse(input);
  const result: DatasetReleaseResult = {
    success: false,
    profile: DATASET_RELEASE_PROFILE,
    contract: { schemaId: DATASET_RELEASE_SCHEMA_ID, rulesetVersion: "0.1.0" },
    checks: {
      structural: "passed",
      semantic: "not_checked",
      profile: "not_checked",
      external: "not_checked",
    },
    issues: [],
    packets: [],
    sessions: [],
    scientificEligibility: "not_checked",
    authorization: "not_checked",
    crossInstrumentIdentity: "not_checked",
  };
  const issue = (
    code: string,
    path: string,
    message: string,
    stage: DatasetIssue["stage"] = "semantic"
  ) => result.issues.push({ code, pointer: path, message, stage });
  if (!parsed.success) {
    result.checks.structural = "failed";
    for (const i of parsed.error.issues)
      issue("DATASET.STRUCTURE", pointer(i.path), i.message, "structural");
    return result;
  }
  const release = parsed.data;
  result.release = { id: release.id, version: release.version };
  if (compareUtcInstants(release.createdAt, release.createdAt) === undefined)
    issue(
      "DATASET.TIME",
      "/createdAt",
      "Release creation time must be a valid UTC instant."
    );
  const ids = new Set<string>(),
    packetIds = new Set<string>();
  for (const [i, p] of release.packets.entries()) {
    if (ids.has(p.id) || packetIds.has(p.packetId))
      issue(
        "DATASET.DUPLICATE",
        `/packets/${i}`,
        "Packet entry IDs and declared packet IDs must each be unique."
      );
    ids.add(p.id);
    packetIds.add(p.packetId);
  }
  const sessions = new Set<string>(),
    members = new Set<string>();
  for (const [i, s] of release.sessions.entries()) {
    if (sessions.has(s.id))
      issue(
        "DATASET.DUPLICATE",
        `/sessions/${i}/id`,
        "Session IDs must be unique."
      );
    sessions.add(s.id);
    if (
      s.time.state === "known" &&
      (compareUtcInstants(s.time.start, s.time.start) === undefined ||
        compareUtcInstants(s.time.end, s.time.end) === undefined ||
        compareUtcInstants(s.time.start, s.time.end) !== -1)
    )
      issue(
        "DATASET.TIME",
        `/sessions/${i}/time`,
        "Known sessions require a nonempty half-open UTC interval."
      );
    for (const [j, m] of s.members.entries()) {
      const key = `${m.packetRef}/${m.acquisitionRef}`;
      if (members.has(key))
        issue(
          "DATASET.DUPLICATE_MEMBERSHIP",
          `/sessions/${i}/members/${j}`,
          "A packet acquisition belongs to exactly one session."
        );
      members.add(key);
      if (!ids.has(m.packetRef.slice(7)))
        issue(
          "DATASET.PACKET_REFERENCE",
          `/sessions/${i}/members/${j}/packetRef`,
          "Packet is not inventoried."
        );
    }
  }
  if (result.issues.length) {
    result.checks.semantic = "failed";
    return result;
  }
  // Clone every packet and byte buffer before hashing any input.
  const packets = new Map(
    [...(options.packets ?? [])].map(([id, p]) => [
      id,
      {
        manifest: Uint8Array.from(p.manifest),
        files: new Map([...p.files].map(([id, b]) => [id, Uint8Array.from(b)])),
      },
    ])
  );
  const contexts = new Map<string, AcquisitionContext>();
  const contextPins = new Map<string, string>(),
    observationOwners = new Map<string, string>();
  for (const [i, entry] of release.packets.entries()) {
    const path = `/packets/${i}`,
      packetRef = `packet:${entry.id}`;
    const report: DatasetReleaseResult["packets"][number] = {
      packetRef,
      manifestStatus: "not_checked",
      expectedSha256: entry.sha256,
      expectedByteLength: entry.byteLength,
      validation: null,
    };
    result.packets.push(report);
    const supplied = packets.get(entry.id);
    if (!supplied) {
      issue(
        "DATASET.PACKET_UNAVAILABLE",
        path,
        "Pinned packet is not supplied.",
        "external"
      );
      continue;
    }
    report.actualByteLength = supplied.manifest.byteLength;
    if (report.actualByteLength !== entry.byteLength) {
      report.manifestStatus = "failed";
      issue(
        "DATASET.PACKET_SIZE",
        path,
        "Packet manifest length differs.",
        "external"
      );
      continue;
    }
    try {
      report.actualSha256 = [
        ...new Uint8Array(
          await globalThis.crypto.subtle.digest("SHA-256", supplied.manifest)
        ),
      ]
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      report.manifestStatus =
        report.actualSha256 === entry.sha256 ? "passed" : "failed";
    } catch {
      issue(
        "DATASET.HASH_UNAVAILABLE",
        path,
        "SHA-256 unavailable.",
        "external"
      );
      continue;
    }
    if (report.manifestStatus === "failed") {
      issue(
        "DATASET.PACKET_DIGEST",
        path,
        "Packet manifest digest differs.",
        "external"
      );
      continue;
    }
    let packet: unknown;
    try {
      packet = decode(supplied.manifest);
    } catch {
      issue(
        "DATASET.PACKET_JSON",
        path,
        "Packet manifest must be valid UTF-8 JSON without a BOM."
      );
      continue;
    }
    const p = ReproductionPacketSchema.safeParse(packet);
    report.validation = await evaluateReproductionPacket(packet, {
      files: supplied.files,
    });
    if (!p.success) {
      issue(
        "DATASET.PACKET_INVALID",
        path,
        "Pinned packet structure is invalid."
      );
      continue;
    }
    if (p.data.id !== entry.packetId)
      issue(
        "DATASET.PACKET_ID",
        path,
        "Pinned packet identifies a different packet ID."
      );
    if (!report.validation.success) {
      issue(
        "DATASET.PACKET_INCOMPLETE",
        path,
        "Member packet does not pass its profile; see nested diagnostics.",
        "profile"
      );
      continue;
    }
    // A passed packet has already verified and parsed these exact document bytes.
    const context = parseAcquisitionContext(
      decode(supplied.files.get(p.data.documents.context)!)
    );
    const history = parseExperimentalClaimHistory(
      decode(supplied.files.get(p.data.documents.history)!)
    );
    if (!context.success || !history.success) {
      issue(
        "DATASET.PACKET_INVALID",
        path,
        "Member documents cannot be resolved."
      );
      continue;
    }
    contexts.set(packetRef, context.data);
    const contextDigest = p.data.files.find(
      (f) => f.id === p.data.documents.context
    )!.sha256;
    if (
      contextPins.has(context.data.id) &&
      contextPins.get(context.data.id) !== contextDigest
    )
      issue(
        "DATASET.CONTEXT_CONFLICT",
        path,
        "One context ID cannot identify different pinned bytes in the same release."
      );
    contextPins.set(context.data.id, contextDigest);
    if (observationOwners.has(history.data.observation.id))
      issue(
        "DATASET.OBSERVATION_DUPLICATE",
        path,
        "An observation ID cannot be included through multiple packets in one release."
      );
    observationOwners.set(history.data.observation.id, packetRef);
  }
  const canonicalSessions = new Map<string, string>();
  for (const [i, s] of release.sessions.entries()) {
    const report: DatasetReleaseResult["sessions"][number] = {
      sessionRef: `session:${s.id}`,
      status: "passed",
      members: [],
    };
    result.sessions.push(report);
    if (s.time.state === "unknown") {
      report.status = "not_checked";
      issue(
        "DATASET.SESSION_TIME_UNKNOWN",
        `/sessions/${i}/time`,
        "Session time is unknown.",
        "profile"
      );
    }
    for (const [j, m] of s.members.entries()) {
      const path = `/sessions/${i}/members/${j}`;
      const member: DatasetReleaseResult["sessions"][number]["members"][number] =
        { ...m, status: "not_checked" };
      report.members.push(member);
      const context = contexts.get(m.packetRef);
      if (!context) continue;
      const acquisition = context.acquisitions.find(
        (a) => `acquisition:${a.id}` === m.acquisitionRef
      );
      if (!acquisition) {
        member.status = "failed";
        issue(
          "DATASET.ACQUISITION_REFERENCE",
          path,
          "Acquisition is not declared by this packet context."
        );
        continue;
      }
      member.classification = acquisition.classification;
      const canonical = `${context.id}/${m.acquisitionRef}`;
      const assigned = canonicalSessions.get(canonical);
      if (assigned && assigned !== s.id) {
        member.status = "failed";
        issue(
          "DATASET.SESSION_CONFLICT",
          path,
          "A shared context acquisition cannot belong to different sessions."
        );
        continue;
      }
      canonicalSessions.set(canonical, s.id);
      const t = acquisition.time;
      if (t.state === "unknown" || s.time.state === "unknown") continue;
      const start = t.kind === "instant" ? t.value : t.start,
        end = t.kind === "instant" ? t.value : t.end;
      const fits =
        compareUtcInstants(start, s.time.start) !== -1 &&
        (t.kind === "instant"
          ? compareUtcInstants(end, s.time.end) === -1
          : compareUtcInstants(end, s.time.end) !== 1);
      member.status = fits ? "passed" : "failed";
      if (!fits)
        issue(
          "DATASET.OUTSIDE_SESSION",
          path,
          "Entire acquisition must fit within the session; session ends are exclusive."
        );
    }
    report.status = report.members.some((m) => m.status === "failed")
      ? "failed"
      : report.members.some((m) => m.status === "not_checked") ||
        report.status === "not_checked"
      ? "not_checked"
      : "passed";
  }
  for (const [packetRef, context] of contexts)
    for (const acquisition of context.acquisitions)
      if (!members.has(`${packetRef}/acquisition:${acquisition.id}`))
        issue(
          "DATASET.MEMBERSHIP_REQUIRED",
          "/sessions",
          `Missing session membership for ${packetRef}/acquisition:${acquisition.id}.`
        );
  result.checks.semantic = result.issues.some((i) => i.stage === "semantic")
    ? "failed"
    : contexts.size < release.packets.length
    ? "not_checked"
    : "passed";
  result.checks.external = result.packets.some(
    (p) =>
      p.manifestStatus === "failed" ||
      p.validation?.checks.external === "failed"
  )
    ? "failed"
    : "not_checked";
  const failedPacket = result.packets.some(
    (p) =>
      p.validation &&
      (p.validation.checks.structural === "failed" ||
        p.validation.checks.semantic === "failed" ||
        p.validation.checks.profile === "failed")
  );
  result.checks.profile =
    result.checks.semantic === "failed" ||
    result.checks.external === "failed" ||
    failedPacket ||
    result.sessions.some((s) => s.status === "failed")
      ? "failed"
      : result.packets.some(
          (p) => p.manifestStatus !== "passed" || !p.validation?.success
        ) || result.sessions.some((s) => s.status === "not_checked")
      ? "not_checked"
      : "passed";
  result.success = result.checks.profile === "passed";
  return result;
}

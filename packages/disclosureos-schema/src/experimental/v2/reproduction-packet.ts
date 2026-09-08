import { z } from "zod";
import {parseExperimentalClaimHistory} from "@disclosureos/records/experimental/v2";
import { evaluateInstrumentResearchPrerequisites } from "./research-prerequisites";
import type { InstrumentResearchResult } from "./research-prerequisites";
const text = z.string().min(1).regex(/\S/);
const id = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]*(?![\s\S])/);
const assets = z.array(z.strictObject({ ref: text, fileRef: id }));
export const REPRODUCTION_PACKET_SCHEMA_ID =
  "urn:disclosureos:experimental:reproduction-packet:0.1.0";
export const REPRODUCTION_PACKET_PROFILE = Object.freeze({
  id: "urn:disclosureos:experimental:profile:reproduction-packet",
  version: "0.1.0",
  scope: "exact_bytes_and_research_prerequisites",
} as const);
export const ReproductionPacketSchema = z.strictObject({
  kind: z.literal("reproduction_packet"),
  schemaVersion: z.literal("0.1.0"),
  id,
  researchProfile: z.literal(
    "urn:disclosureos:experimental:profile:instrument-research-prerequisites:0.1.0"
  ),
  files: z
    .array(
      z.strictObject({
        id,
        sha256: z.string().regex(/^[a-f0-9]{64}(?![\s\S])/),
        byteLength: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
      })
    )
    .min(1),
  documents: z.strictObject({
    history: id,
    context: id,
    acquisitionBindings: id,
    measurementBindings: id,
    review: id,
  }),
  assets: z.strictObject({
    observation: assets,
    context: assets,
    review: assets,
  }),
  method: z.strictObject({
    id: text,
    version: text,
    description: text,
    inputRef: id,
    expectedOutputRef: id,
    measurementRef: z
      .string()
      .regex(/^measurement:[A-Za-z0-9][A-Za-z0-9._-]*(?![\s\S])/),
    unit: text,
    absoluteTolerance: z.number().min(0),
    implementations: z
      .array(z.strictObject({ id, artifactRef: id, environmentRef: id }))
      .min(1),
  }),
});
export type ReproductionPacket = z.infer<typeof ReproductionPacketSchema>;
export function reproductionPacketJsonSchema(): Record<string, unknown> {
  return {
    ...z.toJSONSchema(ReproductionPacketSchema, { target: "draft-2020-12" }),
    $id: REPRODUCTION_PACKET_SCHEMA_ID,
  };
}
type Status = "passed" | "failed" | "not_checked";
export interface ReproductionFileCheck {
  id: string;
  status: Status;
  expectedSha256: string;
  expectedByteLength: number;
  actualSha256?: string;
  actualByteLength?: number;
}
export interface ReproductionPacketResult {
  success: boolean;
  profile: typeof REPRODUCTION_PACKET_PROFILE;
  contract: {
    schemaId: typeof REPRODUCTION_PACKET_SCHEMA_ID;
    rulesetVersion: "0.1.0";
  };
  checks: {
    structural: Status;
    semantic: Status;
    profile: Status;
    external: Status;
  };
  packetId?: string;
  method?: ReproductionPacket["method"];
  files: ReproductionFileCheck[];
  issues: { code: string; pointer: string; message: string }[];
  research: InstrumentResearchResult | null;
  methodExecution: "not_checked";
  environmentExecution: "not_checked";
  scientificEligibility: "not_checked";
}
/** Pins exact supplied bytes and composes research prerequisites. Never fetches files or executes bundled code. */
export async function evaluateReproductionPacket(
  input: unknown,
  options: { files?: ReadonlyMap<string, Uint8Array> } = {}
): Promise<ReproductionPacketResult> {
  const parsed = ReproductionPacketSchema.safeParse(input);
  const result: ReproductionPacketResult = {
    success: false,
    profile: REPRODUCTION_PACKET_PROFILE,
    contract: {
      schemaId: REPRODUCTION_PACKET_SCHEMA_ID,
      rulesetVersion: "0.1.0",
    },
    checks: {
      structural: "passed",
      semantic: "not_checked",
      profile: "not_checked",
      external: "not_checked",
    },
    files: [],
    issues: [],
    research: null,
    methodExecution: "not_checked",
    environmentExecution: "not_checked",
    scientificEligibility: "not_checked",
  };
  const issue = (code: string, pointer: string, message: string) =>
    result.issues.push({ code, pointer, message });
  if (!parsed.success) {
    result.checks.structural = "failed";
    for (const i of parsed.error.issues)
      issue(
        "PACKET.STRUCTURE",
        "/" +
          i.path
            .map((p) => String(p).replace(/~/g, "~0").replace(/\//g, "~1"))
            .join("/"),
        i.message
      );
    return result;
  }
  const packet = parsed.data;
  result.packetId = packet.id;
  result.method = packet.method;
  const inventory = new Set<string>();
  for (const [i, file] of packet.files.entries()) {
    if (inventory.has(file.id))
      issue("PACKET.DUPLICATE", `/files/${i}/id`, "File IDs must be unique.");
    inventory.add(file.id);
  }
  const used = new Set<string>();
  const requireRef = (ref: string, path: string) => {
    used.add(ref);
    if (!inventory.has(ref))
      issue("PACKET.REFERENCE", path, "File reference is not inventoried.");
  };
  for (const [name, ref] of Object.entries(packet.documents))
    requireRef(ref, `/documents/${name}`);
  for (const [namespace, entries] of Object.entries(packet.assets)) {
    const seen = new Set<string>();
    for (const [i, entry] of entries.entries()) {
      if (seen.has(entry.ref))
        issue(
          "PACKET.DUPLICATE",
          `/assets/${namespace}/${i}/ref`,
          "Asset aliases must be unique within their namespace."
        );
      seen.add(entry.ref);
      requireRef(entry.fileRef, `/assets/${namespace}/${i}/fileRef`);
    }
  }
  requireRef(packet.method.inputRef, "/method/inputRef");
  requireRef(packet.method.expectedOutputRef, "/method/expectedOutputRef");
  const implementations = new Set<string>();
  for (const [i, impl] of packet.method.implementations.entries()) {
    if (implementations.has(impl.id))
      issue(
        "PACKET.DUPLICATE",
        `/method/implementations/${i}/id`,
        "Implementation IDs must be unique."
      );
    implementations.add(impl.id);
    requireRef(impl.artifactRef, `/method/implementations/${i}/artifactRef`);
    requireRef(
      impl.environmentRef,
      `/method/implementations/${i}/environmentRef`
    );
  }
  for (const ref of inventory)
    if (!used.has(ref))
      issue(
        "PACKET.UNUSED_FILE",
        "/files",
        `Unreferenced file ${ref}; inventory must describe the evaluated packet.`
      );
  if (result.issues.length) {
    result.checks.semantic = "failed";
    return result;
  }
  result.checks.semantic = "passed";
  const files = new Map(
    [...(options.files ?? [])].map(([id, bytes]) => [
      id,
      Uint8Array.from(bytes),
    ])
  );
  for (const [i, file] of packet.files.entries()) {
    const check: ReproductionFileCheck = {
      id: file.id,
      status: "not_checked",
      expectedSha256: file.sha256,
      expectedByteLength: file.byteLength,
    };
    result.files.push(check);
    const bytes = files.get(file.id);
    if (!bytes) {
      issue(
        "PACKET.MISSING_FILE",
        `/files/${i}`,
        `Local bytes for ${file.id} are unavailable.`
      );
      continue;
    }
    check.actualByteLength = bytes.byteLength;
    if (bytes.byteLength !== file.byteLength) {
      check.status = "failed";
      issue(
        "PACKET.SIZE",
        `/files/${i}`,
        "Byte length differs from the pinned input."
      );
      continue;
    }
    try {
      const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
      check.actualSha256 = [...new Uint8Array(digest)]
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      check.status = check.actualSha256 === file.sha256 ? "passed" : "failed";
      if (check.status === "failed")
        issue(
          "PACKET.DIGEST",
          `/files/${i}`,
          "Digest differs from the pinned input."
        );
    } catch {
      issue(
        "PACKET.HASH_UNAVAILABLE",
        `/files/${i}`,
        "SHA-256 unavailable; input identity is unchecked."
      );
    }
  }
  if (result.files.some((f) => f.status === "failed")) {
    result.checks.external = "failed";
    result.checks.profile = "failed";
    return result;
  }
  if (result.files.some((f) => f.status === "not_checked")) return result;
  const documents: Record<string, unknown> = {};
  for (const [name, ref] of Object.entries(packet.documents))
    try {
      const bytes = files.get(ref)!;
      const decoded = new TextDecoder("utf-8", {
        fatal: true,
        ignoreBOM: true,
      }).decode(bytes);
      documents[name] = JSON.parse(decoded) as unknown;
    } catch {
      issue(
        "PACKET.JSON",
        `/documents/${name}`,
        "Pinned document must be valid UTF-8 JSON without a BOM."
      );
    }
  if (result.issues.length) {
    result.checks.semantic = "failed";
    return result;
  }
  const maps = Object.fromEntries(
    Object.entries(packet.assets).map(([namespace, entries]) => [
      namespace,
      new Map(entries.map((entry) => [entry.ref, files.get(entry.fileRef)!])),
    ])
  );
  result.research = await evaluateInstrumentResearchPrerequisites(
    documents.history,
    documents.context,
    documents.acquisitionBindings,
    documents.measurementBindings,
    documents.review,
    {
      observationAssets: maps.observation!,
      contextAssets: maps.context!,
      reviewAssets: maps.review!,
    }
  );
  result.issues.push(
    ...result.research.issues.map((i) => ({
      code: i.code,
      pointer: `/research${i.pointer}`,
      message: i.message,
    }))
  );
  result.checks = { ...result.research.checks };
  result.success = result.research.success;
  if(result.success){
    const history=parseExperimentalClaimHistory(documents.history);
    const measurement=history.success ? history.data.observation.measurements.find(m=>`measurement:${m.id}`===packet.method.measurementRef) : undefined;
    if(!measurement || measurement.value.unit!==packet.method.unit){
      issue('PACKET.MEASUREMENT','/method/measurementRef','Method target must identify an existing measurement with the declared output unit.');
      result.checks.semantic='failed';result.checks.profile='not_checked';result.success=false;
    }
  }
  return result;
}

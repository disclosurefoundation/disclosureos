import { z } from "zod";
import { compareUtcInstants } from "@disclosureos/records/experimental/v2";
const text = z.string().min(1).regex(/\S/),
  id = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]*(?![\s\S])/);
const unknown = z.strictObject({ state: z.literal("unknown"), reason: text });
const declaration = z.union([
  unknown,
  z.strictObject({ state: z.literal("declared"), value: text }),
]);
export const SOURCE_INTAKE_SCHEMA_ID =
  "urn:disclosureos:experimental:source-intake:0.1.0";
export const SOURCE_INTAKE_PROFILE = Object.freeze({
  id: "urn:disclosureos:experimental:profile:source-intake",
  version: "0.1.0",
  scope: "local_file_receipt_identity",
} as const);
export const SourceIntakeSchema = z.strictObject({
  kind: z.literal("source_intake"),
  schemaVersion: z.literal("0.1.0"),
  id,
  receivedAt: text,
  source: z.strictObject({
    publisher: declaration,
    uri: z
      .url()
      .regex(/^https:\/\//)
      .optional(),
  }),
  access: z.enum(["public", "restricted", "unknown"]),
  license: declaration,
  artifacts: z
    .array(
      z.strictObject({
        id,
        originalName: text,
        role: z.enum([
          "unknown",
          "native_raw",
          "derived",
          "source_export",
          "documentation",
        ]),
        format: declaration,
        sha256: z.string().regex(/^[a-f0-9]{64}(?![\s\S])/),
        byteLength: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
        context: z.strictObject({
          instrument: declaration,
          calibration: declaration,
          clock: declaration,
          acquisitionTime: z.union([
            unknown,
            z.strictObject({
              state: z.literal("declared"),
              kind: z.literal("instant"),
              value: text,
              timeScale: z.literal("UTC"),
            }),
            z.strictObject({
              state: z.literal("declared"),
              kind: z.literal("interval"),
              start: text,
              end: text,
              timeScale: z.literal("UTC"),
            }),
          ]),
        }),
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
export type SourceIntake = z.infer<typeof SourceIntakeSchema>;
export function sourceIntakeJsonSchema(): Record<string, unknown> {
  return {
    ...z.toJSONSchema(SourceIntakeSchema, { target: "draft-2020-12" }),
    $id: SOURCE_INTAKE_SCHEMA_ID,
  };
}
type Status = "passed" | "failed" | "not_checked";
export interface SourceIntakeResult {
  success: boolean;
  profile: typeof SOURCE_INTAKE_PROFILE;
  contract: {
    schemaId: typeof SOURCE_INTAKE_SCHEMA_ID;
    rulesetVersion: "0.1.0";
  };
  checks: {
    structural: Status;
    semantic: Status;
    profile: Status;
    external: Status;
  };
  issues: {
    code: string;
    stage: "structural" | "semantic" | "external";
    pointer: string;
    message: string;
  }[];
  gaps: { pointer: string; reason: string; nextAction: string }[];
  files: {
    id: string;
    status: Status;
    expectedSha256: string;
    expectedByteLength: number;
    actualSha256?: string;
    actualByteLength?: number;
  }[];
  researchEligibility: "not_checked";
  artifactContents: "not_checked";
  authorization: "not_checked";
}
const pointer = (path: readonly PropertyKey[]) =>
  path
    .map((p) => `/${String(p).replace(/~/g, "~0").replace(/\//g, "~1")}`)
    .join("");
/** Receipt integrity only: missing context never requires fabricated observations or reviews. */
export async function evaluateSourceIntake(
  input: unknown,
  options: { files?: ReadonlyMap<string, Uint8Array> } = {}
): Promise<SourceIntakeResult> {
  const parsed = SourceIntakeSchema.safeParse(input);
  const result: SourceIntakeResult = {
    success: false,
    profile: SOURCE_INTAKE_PROFILE,
    contract: { schemaId: SOURCE_INTAKE_SCHEMA_ID, rulesetVersion: "0.1.0" },
    checks: {
      structural: "passed",
      semantic: "not_checked",
      profile: "not_checked",
      external: "not_checked",
    },
    issues: [],
    gaps: [],
    files: [],
    researchEligibility: "not_checked",
    artifactContents: "not_checked",
    authorization: "not_checked",
  };
  const issue = (
    code: string,
    stage: SourceIntakeResult["issues"][number]["stage"],
    path: string,
    message: string
  ) => result.issues.push({ code, stage, pointer: path, message });
  if (!parsed.success) {
    result.checks.structural = "failed";
    for (const i of parsed.error.issues)
      issue("INTAKE.STRUCTURE", "structural", pointer(i.path), i.message);
    return result;
  }
  const data = parsed.data;
  if (compareUtcInstants(data.receivedAt, data.receivedAt) === undefined)
    issue(
      "INTAKE.TIME",
      "semantic",
      "/receivedAt",
      "Receipt time must be a valid UTC instant."
    );
  const gap = (path: string, reason: string, nextAction: string) =>
    result.gaps.push({ pointer: path, reason, nextAction });
  if (data.source.publisher.state === "unknown")
    gap(
      "/source/publisher",
      data.source.publisher.reason,
      "Record the source publisher."
    );
  if (data.license.state === "unknown")
    gap(
      "/license",
      data.license.reason,
      "Confirm applicable license and permitted use."
    );
  if (data.access === "unknown")
    gap(
      "/access",
      "Access conditions not established.",
      "Confirm sharing restrictions before publication."
    );
  const seen = new Set<string>();
  for (const [i, a] of data.artifacts.entries()) {
    const path = `/artifacts/${i}`;
    if (seen.has(a.id))
      issue(
        "INTAKE.DUPLICATE",
        "semantic",
        `${path}/id`,
        "Artifact IDs must be unique."
      );
    seen.add(a.id);
    if (a.role === "unknown")
      gap(
        `${path}/role`,
        "Artifact role not established.",
        "Determine whether this is native raw data, a derived product, a source export, or documentation."
      );
    for (const [key, value] of Object.entries({
      format: a.format,
      ...a.context,
    })) {
      const field =
        key === "format" ? `${path}/format` : `${path}/context/${key}`;
      if (value.state === "unknown")
        gap(field, value.reason, `Obtain source documentation for ${key}.`);
    }
    const t = a.context.acquisitionTime;
    if (t.state === "declared") {
      const start = t.kind === "instant" ? t.value : t.start,
        end = t.kind === "instant" ? t.value : t.end;
      if (
        compareUtcInstants(start, start) === undefined ||
        compareUtcInstants(end, end) === undefined ||
        (t.kind === "interval" && compareUtcInstants(start, end) !== -1)
      )
        issue(
          "INTAKE.TIME",
          "semantic",
          `${path}/context/acquisitionTime`,
          "Declared capture time requires valid UTC instants and a nonempty half-open interval."
        );
    }
    if (a.byteLength === 0)
      gap(
        `${path}/byteLength`,
        "Empty file.",
        "Determine whether the empty file is expected; it supplies no measurement content."
      );
  }
  if (result.issues.length) {
    result.checks.semantic = "failed";
    return result;
  }
  result.checks.semantic = "passed";
  const files = new Map(
    [...(options.files ?? [])].map(([id, b]) => [id, Uint8Array.from(b)])
  );
  for (const [i, a] of data.artifacts.entries()) {
    const path = `/artifacts/${i}`,
      check: SourceIntakeResult["files"][number] = {
        id: a.id,
        status: "not_checked",
        expectedSha256: a.sha256,
        expectedByteLength: a.byteLength,
      };
    result.files.push(check);
    const bytes = files.get(a.id);
    if (!bytes) {
      issue(
        "INTAKE.FILE_UNAVAILABLE",
        "external",
        path,
        "No local file bytes supplied."
      );
      continue;
    }
    check.actualByteLength = bytes.length;
    if (bytes.length !== a.byteLength) {
      check.status = "failed";
      issue(
        "INTAKE.SIZE",
        "external",
        path,
        "File length differs from the receipt."
      );
      continue;
    }
    try {
      check.actualSha256 = [
        ...new Uint8Array(
          await globalThis.crypto.subtle.digest("SHA-256", bytes)
        ),
      ]
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      check.status = check.actualSha256 === a.sha256 ? "passed" : "failed";
      if (check.status === "failed")
        issue(
          "INTAKE.DIGEST",
          "external",
          path,
          "File digest differs from the receipt."
        );
    } catch {
      issue(
        "INTAKE.HASH_UNAVAILABLE",
        "external",
        path,
        "SHA-256 unavailable; file identity unchecked."
      );
    }
  }
  result.checks.external = result.files.some((f) => f.status === "failed")
    ? "failed"
    : "not_checked";
  result.checks.profile = result.files.some((f) => f.status === "failed")
    ? "failed"
    : result.files.some((f) => f.status === "not_checked")
    ? "not_checked"
    : "passed";
  result.success = result.checks.profile === "passed";
  return result;
}

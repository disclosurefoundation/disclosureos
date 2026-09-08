import {
  constants,
  openSync,
  closeSync,
  fstatSync,
  readSync,
  lstatSync,
} from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import {
  ReproductionPacketSchema,
  evaluateReproductionPacket,
} from "@disclosureos/schema/experimental/v2";
import type {
  ReproductionPacket,
  ReproductionPacketResult,
} from "@disclosureos/schema/experimental/v2";
import { parseExperimentalClaimHistory } from "@disclosureos/records/experimental/v2";
import type { ParsedArgs } from "../utils/args";
const MANIFEST_LIMIT = 8 * 1024 * 1024,
  TOTAL_LIMIT = 256 * 1024 * 1024,
  FILE_LIMIT = 4096;
const hash = (bytes: Uint8Array) =>
  createHash("sha256").update(bytes).digest("hex");
export function readLocal(path: string, limit: number): Uint8Array {
  const fd = openSync(
    path,
    constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK
  );
  try {
    const stat = fstatSync(fd);
    if (!stat.isFile()) throw Error("Expected a regular file.");
    if (stat.size > limit) throw Error("Packet exceeds the CLI memory limit.");
    const chunks: Buffer[] = [];
    let size = 0;
    for (;;) {
      const chunk = Buffer.alloc(Math.min(65536, limit - size + 1));
      const count = readSync(fd, chunk, 0, chunk.length, null);
      if (!count) break;
      size += count;
      if (size > limit) throw Error("Packet exceeds the CLI memory limit.");
      chunks.push(chunk.subarray(0, count));
    }
    return Buffer.concat(chunks, size);
  } finally {
    closeSync(fd);
  }
}
const json = (bytes: Uint8Array): unknown =>
  JSON.parse(
    new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes)
  ) as unknown;
const object = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw Error("Expected a JSON object.");
  return value as Record<string, unknown>;
};
interface LocalIssue {
  code: string;
  pointer: string;
  message: string;
}
interface Reproduction {
  status: "passed" | "failed" | "not_checked";
  executor: string;
  runtime: string;
  executorSha256?: string;
  methodId: string;
  methodVersion: string;
  value?: number;
  expected?: number;
  unit: string;
  absoluteTolerance: number;
  message?: string;
}
interface Output {
  command: string;
  success: boolean;
  manifestSha256?: string;
  packetId?: string;
  inspection?: {
    fileCount: number;
    declaredBytes: number;
    documents: ReproductionPacket["documents"];
    method: ReproductionPacket["method"];
    fileIdentity: "not_checked";
    researchPrerequisites: "not_checked";
  };
  validation?: ReproductionPacketResult;
  reproduction?: Reproduction;
  issues: LocalIssue[];
  scientificEligibility: "not_checked";
}
function usage(): void {
  console.log(`DisclosureOS experimental packet workflow

  disclosureos packet inspect <packet.json> [--json]
  disclosureos packet validate <packet.json> [--json]
  disclosureos packet reproduce <packet.json> [--json]

Files are read from files/<file ID> beside packet.json. Inspection reads only the
manifest; validation verifies files and research prerequisites. Reproduction runs
only the built-in synthetic-radial-velocity-mean v1 control, never bundled code.
Limits: 8 MiB manifest, 4096 files, 256 MiB combined file bytes. No network access.
Exit codes: 0 success, 1 failed or incomplete check, 2 usage or manifest-read error.
Use --json for the complete validator diagnostics and unchecked scientific limits.`);
}
function emit(output: Output, jsonMode: boolean): void {
  if (jsonMode) {
    console.log(JSON.stringify(output, null, 2));
    return;
  }
  console.log(
    `DisclosureOS packet ${output.command}: ${
      output.success ? "passed" : "failed or incomplete"
    }`
  );
  if (output.packetId)
    console.log(
      `Packet: ${output.packetId}\nManifest SHA-256: ${output.manifestSha256}`
    );
  if (output.inspection)
    console.log(
      `${output.inspection.fileCount} declared files; ${output.inspection.declaredBytes} bytes.\nFile identity and research prerequisites: not checked.\nNext: disclosureos packet validate <packet.json>`
    );
  if (output.validation) {
    const v = output.validation;
    console.log(
      `Structural: ${v.checks.structural}; semantic: ${v.checks.semantic}; profile: ${v.checks.profile}; external: ${v.checks.external}`
    );
    for (const i of v.issues)
      console.log(`${i.code} ${i.pointer}: ${i.message}`);
    if (v.success && output.command === "validate")
      console.log(
        "Next: disclosureos packet reproduce <packet.json> (synthetic control only)."
      );
  }
  if (output.reproduction) {
    const r = output.reproduction;
    console.log(
      `Reproduction: ${r.status}${
        r.value === undefined
          ? ""
          : `; ${r.value} ${r.unit}, tolerance ${r.absoluteTolerance}`
      }`
    );
    if (r.message) console.log(r.message);
  }
  for (const i of output.issues)
    console.log(`${i.code} ${i.pointer}: ${i.message}`);
  console.log("Scientific eligibility: not checked.");
}
function reproduce(
  packet: ReproductionPacket,
  files: ReadonlyMap<string, Uint8Array>
): Reproduction {
  const method = packet.method;
  const result: Reproduction = {
    status: "not_checked",
    executor: "disclosureos-cli/synthetic-mean/0.1.0",
    runtime: process.version,
    methodId: method.id,
    methodVersion: method.version,
    unit: method.unit,
    absoluteTolerance: method.absoluteTolerance,
  };
  if (
    method.id !== "synthetic-radial-velocity-mean" ||
    method.version !== "1"
  ) {
    result.message =
      "Unsupported method. This CLI never executes packet-supplied implementations.";
    return result;
  }
  try {
    result.executorSha256 = hash(
      readLocal(fileURLToPath(import.meta.url), TOTAL_LIMIT)
    );
    if (
      method.unit !== "m/s" ||
      packet.assets.context.find((a) => a.ref === "product:captured-raw")
        ?.fileRef !== method.inputRef ||
      packet.assets.observation.find((a) => a.ref === "product:summary")
        ?.fileRef !== method.expectedOutputRef
    )
      throw Error("Method does not match the fixed synthetic control mapping.");
    const input = object(json(files.get(method.inputRef)!)),
      expected = object(json(files.get(method.expectedOutputRef)!));
    const samples = input["samples"];
    if (
      !Array.isArray(samples) ||
      !samples.length ||
      !samples.every(
        (v: unknown) => typeof v === "number" && Number.isFinite(v)
      )
    )
      throw Error("Expected a nonempty array of finite samples.");
    let sum = 0;
    for (const value of samples as number[]) sum += value;
    const value = sum / samples.length,
      expectedValue = expected["velocity"];
    if (
      !Number.isFinite(value) ||
      typeof expectedValue !== "number" ||
      !Number.isFinite(expectedValue)
    )
      throw Error("Nonfinite or malformed calculation result.");
    result.value = value;
    result.expected = expectedValue;
    const history = parseExperimentalClaimHistory(
      json(files.get(packet.documents.history)!)
    );
    const measurement = history.success
      ? history.data.observation.measurements.find(
          (m) => `measurement:${m.id}` === method.measurementRef
        )
      : undefined;
    if (
      !measurement ||
      measurement.value.unit !== method.unit ||
      Math.abs(value - expectedValue) > method.absoluteTolerance ||
      Math.abs(value - measurement.value.value) > method.absoluteTolerance
    )
      throw Error(
        "Computed result differs from the expected output or measurement beyond the declared tolerance."
      );
    result.status = "passed";
    return result;
  } catch (error) {
    result.status = "failed";
    result.message =
      error instanceof Error ? error.message : "Calculation failed.";
    return result;
  }
}
export async function packet(args: ParsedArgs): Promise<void> {
  if (args.flags["help"]) {
    usage();
    return;
  }
  const output: Output = {
    command: args.subcommand,
    success: false,
    issues: [],
    scientificEligibility: "not_checked",
  };
  const jsonMode = !!args.flags["json"];
  if (
    !["inspect", "validate", "reproduce"].includes(args.subcommand) ||
    args.positional.length !== 1 ||
    Object.keys(args.flags).some((f) => !["json", "help"].includes(f))
  ) {
    output.issues.push({
      code: "CLI.USAGE",
      pointer: "",
      message: "Use packet inspect|validate|reproduce <packet.json> [--json].",
    });
    emit(output, jsonMode);
    if (!jsonMode) usage();
    process.exitCode = 2;
    return;
  }
  let path: string, bytes: Uint8Array, input: unknown;
  try {
    path = resolve(args.positional[0]!);
    bytes = readLocal(path, MANIFEST_LIMIT);
    input = json(bytes);
    output.manifestSha256 = hash(bytes);
  } catch (error) {
    output.issues.push({
      code: "CLI.MANIFEST",
      pointer: "",
      message: error instanceof Error ? error.message : "Cannot read manifest.",
    });
    emit(output, jsonMode);
    process.exitCode = 2;
    return;
  }
  const parsed = ReproductionPacketSchema.safeParse(input);
  if (!parsed.success) {
    output.validation = await evaluateReproductionPacket(input);
    emit(output, jsonMode);
    process.exitCode = 1;
    return;
  }
  const data = parsed.data;
  output.packetId = data.id;
  if (args.subcommand === "inspect") {
    output.inspection = {
      fileCount: data.files.length,
      declaredBytes: data.files.reduce((n, f) => n + f.byteLength, 0),
      documents: data.documents,
      method: data.method,
      fileIdentity: "not_checked",
      researchPrerequisites: "not_checked",
    };
    output.success = true;
    emit(output, jsonMode);
    return;
  }
  const files = new Map<string, Uint8Array>();
  if (
    data.files.length > FILE_LIMIT ||
    data.files.reduce((n, f) => n + f.byteLength, 0) > TOTAL_LIMIT
  ) {
    output.issues.push({
      code: "CLI.LIMIT",
      pointer: "/files",
      message: "Declared packet exceeds 4096 files or 256 MiB.",
    });
    emit(output, jsonMode);
    process.exitCode = 1;
    return;
  }
  const directory = join(dirname(path), "files");
  let remaining = TOTAL_LIMIT;
  try {
    if (!lstatSync(directory).isDirectory())
      throw Error("files must be a real directory, not a symlink.");
  } catch (error) {
    output.issues.push({
      code: "CLI.FILES_DIRECTORY",
      pointer: "/files",
      message:
        error instanceof Error ? error.message : "Cannot read files directory.",
    });
  }
  if (!output.issues.length)
    for (const [i, file] of data.files.entries())
      try {
        if (files.has(file.id)) continue;
        const bytes = readLocal(join(directory, file.id), remaining);
        files.set(file.id, bytes);
        remaining -= bytes.byteLength;
      } catch (error) {
        output.issues.push({
          code: "CLI.FILE_READ",
          pointer: `/files/${i}`,
          message: error instanceof Error ? error.message : "Cannot read file.",
        });
      }
  output.validation = await evaluateReproductionPacket(input, { files });
  output.success = output.validation.success && !output.issues.length;
  if (args.subcommand === "reproduce" && output.success) {
    output.reproduction = reproduce(data, files);
    output.success = output.reproduction.status === "passed";
  }
  emit(output, jsonMode);
  if (!output.success) process.exitCode = 1;
}

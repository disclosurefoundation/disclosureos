import { mkdirSync, writeFileSync, rmSync, lstatSync } from "node:fs";
import { resolve, dirname, join, basename } from "node:path";
import { randomUUID, createHash } from "node:crypto";
import {
  SourceIntakeSchema,
  evaluateSourceIntake,
} from "@disclosureos/schema/experimental/v2";
import type {
  SourceIntake,
  SourceIntakeResult,
} from "@disclosureos/schema/experimental/v2";
import { readLocal } from "./packet";
import type { ParsedArgs } from "../utils/args";
const LIMIT = 256 * 1024 * 1024;
const hash = (bytes: Uint8Array) =>
  createHash("sha256").update(bytes).digest("hex");
const decode = (bytes: Uint8Array): unknown =>
  JSON.parse(
    new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes)
  ) as unknown;
const unknown = () => ({
  state: "unknown" as const,
  reason: "Not established at file intake.",
});
export async function intake(args: ParsedArgs): Promise<void> {
  if (args.flags["help"]) {
    console.log(
      "DisclosureOS experimental source intake\n\n  disclosureos intake create <file...> --out <new-directory> [--json]\n  disclosureos intake inspect <intake.json> [--json]\n  disclosureos intake validate <intake.json> [--json]\n\nCreate copies exact bytes into files/<ID> and records receipt time and hashes.\nContext, format, role, access and licensing remain explicitly unknown. No decoding\nor assessment is inferred. Destination must not exist. Limits: 4096 files,\n256 MiB combined bytes, 8 MiB manifest. No network access.\nExit: 0 success, 1 failed/incomplete, 2 usage or file-operation error."
    );
    return;
  }
  const output: {
    command: string;
    success: boolean;
    path?: string;
    manifestSha256?: string;
    inspection?: SourceIntake;
    fileIdentity?: "not_checked";
    validation?: SourceIntakeResult;
    issues: { code: string; pointer: string; message: string }[];
    researchEligibility: "not_checked";
  } = {
    command: args.subcommand,
    success: false,
    issues: [],
    researchEligibility: "not_checked",
  };
  const emit = () => {
    if (args.flags["json"]) {
      console.log(JSON.stringify(output, null, 2));
      return;
    }
    console.log(
      `DisclosureOS intake ${args.subcommand}: ${
        output.success ? "passed" : "failed or incomplete"
      }`
    );
    if (output.path) console.log(`Receipt: ${output.path}`);
    if (output.manifestSha256)
      console.log(`Manifest SHA-256: ${output.manifestSha256}`);
    if (output.inspection) {
      console.log(
        `${output.inspection.artifacts.length} artifacts; file identity not checked.`
      );
      console.log(JSON.stringify(output.inspection, null, 2));
    }
    if (output.validation) {
      console.log(JSON.stringify(output.validation.checks));
      for (const i of output.validation.issues)
        console.log(`${i.code} ${i.pointer}: ${i.message}`);
      for (const gap of output.validation.gaps)
        console.log(
          `MISSING ${gap.pointer}: ${gap.reason} Next: ${gap.nextAction}`
        );
    }
    for (const i of output.issues)
      console.log(`${i.code} ${i.pointer}: ${i.message}`);
    console.log(
      "Research eligibility, artifact contents and authorization: not checked."
    );
  };
  const create = args.subcommand === "create";
  if (
    !["create", "inspect", "validate"].includes(args.subcommand) ||
    Object.keys(args.flags).some(
      (f) => !["help", "json", ...(create ? ["out"] : [])].includes(f)
    ) ||
    (create
      ? args.positional.length < 1 || typeof args.flags["out"] !== "string"
      : args.positional.length !== 1)
  ) {
    output.issues.push({
      code: "CLI.USAGE",
      pointer: "",
      message:
        "Use intake create <file...> --out <new-directory>, or inspect|validate <intake.json>.",
    });
    emit();
    process.exitCode = 2;
    return;
  }
  const files = new Map<string, Uint8Array>();
  let remaining = LIMIT;
  if (create) {
    let destination: string | undefined,
      created = false;
    try {
      if (args.positional.length > 4096)
        throw Error("At most 4096 source files are supported.");
      const artifacts: SourceIntake["artifacts"] = [];
      for (const [i, path] of args.positional.entries()) {
        const bytes = readLocal(resolve(path), remaining);
        remaining -= bytes.length;
        const id = `file-${i + 1}`;
        files.set(id, bytes);
        artifacts.push({
          id,
          originalName: basename(path),
          role: "unknown",
          format: unknown(),
          sha256: hash(bytes),
          byteLength: bytes.length,
          context: {
            instrument: unknown(),
            calibration: unknown(),
            clock: unknown(),
            acquisitionTime: unknown(),
          },
        });
      }
      const receipt: SourceIntake = {
        kind: "source_intake",
        schemaVersion: "0.1.0",
        id: `intake-${randomUUID()}`,
        receivedAt: new Date().toISOString(),
        source: { publisher: unknown() },
        access: "unknown",
        license: unknown(),
        artifacts,
      };
      const bytes = Buffer.from(JSON.stringify(receipt, null, 2) + "\n");
      if (bytes.length > 8 * 1024 * 1024)
        throw Error("Generated manifest exceeds 8 MiB.");
      output.validation = await evaluateSourceIntake(receipt, { files });
      if (!output.validation.success)
        throw Error("Receipt did not pass file identity checks.");
      destination = resolve(args.flags["out"] as string);
      mkdirSync(destination, { mode: 0o700 });
      created = true;
      mkdirSync(join(destination, "files"), { mode: 0o700 });
      for (const [id, b] of files)
        writeFileSync(join(destination, "files", id), b, {
          flag: "wx",
          mode: 0o600,
        });
      writeFileSync(join(destination, "intake.json"), bytes, {
        flag: "wx",
        mode: 0o600,
      });
      output.path = join(destination, "intake.json");
      output.manifestSha256 = hash(bytes);
      output.success = true;
    } catch (error) {
      if (created && destination)
        rmSync(destination, { recursive: true, force: true });
      output.issues.push({
        code: "CLI.INTAKE_CREATE",
        pointer: "",
        message:
          error instanceof Error ? error.message : "Intake creation failed.",
      });
      process.exitCode = 2;
    }
    emit();
    return;
  }
  let input: unknown, path: string;
  try {
    path = resolve(args.positional[0]!);
    const bytes = readLocal(path, 8 * 1024 * 1024);
    output.manifestSha256 = hash(bytes);
    input = decode(bytes);
  } catch (error) {
    output.issues.push({
      code: "CLI.MANIFEST",
      pointer: "",
      message:
        error instanceof Error ? error.message : "Cannot read intake manifest.",
    });
    emit();
    process.exitCode = 2;
    return;
  }
  const parsed = SourceIntakeSchema.safeParse(input);
  if (!parsed.success) {
    output.validation = await evaluateSourceIntake(input);
    emit();
    process.exitCode = 1;
    return;
  }
  if (args.subcommand === "inspect") {
    output.inspection = parsed.data;
    output.fileIdentity = "not_checked";
    output.success = true;
    emit();
    return;
  }
  if (
    parsed.data.artifacts.length > 4096 ||
    parsed.data.artifacts.reduce((n, a) => n + a.byteLength, 0) > LIMIT
  ) {
    output.issues.push({
      code: "CLI.LIMIT",
      pointer: "/artifacts",
      message: "Intake exceeds 4096 artifacts or 256 MiB.",
    });
    emit();
    process.exitCode = 1;
    return;
  }
  const directory = join(dirname(path), "files");
  try {
    if (!lstatSync(directory).isDirectory())
      throw Error("Expected a real files directory, not a symlink.");
  } catch (error) {
    output.issues.push({
      code: "CLI.FILES_DIRECTORY",
      pointer: "/artifacts",
      message:
        error instanceof Error ? error.message : "Cannot read files directory.",
    });
  }
  if (!output.issues.length)
    for (const [i, a] of parsed.data.artifacts.entries())
      try {
        if (files.has(a.id)) continue;
        const b = readLocal(join(directory, a.id), remaining);
        remaining -= b.length;
        files.set(a.id, b);
      } catch (error) {
        output.issues.push({
          code: "CLI.FILE_READ",
          pointer: `/artifacts/${i}`,
          message:
            error instanceof Error ? error.message : "Cannot read artifact.",
        });
      }
  output.validation = await evaluateSourceIntake(input, { files });
  output.success = output.validation.success && !output.issues.length;
  emit();
  if (!output.success) process.exitCode = 1;
}

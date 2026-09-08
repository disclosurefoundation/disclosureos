import { lstatSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { createHash } from "node:crypto";
import {
  DatasetReleaseSchema,
  ReproductionPacketSchema,
  evaluateDatasetRelease,
} from "@disclosureos/schema/experimental/v2";
import type {
  DatasetPacketInput,
  DatasetReleaseResult,
} from "@disclosureos/schema/experimental/v2";
import { readLocal } from "./packet";
import type { ParsedArgs } from "../utils/args";
const LIMIT = 256 * 1024 * 1024,
  MANIFEST_LIMIT = 8 * 1024 * 1024;
const json = (bytes: Uint8Array): unknown =>
  JSON.parse(
    new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes)
  ) as unknown;
function directory(path: string): void {
  if (!lstatSync(path).isDirectory())
    throw Error("Expected a real directory, not a symlink.");
}
export async function dataset(args: ParsedArgs): Promise<void> {
  if (args.flags["help"]) {
    console.log(
      "DisclosureOS experimental dataset workflow\n\n  disclosureos dataset inspect <dataset.json> [--json]\n  disclosureos dataset validate <dataset.json> [--json]\n\nMember packets live at packets/<entry ID>/packet.json and files/<file ID>.\nInspection reads only the release manifest. Validation checks pinned packets and\nnominal session membership. No code execution or inferred scientific eligibility.\nLimits: 128 packets, 4096 total files, 256 MiB total packet/file bytes.\nExit: 0 success, 1 failed/incomplete, 2 usage or release-manifest read error."
    );
    return;
  }
  const output: {
    command: string;
    success: boolean;
    manifestSha256?: string;
    inspection?: unknown;
    validation?: DatasetReleaseResult;
    issues: { code: string; pointer: string; message: string }[];
    scientificEligibility: "not_checked";
    authorization: "not_checked";
  } = {
    command: args.subcommand,
    success: false,
    issues: [],
    scientificEligibility: "not_checked",
    authorization: "not_checked",
  };
  const emit = () => {
    if (args.flags["json"]) {
      console.log(JSON.stringify(output, null, 2));
      return;
    }
    console.log(
      `DisclosureOS dataset ${args.subcommand}: ${
        output.success ? "passed" : "failed or incomplete"
      }`
    );
    if (output.manifestSha256)
      console.log(`Manifest SHA-256: ${output.manifestSha256}`);
    if (output.inspection)
      console.log(JSON.stringify(output.inspection, null, 2));
    if (output.validation) {
      console.log(JSON.stringify(output.validation.checks));
      for (const i of output.validation.issues)
        console.log(`${i.code} ${i.pointer}: ${i.message}`);
      for (const packet of output.validation.packets)
        for (const i of packet.validation?.issues ?? [])
          console.log(
            `${packet.packetRef} ${i.code} ${i.pointer}: ${i.message}`
          );
    }
    for (const i of output.issues)
      console.log(`${i.code} ${i.pointer}: ${i.message}`);
    console.log("Scientific eligibility and authorization: not checked.");
  };
  if (
    !["inspect", "validate"].includes(args.subcommand) ||
    args.positional.length !== 1 ||
    Object.keys(args.flags).some((f) => !["json", "help"].includes(f))
  ) {
    output.issues.push({
      code: "CLI.USAGE",
      pointer: "",
      message: "Use dataset inspect|validate <dataset.json> [--json].",
    });
    emit();
    process.exitCode = 2;
    return;
  }
  let input: unknown, path: string;
  try {
    path = resolve(args.positional[0]!);
    const bytes = readLocal(path, MANIFEST_LIMIT);
    output.manifestSha256 = createHash("sha256").update(bytes).digest("hex");
    input = json(bytes);
  } catch (error) {
    output.issues.push({
      code: "CLI.MANIFEST",
      pointer: "",
      message:
        error instanceof Error
          ? error.message
          : "Cannot read dataset manifest.",
    });
    emit();
    process.exitCode = 2;
    return;
  }
  const parsed = DatasetReleaseSchema.safeParse(input);
  if (!parsed.success) {
    output.validation = await evaluateDatasetRelease(input);
    emit();
    process.exitCode = 1;
    return;
  }
  const release = parsed.data;
  if (args.subcommand === "inspect") {
    output.inspection = {
      id: release.id,
      version: release.version,
      packetCount: release.packets.length,
      sessions: release.sessions,
      access: release.access,
      license: release.license,
      fileIdentity: "not_checked",
      membership: "not_checked",
    };
    output.success = true;
    emit();
    return;
  }
  if (release.packets.length > 128) {
    output.issues.push({
      code: "CLI.LIMIT",
      pointer: "/packets",
      message: "At most 128 packets are supported.",
    });
    emit();
    process.exitCode = 1;
    return;
  }
  const packets = new Map<string, DatasetPacketInput>();
  let remaining = LIMIT,
    count = 0;
  const root = join(dirname(path), "packets");
  try {
    directory(root);
  } catch (error) {
    output.issues.push({
      code: "CLI.PACKET_DIRECTORY",
      pointer: "/packets",
      message:
        error instanceof Error
          ? error.message
          : "Cannot read packets directory.",
    });
  }
  if (!output.issues.length)
    for (const [i, entry] of release.packets.entries()) {
      if (packets.has(entry.id)) continue;
      const base = join(root, entry.id),
        issuesPath = `/packets/${i}`;
      try {
        directory(base);
        const manifest = readLocal(
          join(base, "packet.json"),
          Math.min(remaining, MANIFEST_LIMIT)
        );
        remaining -= manifest.byteLength;
        const files = new Map<string, Uint8Array>();
        packets.set(entry.id, { manifest, files });
        const packet = ReproductionPacketSchema.safeParse(json(manifest));
        if (!packet.success) continue;
        if (count + packet.data.files.length > 4096)
          throw Error("Dataset exceeds the 4096-file limit.");
        count += packet.data.files.length;
        directory(join(base, "files"));
        for (const file of packet.data.files) {
          if (files.has(file.id)) continue;
          try {
            const bytes = readLocal(join(base, "files", file.id), remaining);
            remaining -= bytes.byteLength;
            files.set(file.id, bytes);
          } catch (error) {
            output.issues.push({
              code: "CLI.FILE_READ",
              pointer: issuesPath,
              message:
                error instanceof Error
                  ? error.message
                  : "Cannot read member file.",
            });
          }
        }
      } catch (error) {
        output.issues.push({
          code: "CLI.PACKET_READ",
          pointer: issuesPath,
          message:
            error instanceof Error
              ? error.message
              : "Cannot read member packet.",
        });
      }
    }
  output.validation = await evaluateDatasetRelease(input, { packets });
  output.success = output.validation.success && !output.issues.length;
  emit();
  if (!output.success) process.exitCode = 1;
}

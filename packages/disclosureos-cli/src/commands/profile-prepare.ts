import { mkdirSync, writeFileSync, rmSync, lstatSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { createHash } from "node:crypto";
import {
  ProfilePreparationSchema,
  evaluateProfileEvaluation,
} from "@disclosureos/schema/experimental/v2";
import type {
  ProfileEvaluation,
  ProfileEvaluationResult,
} from "@disclosureos/schema/experimental/v2";
import { readLocal } from "./packet";
import type { ParsedArgs } from "../utils/args";
const META = 8 * 1024 * 1024,
  TOTAL = 256 * 1024 * 1024,
  FILES = 4096;
const pin = (bytes: Uint8Array) => ({
  sha256: createHash("sha256").update(bytes).digest("hex"),
  byteLength: bytes.length,
});
function directory(path: string): void {
  if (!lstatSync(path).isDirectory())
    throw Error("Expected a real directory, not a symlink.");
}
const decode = (bytes: Uint8Array): unknown =>
  JSON.parse(
    new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes)
  ) as unknown;
export async function prepareProfile(args: ParsedArgs): Promise<void> {
  const output: {
    command: "prepare";
    success: boolean;
    path?: string;
    planSha256?: string;
    profileStatus?: string;
    profileSuccess?: boolean;
    receiptCreated?: boolean;
    issues: { code: string; message: string }[];
    scientificEligibility: "not_checked";
  } = {
    command: "prepare",
    success: false,
    issues: [],
    scientificEligibility: "not_checked",
  };
  let destination: string | undefined,
    created = false;
  const emit = () => {
    if (args.flags["json"]) console.log(JSON.stringify(output, null, 2));
    else {
      console.log(
        "DisclosureOS profile preparation: " +
          (output.success ? "bundle prepared" : "not prepared")
      );
      if (output.path) console.log("Bundle: " + JSON.stringify(output.path));
      if (output.profileStatus)
        console.log(
          "Profile outcome: " +
            output.profileStatus +
            "; receipt " +
            (output.receiptCreated ? "created (unsigned)" : "not created")
        );
      for (const i of output.issues)
        console.log(i.code + ": " + JSON.stringify(i.message));
      console.log(
        "Preparation success is not a passing profile. Run profile check on evaluation.json for requirements and next actions."
      );
    }
  };
  if (
    args.positional.length !== 1 ||
    typeof args.flags["out"] !== "string" ||
    Object.keys(args.flags).some((f) => !["json", "out", "help"].includes(f))
  ) {
    output.issues.push({
      code: "CLI.USAGE",
      message:
        "Use profile prepare <plan.json> --out <new-directory> [--json].",
    });
    emit();
    process.exitCode = 2;
    return;
  }
  try {
    const planPath = resolve(args.positional[0]!),
      base = dirname(planPath);
    directory(base);
    const planBytes = readLocal(planPath, META),
      parsed = ProfilePreparationSchema.safeParse(decode(planBytes));
    output.planSha256 = pin(planBytes).sha256;
    if (!parsed.success) {
      output.issues.push(
        ...parsed.error.issues.map((i) => ({
          code: "PREPARE.PLAN",
          message: i.path.join("/") + ": " + i.message,
        }))
      );
      emit();
      process.exitCode = 1;
      return;
    }
    const plan = parsed.data,
      deps = [
        ...plan.dependencies.vocabularies,
        plan.dependencies.implementation,
        plan.dependencies.environment,
      ];
    if (plan.assets.length + deps.length + 2 > FILES)
      throw Error("Preparation exceeds 4096 input files.");
    if (
      new Set(deps.map((d) => d.ref)).size !== deps.length ||
      new Set(plan.dependencies.vocabularies.map((d) => d.id)).size !==
        plan.dependencies.vocabularies.length ||
      new Set(plan.assets.map((a) => a.ref)).size !== plan.assets.length ||
      new Set(plan.assets.map((a) => a.fileRef)).size !== plan.assets.length
    )
      throw Error("Duplicate dependency, vocabulary or asset references.");
    let remaining = TOTAL - planBytes.length;
    const read = (path: string, limit: number) => {
      const parts = path.split("/");
      let parent = base;
      for (const part of parts.slice(0, -1)) {
        parent = join(parent, part);
        directory(parent);
      }
      const bytes = readLocal(join(base, ...parts), Math.min(limit, remaining));
      remaining -= bytes.length;
      if (!bytes.length)
        throw Error(
          "Empty inputs cannot receive positive-length evaluation pins: " + path
        );
      return bytes;
    };
    const historyBytes = read(plan.history, META),
      selectionBytes = read(plan.selection, META);
    decode(historyBytes);
    decode(selectionBytes);
    const assetFiles = new Map(
      plan.assets.map((a) => [a.fileRef, read(a.path, remaining)])
    );
    const dependencyFiles = new Map(
      deps.map((d) => [d.ref, read(d.path, remaining)])
    );
    const dependency = (d: (typeof deps)[number]) => ({
      ref: d.ref,
      id: d.id,
      version: d.version,
      ...pin(dependencyFiles.get(d.ref)!),
    });
    const manifest: ProfileEvaluation = {
      kind: "profile_evaluation",
      schemaVersion: "0.1.0",
      id: plan.id,
      workflow: plan.workflow,
      history: pin(historyBytes),
      selection: pin(selectionBytes),
      assets: plan.assets.map((a) => ({
        ref: a.ref,
        fileRef: a.fileRef,
        ...pin(assetFiles.get(a.fileRef)!),
      })),
      dependencies: {
        vocabularies: plan.dependencies.vocabularies.map(dependency),
        implementation: dependency(plan.dependencies.implementation),
        environment: dependency(plan.dependencies.environment),
      },
    };
    const evaluation: ProfileEvaluationResult = await evaluateProfileEvaluation(
      manifest,
      { historyBytes, selectionBytes, assetFiles, dependencyFiles }
    );
    if (!evaluation.receipt)
      throw Error(
        "Pinned inputs did not produce a receipt: " +
          JSON.stringify(evaluation.issues)
      );
    const manifestBytes = Buffer.from(JSON.stringify(manifest, null, 2) + "\n"),
      receiptBytes = Buffer.from(
        JSON.stringify(evaluation.receipt, null, 2) + "\n"
      );
    if (manifestBytes.length > META || receiptBytes.length > META)
      throw Error("Generated metadata exceeds 8 MiB.");
    const inputBytes =
      historyBytes.length +
      selectionBytes.length +
      [...assetFiles.values(), ...dependencyFiles.values()].reduce(
        (n, b) => n + b.length,
        0
      );
    if (inputBytes + manifestBytes.length + receiptBytes.length > TOTAL)
      throw Error("Generated bundle exceeds 256 MiB.");
    destination = resolve(args.flags["out"]);
    directory(dirname(destination));
    mkdirSync(destination, { mode: 0o700 });
    created = true;
    for (const name of ["assets", "dependencies"])
      mkdirSync(join(destination, name), { mode: 0o700 });
    const write = (path: string, bytes: Uint8Array) =>
      writeFileSync(join(destination!, path), bytes, {
        flag: "wx",
        mode: 0o600,
      });
    write("history.json", historyBytes);
    write("selection.json", selectionBytes);
    write("evaluation.json", manifestBytes);
    write("receipt.json", receiptBytes);
    for (const [ref, bytes] of assetFiles) write("assets/" + ref, bytes);
    for (const [ref, bytes] of dependencyFiles)
      write("dependencies/" + ref, bytes);
    output.success = true;
    output.path = destination;
    output.profileStatus = evaluation.checks.profile;
    output.profileSuccess = evaluation.success;
    output.receiptCreated = true;
  } catch (error) {
    if (created && destination)
      rmSync(destination, { recursive: true, force: true });
    output.issues.push({
      code: "PREPARE.INPUT_OR_WRITE",
      message: error instanceof Error ? error.message : String(error),
    });
    process.exitCode = 2;
  }
  emit();
}

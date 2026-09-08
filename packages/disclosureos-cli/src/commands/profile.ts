import { lstatSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { createHash } from "node:crypto";
import {
  ProfileEvaluationSchema,
  evaluateProfileEvaluation,
  RELEASED_DOCUMENT_PROFILE,
  HISTORICAL_TESTIMONY_PROFILE,
  PHYSICAL_SAMPLE_PROFILE,
  INSTRUMENT_RESEARCH_PREREQUISITES_PROFILE,
} from "@disclosureos/schema/experimental/v2";
import type {
  ProfileEvaluationResult,
  ProfileEvaluation,
} from "@disclosureos/schema/experimental/v2";
import { readLocal } from "./packet";
import type { ParsedArgs } from "../utils/args";
const META = 8 * 1024 * 1024,
  TOTAL = 256 * 1024 * 1024,
  FILES = 4096;
const catalog = [
  {
    id: "instrument-research",
    title: "Instrument research",
    profile: INSTRUMENT_RESEARCH_PREREQUISITES_PROFILE,
    workflow: null,
    command: "disclosureos packet validate <packet.json>",
    useWhen:
      "Instrument observations with acquisition, calibration, timing and measurement records.",
    limits:
      "Checks documented research prerequisites; does not establish scientific validity.",
  },
  {
    id: "released-documents",
    title: "Released documents",
    profile: RELEASED_DOCUMENT_PROFILE,
    workflow: "released-documents:0.1.0",
    command: "disclosureos profile check <evaluation.json>",
    useWhen:
      "Explicitly selected public document sources and their direct extractions.",
    limits:
      "Does not authenticate releases or establish the truth of document contents.",
  },
  {
    id: "historical-testimony",
    title: "Historical testimony",
    profile: HISTORICAL_TESTIMONY_PROFILE,
    workflow: "historical-testimony:0.1.0",
    command: "disclosureos profile check <evaluation.json>",
    useWhen:
      "Selected testimony accounts, including restricted accounts and documented pseudonyms.",
    limits:
      "Does not assess witness credibility, firsthand knowledge or independent corroboration.",
  },
  {
    id: "physical-samples",
    title: "Physical samples",
    profile: PHYSICAL_SAMPLE_PROFILE,
    workflow: "physical-samples:0.1.0",
    command: "disclosureos profile check <evaluation.json>",
    useWhen:
      "Declared collected specimens with collection and custody records.",
    limits:
      "Does not cover derived samples or mixtures, or certify physical identity, custody truth, composition or origin.",
  },
] as const;
interface Output {
  command: string;
  success: boolean;
  catalog?: typeof catalog;
  manifestSha256?: string;
  selectedWorkflow?: ProfileEvaluation["workflow"];
  inspection?: {
    id: string;
    workflow: ProfileEvaluation["workflow"];
    title: string;
    profile:
      | typeof RELEASED_DOCUMENT_PROFILE
      | typeof HISTORICAL_TESTIMONY_PROFILE
      | typeof PHYSICAL_SAMPLE_PROFILE;
    assetCount: number;
    dependencyCount: number;
    declaredInputBytes: number;
    inputIntegrity: "not_checked";
    profileOutcome: "not_checked";
    receipt: "not_created";
  };
  evaluation?: ProfileEvaluationResult;
  issues: {
    code: string;
    pointer: string;
    message: string;
    nextAction: string;
  }[];
  scientificEligibility: "not_checked";
}
// Keep untrusted labels/diagnostics from controlling the terminal; JSON output retains exact data.
const safe = (value: string) =>
  value.replace(
    /[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g,
    (c) => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0")
  );
const line = (value: string) => console.log(safe(value));
const label = (value: string): string => {
  const words = value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
};
const status = (value: string) =>
  ({
    passed: "passed",
    failed: "failed",
    not_checked: "not checked",
    satisfied: "satisfied",
    missing: "missing",
    not_applicable: "not applicable",
  }[value] ?? value);
function emit(output: Output, jsonMode: boolean): void {
  if (jsonMode) {
    console.log(JSON.stringify(output, null, 2));
    return;
  }
  line("DisclosureOS experimental profile checks");
  if (output.catalog) {
    for (const p of output.catalog) {
      line("");
      line(p.title);
      line("  Use for: " + p.useWhen);
      line("  Run: " + p.command);
      if (p.workflow) line("  Manifest workflow: " + p.workflow);
      line("  Limit: " + p.limits);
    }
    line("");
    line(
      "Choose the profile from the source records; no automatic selection or aggregate score is applied."
    );
    return;
  }
  if (output.inspection) {
    const i = output.inspection;
    line("Selected: " + i.title);
    line("Workflow: " + i.workflow);
    line(
      `Declared files: ${i.assetCount} source files, ${i.dependencyCount} dependencies, history and selection`
    );
    line(
      "Manifest inspected. Input integrity and profile outcome: not checked. No receipt created."
    );
  }
  const evaluation = output.evaluation;
  if (evaluation) {
    if (!output.inspection) {
      line(
        "Selected: " +
          (catalog.find((p) => p.workflow === output.selectedWorkflow)?.title ??
            "Manifest not accepted")
      );
      if (output.selectedWorkflow) line("Workflow: " + output.selectedWorkflow);
    }
    line("Input integrity: " + status(evaluation.checks.external));
    line("Profile outcome: " + status(evaluation.checks.profile));
    line(
      "Receipt: " + (evaluation.receipt ? "created (unsigned)" : "not created")
    );
    const p = evaluation.profile;
    if (p) {
      const rows =
        "documents" in p
          ? p.documents
          : "accounts" in p
          ? p.accounts
          : p.samples;
      for (const row of rows) {
        line("");
        line(
          ("sourceRef" in row ? row.sourceRef : row.sampleId) +
            ": " +
            status(row.status)
        );
        for (const r of row.requirements) {
          line(
            `  ${r.importance === "required" ? "Required" : "Recommended"} | ${
              r.label
            }: ${status(r.status)}`
          );
          line("    " + r.reason);
          for (const issue of r.issues) line("    Next: " + issue.nextAction);
          if (r.blockedBy.length)
            line("    Blocked by: " + r.blockedBy.map(label).join(", "));
        }
      }
      if (!rows.length)
        for (const issue of p.issues) {
          line(issue.code + " " + issue.pointer + ": " + issue.message);
          line("  Next: " + issue.nextAction);
        }
      line("");
      line("Profile limits:");
      for (const [key, value] of Object.entries(p))
        if (value === "not_checked") line("  " + label(key) + ": not checked");
    }
    if (!p)
      for (const issue of evaluation.issues)
        line(issue.code + " " + issue.pointer + ": " + issue.message);
    line(
      "A receipt preserves a result; it does not make a failed or unchecked profile pass."
    );
    line("Implementation and environment execution: not attested.");
  }
  for (const issue of output.issues) {
    line(issue.code + " " + issue.pointer + ": " + issue.message);
    line("  Next: " + issue.nextAction);
  }
  line(
    "Scientific eligibility: not checked. Use --json for the full result and receipt."
  );
}
function directory(path: string): void {
  const s = lstatSync(path);
  if (!s.isDirectory() || s.isSymbolicLink())
    throw Error("Expected a real directory.");
}
export async function profile(args: ParsedArgs): Promise<void> {
  if (args.flags["help"]) {
    console.log(`DisclosureOS experimental profile checks

  disclosureos profile list [--json]
  disclosureos profile inspect <evaluation.json> [--json]
  disclosureos profile check <evaluation.json> [--json]

The manifest explicitly selects released-documents:0.1.0, historical-testimony:0.1.0
or physical-samples:0.1.0. Instrument research uses packet validate.
Inspect reads only the manifest. Check reads history.json, selection.json,
assets/<fileRef> and dependencies/<ref> beside it. No network access or supplied-code execution.
Limits: 8 MiB metadata, 4096 input files, 256 MiB total bytes.
Exit: 0 listed/inspected or profile passed with receipt, 1 failed/unchecked checks,
2 usage or unreadable/malformed manifest. Full JSON may contain restricted metadata;
apply access policy before sharing. No automatic profile selection or aggregate score.`);
    return;
  }
  const output: Output = {
    command: args.subcommand,
    success: false,
    issues: [],
    scientificEligibility: "not_checked",
  };
  const finish = (code: number) => {
    emit(output, !!args.flags["json"]);
    if (code) process.exitCode = code;
  };
  if (
    !["list", "inspect", "check"].includes(args.subcommand) ||
    args.positional.length !== (args.subcommand === "list" ? 0 : 1) ||
    Object.keys(args.flags).some((f) => !["json", "help"].includes(f))
  ) {
    output.issues.push({
      code: "CLI.USAGE",
      pointer: "",
      message:
        "Use profile list or profile inspect|check <evaluation.json> [--json].",
      nextAction:
        "Run disclosureos profile --help for explicit workflow and input layout.",
    });
    finish(2);
    return;
  }
  if (args.subcommand === "list") {
    output.catalog = catalog;
    output.success = true;
    finish(0);
    return;
  }
  let input: unknown, manifestBytes: Uint8Array, path: string;
  try {
    path = resolve(args.positional[0]!);
    manifestBytes = readLocal(path, META);
    output.manifestSha256 = createHash("sha256")
      .update(manifestBytes)
      .digest("hex");
    input = JSON.parse(
      new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(
        manifestBytes
      )
    ) as unknown;
  } catch {
    output.issues.push({
      code: "CLI.MANIFEST",
      pointer: "",
      message:
        "Cannot read the manifest as regular-file UTF-8 JSON within 8 MiB.",
      nextAction:
        "Supply a local evaluation manifest without a BOM or symlink; keep the file within the metadata limit.",
    });
    finish(2);
    return;
  }
  const parsed = ProfileEvaluationSchema.safeParse(input),
    preflight = await evaluateProfileEvaluation(input);
  if (!parsed.success || preflight.checks.semantic === "failed") {
    output.evaluation = preflight;
    finish(1);
    return;
  }
  output.selectedWorkflow = parsed.data.workflow;
  const manifest = parsed.data,
    dependencies = [
      ...manifest.dependencies.vocabularies,
      manifest.dependencies.implementation,
      manifest.dependencies.environment,
    ];
  const selected = catalog.find((p) => p.workflow === manifest.workflow)!;
  if (args.subcommand === "inspect") {
    // All schema-accepted workflow literals have a catalog entry with a concrete provenance profile.
    output.inspection = {
      id: manifest.id,
      workflow: manifest.workflow,
      title: selected.title,
      profile:
        manifest.workflow === "released-documents:0.1.0"
          ? RELEASED_DOCUMENT_PROFILE
          : manifest.workflow === "historical-testimony:0.1.0"
          ? HISTORICAL_TESTIMONY_PROFILE
          : PHYSICAL_SAMPLE_PROFILE,
      assetCount: manifest.assets.length,
      dependencyCount: dependencies.length,
      declaredInputBytes:
        manifest.history.byteLength +
        manifest.selection.byteLength +
        manifest.assets.reduce((n, a) => n + a.byteLength, 0) +
        dependencies.reduce((n, d) => n + d.byteLength, 0),
      inputIntegrity: "not_checked",
      profileOutcome: "not_checked",
      receipt: "not_created",
    };
    output.success = true;
    finish(0);
    return;
  }
  if (
    manifest.assets.length + dependencies.length + 2 > FILES ||
    manifestBytes.length +
      manifest.history.byteLength +
      manifest.selection.byteLength +
      manifest.assets.reduce((n, a) => n + a.byteLength, 0) +
      dependencies.reduce((n, d) => n + d.byteLength, 0) >
      TOTAL
  ) {
    output.issues.push({
      code: "CLI.LIMIT",
      pointer: "",
      message: "Declared inputs exceed the 4096-file or 256 MiB budget.",
      nextAction:
        "Use a bounded evaluation input set; do not omit necessary records merely to make a profile pass.",
    });
    finish(1);
    return;
  }
  const root = dirname(path);
  let remaining = TOTAL - manifestBytes.length;
  try {
    directory(root);
  } catch {
    output.issues.push({
      code: "CLI.DIRECTORY",
      pointer: "",
      message: "The bundle root must be a real directory.",
      nextAction: "Use a local directory without a symlink root.",
    });
    finish(1);
    return;
  }
  const read = (relative: string, limit: number): Uint8Array | undefined => {
    try {
      const bytes = readLocal(join(root, relative), Math.min(remaining, limit));
      remaining -= bytes.length;
      return bytes;
    } catch {
      output.issues.push({
        code: "CLI.INPUT_FILE",
        pointer: relative,
        message:
          "Cannot read this input as a regular file within its byte budget.",
        nextAction:
          "Provide the original pinned local file, respecting access restrictions; do not substitute another file.",
      });
      return undefined;
    }
  };
  const historyBytes = read("history.json", META),
    selectionBytes = read("selection.json", META);
  const assetFiles = new Map<string, Uint8Array>(),
    dependencyFiles = new Map<string, Uint8Array>();
  for (const [name, entries, map] of [
    ["assets", manifest.assets.map((a) => a.fileRef), assetFiles],
    ["dependencies", dependencies.map((d) => d.ref), dependencyFiles],
  ] as const) {
    try {
      directory(join(root, name));
    } catch {
      output.issues.push({
        code: "CLI.DIRECTORY",
        pointer: name,
        message: "Expected a real input directory.",
        nextAction:
          "Keep the assets and dependencies directories beside the manifest, including an empty assets directory when no files are declared.",
      });
      continue;
    }
    for (const ref of entries) {
      const bytes = read(name + "/" + ref, remaining);
      if (bytes) map.set(ref, bytes);
    }
  }
  output.evaluation = await evaluateProfileEvaluation(input, {
    ...(historyBytes ? { historyBytes } : {}),
    ...(selectionBytes ? { selectionBytes } : {}),
    assetFiles,
    dependencyFiles,
  });
  output.success = output.evaluation.success && output.issues.length === 0;
  finish(output.success ? 0 : 1);
}

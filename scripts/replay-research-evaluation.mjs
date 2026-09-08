import { readLocal, directory } from "./evaluation-local-files.mjs";
import { resolve, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import {
  ResearchEvaluationSchema,
  ReproductionPacketSchema,
  evaluateResearchEvaluation,
} from "../packages/disclosureos-schema/dist/experimental/v2/index.js";
const METADATA_LIMIT = 8 * 1024 * 1024,
  TOTAL_LIMIT = 256 * 1024 * 1024,
  FILE_LIMIT = 4096;
const decode = (b) =>
  JSON.parse(
    new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(b)
  );
export async function replayResearchEvaluation(folder) {
  const result = {
    success: false,
    checks: {
      receiptIntegrity: "not_checked",
      requestReplay: "not_checked",
      outputReplay: "not_checked",
    },
    evaluationStatus: "not_checked",
    evaluationSuccess: null,
    issues: [],
    limits: {
      suppliedCodeExecution: "not_performed",
      environmentExecution: "not_attested",
      vocabularyMembership: "not_checked",
      scientificEligibility: "not_checked",
    },
  };
  try {
    const root = resolve(folder);
    directory(root);
    // The verifier and parser consume the same captured bytes; the receipt is not reread.
    const receiptBytes = readLocal(join(root, "receipt.json"), METADATA_LIMIT);
    const verification = spawnSync(
      "python3",
      [
        fileURLToPath(new URL("./verify-research-receipt.py", import.meta.url)),
        "-",
      ],
      {
        input: receiptBytes,
        encoding: "utf8",
        maxBuffer: 1024 * 1024,
        timeout: 30000,
      }
    );
    if (verification.error || verification.signal) {
      result.issues.push({
        code: "REPLAY.VERIFIER_UNAVAILABLE",
        message:
          verification.error?.message ?? "Independent verifier was interrupted",
      });
      return result;
    }
    if (verification.status !== 0) {
      result.checks.receiptIntegrity = "failed";
      result.issues.push({
        code: "REPLAY.INTEGRITY",
        message:
          verification.stdout.trim() || "Independent verification failed",
      });
      return result;
    }
    const integrity = JSON.parse(verification.stdout);
    if (integrity.success !== true)
      throw Error("Independent verifier did not confirm receipt integrity");
    result.checks.receiptIntegrity = "passed";
    const receipt = decode(receiptBytes),
      request = JSON.parse(receipt.requestJson);
    const manifest = ResearchEvaluationSchema.parse(request.manifest);
    const packetBytes = readLocal(join(root, "packet.json"), METADATA_LIMIT);
    const packet = ReproductionPacketSchema.parse(decode(packetBytes));
    const dependencies = [
      ...manifest.dependencies.vocabularies,
      manifest.dependencies.implementation,
      manifest.dependencies.environment,
    ];
    if (packet.files.length + dependencies.length > FILE_LIMIT)
      throw Error("Replay exceeds 4096-file limit");
    for (const entries of [
      packet.files.map((f) => ({ ref: f.id, ...f })),
      dependencies,
    ]) {
      const seen = new Set();
      for (const e of entries) {
        if (seen.has(e.ref)) throw Error("Duplicate file reference");
        seen.add(e.ref);
      }
    }
    const declared =
      packet.files.reduce((n, f) => n + f.byteLength, 0) +
      dependencies.reduce((n, f) => n + f.byteLength, 0) +
      receiptBytes.length +
      packetBytes.length;
    if (declared > TOTAL_LIMIT)
      throw Error("Replay exceeds 256 MiB byte budget");
    directory(join(root, "files"));
    directory(join(root, "dependencies"));
    let remaining = TOTAL_LIMIT - receiptBytes.length - packetBytes.length;
    const load = (name, refs) =>
      new Map(
        refs.map((ref) => {
          const bytes = readLocal(join(root, name, ref), remaining);
          remaining -= bytes.length;
          return [ref, bytes];
        })
      );
    const files = load(
        "files",
        packet.files.map((f) => f.id)
      ),
      dependencyFiles = load(
        "dependencies",
        dependencies.map((d) => d.ref)
      );
    const replay = await evaluateResearchEvaluation(manifest, {
      packetBytes,
      files,
      dependencyFiles,
    });
    result.evaluationStatus = replay.checks.evaluation;
    result.evaluationSuccess =
      replay.checks.evaluation === "not_checked"
        ? null
        : replay.checks.evaluation === "passed";
    if (!replay.receipt) {
      result.issues.push({
        code: "REPLAY.NO_RECEIPT",
        message: "Current evaluation could not produce a receipt",
        diagnostics: replay.issues,
      });
      return result;
    }
    const same = (name) =>
      receipt[name + "Json"] === replay.receipt[name + "Json"] &&
      receipt[name].sha256 === replay.receipt[name].sha256 &&
      receipt[name].byteLength === replay.receipt[name].byteLength;
    result.checks.requestReplay = same("request") ? "passed" : "failed";
    result.checks.outputReplay = same("output") ? "passed" : "failed";
    if (!same("request"))
      result.issues.push({
        code: "REPLAY.REQUEST_MISMATCH",
        message:
          "Preserved request differs from the current fixed workflow, rules or serialization",
      });
    if (!same("output"))
      result.issues.push({
        code: "REPLAY.OUTPUT_MISMATCH",
        message: "Computed output differs from the preserved result",
      });
    result.success = same("request") && same("output");
  } catch (error) {
    result.issues.push({
      code: "REPLAY.INPUT",
      message: error instanceof Error ? error.message : String(error),
    });
  }
  return result;
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  if (process.argv.length !== 3 || process.argv[2].startsWith("-")) {
    console.log(
      JSON.stringify({
        success: false,
        error:
          "Usage: node scripts/replay-research-evaluation.mjs <bundle-directory>",
      })
    );
    process.exitCode = 1;
  } else {
    const result = await replayResearchEvaluation(process.argv[2]);
    console.log(JSON.stringify(result, null, 2));
    if (!result.success) process.exitCode = 1;
  }
}

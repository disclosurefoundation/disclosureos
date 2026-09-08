import { readLocal, directory } from "./evaluation-local-files.mjs";
import { resolve, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import {
  AssessmentSummaryEvaluationSchema,
  evaluateAssessmentSummaryEvaluation,
} from "../packages/disclosureos-scoring/dist/experimental/v2/index.js";
const META = 8 * 1024 * 1024,
  TOTAL = 256 * 1024 * 1024,
  FILES = 4096;
export async function replayAssessmentSummary(folder) {
  const result = {
    success: false,
    checks: {
      receiptIntegrity: "not_checked",
      requestReplay: "not_checked",
      outputReplay: "not_checked",
    },
    summaryStatus: "not_checked",
    summarySuccess: null,
    issues: [],
    limits: {
      sourceArtifactIntegrity: "not_checked",
      statisticalIndependence: "not_checked",
      scientificEligibility: "not_checked",
      vocabularyMembership: "not_checked",
      implementationExecution: "not_attested",
      environmentExecution: "not_attested",
    },
  };
  try {
    const root = resolve(folder);
    directory(root);
    const receiptBytes = readLocal(join(root, "receipt.json"), META);
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
        code: "SUMMARY_REPLAY.VERIFIER_UNAVAILABLE",
        message:
          verification.error?.message ?? "Independent verifier interrupted",
      });
      return result;
    }
    if (verification.status !== 0) {
      result.checks.receiptIntegrity = "failed";
      result.issues.push({
        code: "SUMMARY_REPLAY.INTEGRITY",
        message: verification.stdout.trim() || "Receipt integrity failed",
      });
      return result;
    }
    if (JSON.parse(verification.stdout).success !== true)
      throw Error("Verifier did not confirm integrity");
    result.checks.receiptIntegrity = "passed";
    const receipt = JSON.parse(
      new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(
        receiptBytes
      )
    );
    if (receipt.format !== "disclosureos-assessment-summary-receipt:0.1.0")
      throw Error("Expected assessment-summary receipt");
    const request = JSON.parse(receipt.requestJson),
      manifest = AssessmentSummaryEvaluationSchema.parse(request.manifest);
    const dependencies = [
      ...manifest.dependencies.vocabularies,
      manifest.dependencies.implementation,
      manifest.dependencies.environment,
    ];
    if (dependencies.length + 1 > FILES)
      throw Error("Replay exceeds 4096-file limit");
    if (new Set(dependencies.map((d) => d.ref)).size !== dependencies.length)
      throw Error("Duplicate dependency references");
    const declared =
      receiptBytes.length +
      manifest.history.byteLength +
      dependencies.reduce((n, d) => n + d.byteLength, 0);
    if (declared > TOTAL) throw Error("Replay exceeds 256 MiB budget");
    const historyBytes = readLocal(join(root, "history.json"), META);
    directory(join(root, "dependencies"));
    let remaining = TOTAL - receiptBytes.length - historyBytes.length;
    const dependencyFiles = new Map(
      dependencies.map((d) => {
        const bytes = readLocal(join(root, "dependencies", d.ref), remaining);
        remaining -= bytes.length;
        return [d.ref, bytes];
      })
    );
    const evaluation = await evaluateAssessmentSummaryEvaluation(manifest, {
      historyBytes,
      dependencyFiles,
    });
    result.summaryStatus = evaluation.checks.summary;
    result.summarySuccess =
      evaluation.checks.summary === "not_checked"
        ? null
        : evaluation.checks.summary === "passed";
    if (!evaluation.receipt) {
      result.issues.push({
        code: "SUMMARY_REPLAY.NO_RECEIPT",
        message: "Current summary evaluation could not produce a receipt",
        diagnostics: evaluation.issues,
      });
      return result;
    }
    const matches = (name) =>
      receipt[name + "Json"] === evaluation.receipt[name + "Json"] &&
      receipt[name].sha256 === evaluation.receipt[name].sha256 &&
      receipt[name].byteLength === evaluation.receipt[name].byteLength;
    for (const name of ["request", "output"]) {
      result.checks[name + "Replay"] = matches(name) ? "passed" : "failed";
      if (!matches(name))
        result.issues.push({
          code: "SUMMARY_REPLAY." + name.toUpperCase() + "_MISMATCH",
          message: "Current " + name + " differs from the preserved receipt",
        });
    }
    result.success = matches("request") && matches("output");
  } catch (error) {
    result.issues.push({
      code: "SUMMARY_REPLAY.INPUT",
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
          "Usage: node scripts/replay-assessment-summary.mjs <bundle-directory>",
      })
    );
    process.exitCode = 1;
  } else {
    const result = await replayAssessmentSummary(process.argv[2]);
    console.log(JSON.stringify(result, null, 2));
    if (!result.success) process.exitCode = 1;
  }
}

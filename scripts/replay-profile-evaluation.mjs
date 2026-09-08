import { readLocal, directory } from "./evaluation-local-files.mjs";
import { resolve, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import {
  ProfileEvaluationSchema,
  evaluateProfileEvaluation,
} from "../packages/disclosureos-schema/dist/experimental/v2/index.js";
const META = 8 * 1024 * 1024,
  TOTAL = 256 * 1024 * 1024,
  FILES = 4096;
export async function replayProfileEvaluation(folder) {
  const result = {
    success: false,
    checks: {
      receiptIntegrity: "not_checked",
      requestReplay: "not_checked",
      outputReplay: "not_checked",
    },
    profileStatus: "not_checked",
    profileSuccess: null,
    issues: [],
    limits: {
      unselectedArtifactIntegrity: "not_checked",
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
        code: "PROFILE_REPLAY.VERIFIER_UNAVAILABLE",
        message:
          verification.error?.message ?? "Independent verifier interrupted",
      });
      return result;
    }
    if (verification.status !== 0) {
      result.checks.receiptIntegrity = "failed";
      result.issues.push({
        code: "PROFILE_REPLAY.INTEGRITY",
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
    if (receipt.format !== "disclosureos-profile-evaluation-receipt:0.1.0")
      throw Error("Expected profile-evaluation receipt");
    const request = JSON.parse(receipt.requestJson),
      manifest = ProfileEvaluationSchema.parse(request.manifest);
    const dependencies = [
      ...manifest.dependencies.vocabularies,
      manifest.dependencies.implementation,
      manifest.dependencies.environment,
    ];
    if (dependencies.length + manifest.assets.length + 2 > FILES)
      throw Error("Replay exceeds 4096-file limit");
    if (new Set(dependencies.map((d) => d.ref)).size !== dependencies.length)
      throw Error("Duplicate dependency references");
    const declared =
      receiptBytes.length +
      manifest.history.byteLength +
      manifest.selection.byteLength +
      manifest.assets.reduce((n, a) => n + a.byteLength, 0) +
      dependencies.reduce((n, d) => n + d.byteLength, 0);
    if (declared > TOTAL) throw Error("Replay exceeds 256 MiB budget");
    const historyBytes = readLocal(join(root, "history.json"), META);
    const selectionBytes = readLocal(join(root, "selection.json"), META);
    if (
      new Set(manifest.assets.map((a) => a.ref)).size !==
        manifest.assets.length ||
      new Set(manifest.assets.map((a) => a.fileRef)).size !==
        manifest.assets.length
    )
      throw Error("Duplicate asset references");
    directory(join(root, "assets"));
    directory(join(root, "dependencies"));
    let remaining =
      TOTAL - receiptBytes.length - historyBytes.length - selectionBytes.length;
    const dependencyFiles = new Map(
      dependencies.map((d) => {
        const bytes = readLocal(join(root, "dependencies", d.ref), remaining);
        remaining -= bytes.length;
        return [d.ref, bytes];
      })
    );
    const assetFiles = new Map(
      manifest.assets.map((a) => {
        const bytes = readLocal(join(root, "assets", a.fileRef), remaining);
        remaining -= bytes.length;
        return [a.fileRef, bytes];
      })
    );
    const evaluation = await evaluateProfileEvaluation(manifest, {
      historyBytes,
      selectionBytes,
      assetFiles,
      dependencyFiles,
    });
    result.profileStatus = evaluation.checks.profile;
    result.profileSuccess =
      evaluation.checks.profile === "not_checked"
        ? null
        : evaluation.checks.profile === "passed";
    if (!evaluation.receipt) {
      result.issues.push({
        code: "PROFILE_REPLAY.NO_RECEIPT",
        message: "Current profile evaluation could not produce a receipt",
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
          code: "PROFILE_REPLAY." + name.toUpperCase() + "_MISMATCH",
          message: "Current " + name + " differs from the preserved receipt",
        });
    }
    result.success = matches("request") && matches("output");
  } catch (error) {
    result.issues.push({
      code: "PROFILE_REPLAY.INPUT",
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
          "Usage: node scripts/replay-profile-evaluation.mjs <bundle-directory>",
      })
    );
    process.exitCode = 1;
  } else {
    const result = await replayProfileEvaluation(process.argv[2]);
    console.log(JSON.stringify(result, null, 2));
    if (!result.success) process.exitCode = 1;
  }
}

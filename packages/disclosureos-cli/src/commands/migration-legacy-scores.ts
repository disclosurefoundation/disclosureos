import { createHash } from "node:crypto";
import { MigrationLegacyScoresSchema } from "@disclosureos/schema/experimental/v2";
import {
  CompletenessResultSchema,
  ScoreResultSchema,
  SCORING_SCHEMA_VERSION,
} from "@disclosureos/scoring";
import type { ParsedArgs } from "../utils/args";
import { readLocal } from "./packet";
import { reviewedJson } from "./migration-review";
const hash = (bytes: Uint8Array | string) =>
  createHash("sha256").update(bytes).digest("hex");
const archive = (bytes: Uint8Array) => ({
  sha256: hash(bytes),
  byteLength: bytes.byteLength,
  encoding: "base64",
  bytes: Buffer.from(bytes).toString("base64"),
});

export function preserveLegacyScores(
  source: Uint8Array,
  planBytes: Uint8Array
) {
  const plan = MigrationLegacyScoresSchema.parse(reviewedJson(planBytes));
  const sourceDigest = hash(source),
    reviewDigest = hash(planBytes);
  if (
    sourceDigest !== plan.source.sha256 ||
    source.byteLength !== plan.source.byteLength
  )
    throw new Error("Legacy score source byte pin mismatch");
  const input = reviewedJson(source);
  const rows = Array.isArray(input) ? input : [input];
  if (!rows.length || rows.length > 10000)
    throw new Error("Legacy score source requires 1 to 10000 rows");
  const pointers = rows.map((_, i) => (Array.isArray(input) ? `/${i}` : ""));
  const decisions = new Map<string, (typeof plan.decisions)[number]>();
  const knownPointers = new Set(pointers);
  for (const decision of plan.decisions) {
    if (!knownPointers.has(decision.sourcePointer))
      throw new Error("Decision names an unknown whole-row source pointer");
    if (decisions.has(decision.sourcePointer))
      throw new Error("Duplicate decision for legacy score row");
    decisions.set(decision.sourcePointer, decision);
  }
  const records = rows.map((data, index) => {
    const sourcePointer = pointers[index]!;
    const decision = decisions.get(sourcePointer);
    const legacy = { format: "standalone_legacy_score_input", data };
    if (!decision)
      return {
        sourcePointer,
        disposition: "pending_review",
        legacy,
        reasons: [
          "No explicit output contract, methodology version or observation association supplied.",
        ],
      };
    const reasons: string[] = [];
    // Freeze supported historical output contracts rather than silently adopting future shapes.
    if (
      decision.outputContractVersion !== "2.0.0" ||
      SCORING_SCHEMA_VERSION !== "2.0.0"
    )
      reasons.push(
        "Unsupported historical scoring output contract; retained without conversion."
      );
    const validation = reasons.length
      ? undefined
      : decision.resultKind === "compellingness"
      ? ScoreResultSchema.safeParse(data)
      : CompletenessResultSchema.safeParse(data);
    if (validation && !validation.success)
      reasons.push(
        ...validation.error.issues.map(
          (i) => `${i.path.join(".")}: ${i.message}`
        )
      );
    if (
      decision.resultKind === "compellingness" &&
      data &&
      typeof data === "object" &&
      !Array.isArray(data) &&
      (data as Record<string, unknown>).scoringVersion !==
        decision.methodologyVersion
    )
      reasons.push(
        "Declared methodology version does not match the stored scoringVersion"
      );
    if (reasons.length)
      return {
        sourcePointer,
        disposition: "quarantined",
        legacy,
        decision,
        reasons,
      };
    const observationIdentity = `legacy-${hash(
      JSON.stringify([plan.namespace, decision.sourceId])
    )}`;
    return {
      sourcePointer,
      disposition: "preserved_historical",
      legacy,
      decision,
      reasons,
      historicalOutput: {
        kind: "legacy_score_history",
        schemaVersion: "0.1.0",
        id: `legacy-score-${hash(
          JSON.stringify([
            plan.namespace,
            sourceDigest,
            sourcePointer,
            reviewDigest,
          ])
        )}`,
        association: {
          sourceId: decision.sourceId,
          observationIdentity,
          verification: "declared_not_verified",
        },
        resultKind: decision.resultKind,
        outputContract: {
          package: "@disclosureos/scoring",
          version: decision.outputContractVersion,
        },
        methodologyVersion: decision.methodologyVersion,
        // Keep original values, including additional fields. Never substitute stripping parser output.
        value: data,
        validation: "historical_output_shape_only",
        calculation: "not_recomputed",
        scientificValidity: "not_checked",
        comparableToV2: false,
        rankingEligibility: "excluded",
      },
    };
  });
  return {
    kind: "legacy_score_preservation_report",
    schemaVersion: "0.1.0",
    policy: "legacy-score-preservation:0.1.0",
    namespace: plan.namespace,
    source: archive(source),
    review: archive(planBytes),
    reviewedBy: plan.reviewedBy,
    reviewedAt: plan.reviewedAt,
    reviewerIdentity: "not_authenticated",
    records,
    counts: {
      input: rows.length,
      preservedHistorical: records.filter(
        (r) => r.disposition === "preserved_historical"
      ).length,
      pendingReview: records.filter((r) => r.disposition === "pending_review")
        .length,
      quarantined: records.filter((r) => r.disposition === "quarantined")
        .length,
      v2Evaluations: 0,
      indexImported: 0,
    },
    rankingPolicy: "exclude_legacy_scores_from_v2_rankings",
  };
}
export function legacyScores(args: ParsedArgs) {
  const usage =
    "migrate legacy-scores <scores.json> <preservation-plan.json> [--json]";
  if (args.flags["help"]) {
    console.log(usage);
    return;
  }
  try {
    if (
      args.positional.length !== 2 ||
      Object.keys(args.flags).some((k) => k !== "json")
    )
      throw new Error(usage);
    const report = preserveLegacyScores(
      readLocal(args.positional[0]!, 8 * 1024 * 1024),
      readLocal(args.positional[1]!, 2 * 1024 * 1024)
    );
    if (args.flags["json"]) console.log(JSON.stringify(report, null, 2));
    else
      console.log(
        `Legacy scores: ${report.counts.preservedHistorical} historical outputs preserved, ${report.counts.pendingReview} pending review, ${report.counts.quarantined} quarantined, 0 v2 evaluations.\nHistorical values remain excluded from v2 rankings. Use --json for private retained data and declared associations.`
      );
    if (report.counts.quarantined || report.counts.pendingReview)
      process.exitCode = 1;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (args.flags["json"])
      console.log(
        JSON.stringify({
          success: false,
          stage: "legacy_score_input",
          error: message,
        })
      );
    else console.error(message);
    process.exitCode = 2;
  }
}

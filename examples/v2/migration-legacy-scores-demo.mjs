import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";
export function migrationLegacyScoresExample() {
  const scores = [
    {
      total: 1,
      present: 0,
      percentage: 0,
      missing: ["temporal.date"],
      requiredTotal: 1,
      requiredPresent: 0,
      requiredPercentage: 0,
      annotation:
        "Synthetic historical output; intentionally not recalculated.",
    },
    {
      score: 0,
      range: { low: 0, high: 0 },
      contested: false,
      components: { technology: 0, biologics: 0, origin: 0 },
      weights: { technology: 0.45, biologics: 0.35, origin: 0.2 },
      scoringVersion: "2.0.0",
    },
  ];
  const source = Buffer.from(JSON.stringify(scores, null, 2) + "\n");
  const plan = {
    kind: "legacy_score_preservation_plan",
    schemaVersion: "0.1.0",
    namespace: "synthetic",
    source: {
      sha256: createHash("sha256").update(source).digest("hex"),
      byteLength: source.byteLength,
    },
    reviewedBy: "Synthetic fixture reviewer",
    reviewedAt: "2026-09-08T00:00:00Z",
    decisions: scores.map((_, i) => ({
      sourcePointer: `/${i}`,
      sourceId: "synthetic-observation",
      resultKind: i ? "compellingness" : "completeness",
      outputContractVersion: "2.0.0",
      methodologyVersion: i ? "2.0.0" : "synthetic-field-paths:1",
      rationale:
        "Synthetic declared association and version for adapter testing only.",
    })),
  };
  return { scores, source, plan };
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  if (process.argv.length !== 3)
    throw new Error(
      "Usage: node migration-legacy-scores-demo.mjs <new-directory>"
    );
  const out = resolve(process.argv[2]);
  mkdirSync(out, { mode: 0o700 });
  const example = migrationLegacyScoresExample();
  writeFileSync(join(out, "scores.json"), example.source, {
    flag: "wx",
    mode: 0o600,
  });
  writeFileSync(
    join(out, "plan.json"),
    JSON.stringify(example.plan, null, 2) + "\n",
    { flag: "wx", mode: 0o600 }
  );
  console.log(out);
}

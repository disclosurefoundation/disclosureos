import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  mkdtempSync,
  readFileSync,
  writeFileSync,
  readdirSync,
  rmSync,
  existsSync,
  statSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import { migrationReviewExample } from "../examples/v2/migration-review-demo.mjs";
import { migrationLegacyScoresExample } from "../examples/v2/migration-legacy-scores-demo.mjs";
const defaultCli = fileURLToPath(
  new URL("../packages/disclosureos-cli/dist/index.js", import.meta.url)
);
const pin = (b) => ({
  sha256: createHash("sha256").update(b).digest("hex"),
  byteLength: b.length,
});
const json = (v) => Buffer.from(JSON.stringify(v, null, 2) + "\n");
function files(root, prefix = "") {
  return readdirSync(join(root, prefix))
    .sort()
    .flatMap((name) => {
      const path = prefix ? `${prefix}/${name}` : name;
      return statSync(join(root, path)).isDirectory()
        ? files(root, path)
        : [{ path, ...pin(readFileSync(join(root, path))) }];
    });
}
/** Synthetic software acceptance through the actual CLI, also runnable against a fresh installed package. */
export function runMigrationCloseout(cli = defaultCli) {
  cli = resolve(cli);
  const root = mkdtempSync(join(tmpdir(), "disclosureos-wp09-closeout-"));
  const save = (name, value) => {
    const path = join(root, name);
    writeFileSync(path, Buffer.isBuffer(value) ? value : json(value), {
      mode: 0o600,
    });
    return path;
  };
  const run = (args, expected = 0) => {
    const result = spawnSync(
      process.execPath,
      [cli, "migrate", ...args, "--json"],
      { encoding: "utf8", timeout: 30000, maxBuffer: 32 * 1024 * 1024 }
    );
    assert.equal(
      result.status,
      expected,
      `${args[0]}: ${result.stdout}\n${result.stderr}`
    );
    return JSON.parse(result.stdout);
  };
  const decisionPlan = (ledger) => {
    const raw = readFileSync(join(ledger, "ledger.json")),
      data = JSON.parse(raw);
    return {
      kind: "legacy_migration_resolution",
      schemaVersion: "0.1.0",
      ledger: pin(raw),
      decidedBy: "Synthetic closeout reviewer",
      decidedAt: "2026-09-08T00:00:00Z",
      decisions: data.identities.map((item) => ({
        identity: item.identity,
        action: "select",
        revision: item.revisions.at(-1).sha256,
        rationale:
          "Explicit synthetic choice of an exact revision; no scientific preference.",
      })),
    };
  };
  try {
    const v = migrationReviewExample();
    v.legacy.internalNotes =
      "Synthetic private note retained only in legacy input.";
    v.legacy.sensorEvidence = {
      sensors: [
        {
          id: "radar",
          sensorType: "ground_radar",
          detectionMethod: "radar_primary",
          sensorRef: "synthetic:unversioned",
          calibrated: true,
          readings: { velocity: 0 },
        },
      ],
    };
    const second = { ...structuredClone(v.legacy), id: "synthetic-unknown" };
    const source = json([v.legacy, second]),
      sourcePath = save("source.json", source);
    const dry = run(["dry-run", sourcePath, "--id", v.plan.namespace]);
    assert.deepEqual(dry.counts, {
      input: 2,
      candidates: 2,
      quarantined: 0,
      migrated: 0,
    });
    const inventory = run(
      ["compatibility", sourcePath, "--id", v.plan.namespace],
      1
    );
    assert.equal(
      inventory.counts.fields,
      inventory.counts.mapped +
        inventory.counts.retainedWithoutConversion +
        inventory.counts.unresolved
    );
    assert.equal(inventory.counts.unresolvedSensorReferences, 2);
    const unknownDecisions = v.plan.decisions.map((d) => ({
      ...d,
      sourceId: second.id,
      value: { state: "unknown", reason: "unavailable" },
      ...(d.field === "position" ? { frames: [] } : {}),
      rationale:
        "Synthetic explicit unknown; retained legacy value is not silently erased.",
    }));
    const plan = {
      ...v.plan,
      source: pin(source),
      decisions: [...v.plan.decisions, ...unknownDecisions],
    };
    const reviewPath = save("review.json", plan);
    const reviewed = run(["review", sourcePath, reviewPath]);
    assert.equal(
      reviewed.records[0].candidate.observation.eventTime.value.value,
      "1900-01-01"
    );
    assert.equal(
      reviewed.records[0].candidate.observation.position.value.latitude,
      0
    );
    assert.equal(
      reviewed.records[1].candidate.observation.position.state,
      "unknown"
    );
    assert.deepEqual(
      reviewed.records.map((r) => r.legacy.data),
      [v.legacy, second]
    );
    const bundleA = join(root, "bundle-a"),
      bundleB = join(root, "bundle-b");
    run(["export", sourcePath, reviewPath, "--out", bundleA]);
    run(["verify", bundleA]);
    const revised = structuredClone(plan);
    revised.decisions[0].rationale += " Alternative review revision.";
    const revisionPath = save("review-revision.json", revised);
    run(["export", sourcePath, revisionPath, "--out", bundleB]);
    const ledger = join(root, "ledger");
    run(["ledger", bundleA, bundleB, bundleA, "--out", ledger], 1);
    run(["ledger-verify", ledger], 1);
    const decisions = decisionPlan(ledger),
      decisionsPath = save("decisions.json", decisions);
    const deferred = save("deferred.json", { ...decisions, decisions: [] });
    run(["resolve", ledger, deferred], 1);
    const store = join(root, "store");
    run(["apply", ledger, deferred, "--out", store], 2);
    assert.equal(existsSync(store), false);
    const resolved = run(["resolve", ledger, decisionsPath]);
    assert.equal(resolved.counts.input, 4);
    assert.equal(resolved.counts.selectedCandidates, 2);
    assert.equal(
      resolved.counts.input,
      resolved.counts.selectedRows +
        resolved.counts.notSelectedRows +
        resolved.counts.deferredRows +
        resolved.counts.unresolvedRows +
        resolved.counts.pendingReview +
        resolved.counts.quarantined
    );
    const shim = save(
      "interrupt.cjs",
      Buffer.from(
        "const fs=require('node:fs');const link=fs.linkSync;fs.linkSync=function(from,to){const result=link(from,to);if(to.endsWith('/resolution.json'))process.exit(91);return result;};require('node:module').syncBuiltinESMExports();"
      )
    );
    const interrupted = spawnSync(
      process.execPath,
      [
        "--require",
        shim,
        cli,
        "migrate",
        "apply",
        ledger,
        decisionsPath,
        "--out",
        store,
        "--json",
      ],
      { encoding: "utf8", timeout: 30000 }
    );
    assert.equal(
      interrupted.status,
      91,
      interrupted.stdout + interrupted.stderr
    );
    assert.equal(existsSync(join(store, "receipt.json")), false);
    const applied = run(["apply", ledger, decisionsPath, "--out", store]);
    assert.equal(applied.action, "resumed");
    assert.equal(applied.counts.appliedCandidates, 2);
    assert.equal(applied.counts.retainedHistoricalRows, 2);
    assert.equal(applied.counts.indexImported, 0);
    const before = files(store);
    assert.equal(
      run(["apply", ledger, decisionsPath, "--out", store]).action,
      "reused"
    );
    run(["apply-verify", store]);
    const selector = join(root, "selector"),
      initial = run(["read-init", "--out", selector]);
    const active = run([
      "read-activate",
      selector,
      store,
      "--id",
      initial.head,
    ]);
    assert.equal(active.candidates.length, 2);
    for (const c of active.candidates) {
      const expected = resolved.selected.find((s) => s.identity === c.identity);
      assert.deepEqual(
        c.candidate,
        JSON.parse(readFileSync(join(ledger, expected.path)))
      );
      assert.deepEqual(c.candidate.claims, []);
    }
    run(["read-activate", selector, store, "--id", initial.head], 2);
    const rollback = run([
      "read-rollback",
      selector,
      initial.head,
      "--id",
      active.head,
    ]);
    assert.equal(rollback.target.kind, "legacy");
    assert.deepEqual(rollback.candidates, []);
    assert.deepEqual(files(store), before);
    const restored = run([
      "read-rollback",
      selector,
      active.head,
      "--id",
      rollback.head,
    ]);
    assert.deepEqual(restored.candidates, active.candidates);
    // Completed archives no longer depend on original source, review or staging paths.
    for (const path of [
      sourcePath,
      reviewPath,
      revisionPath,
      decisionsPath,
      bundleA,
      bundleB,
      ledger,
    ])
      rmSync(path, { recursive: true });
    run(["apply-verify", store]);
    assert.deepEqual(
      run(["read-path", selector]).candidates,
      active.candidates
    );
    assert.deepEqual(files(store), before);
    const receipt = JSON.parse(readFileSync(join(store, "receipt.json")));
    const candidatePath = join(store, receipt.candidates[0].path);
    writeFileSync(candidatePath, "{}");
    const failed = run(["read-path", selector], 2);
    assert.equal(failed.head, restored.head);
    assert.ok(!failed.candidates);
    const recovered = run([
      "read-rollback",
      selector,
      initial.head,
      "--id",
      failed.head,
    ]);
    assert.equal(recovered.target.kind, "legacy");
    assert.equal(readFileSync(candidatePath, "utf8"), "{}"); // Rollback does not repair or delete imported data.
    assert.deepEqual(
      files(store).filter((f) => f.path !== receipt.candidates[0].path),
      before.filter((f) => f.path !== receipt.candidates[0].path)
    );
    const scores = migrationLegacyScoresExample();
    const scoresPath = save("scores.json", scores.source),
      scoresPlan = save("score-plan.json", scores.plan);
    const historical = run(["legacy-scores", scoresPath, scoresPlan]);
    assert.equal(historical.counts.preservedHistorical, 2);
    for (const r of historical.records) {
      assert.equal(r.historicalOutput.comparableToV2, false);
      assert.equal(r.historicalOutput.rankingEligibility, "excluded");
    }
    // Mixed inputs remain fully accounted for and cannot pass the local application gate.
    const mixed = json([v.legacy, { ...v.legacy, id: "unreviewed" }, null]);
    const mixedSource = save("mixed.json", mixed);
    const mixedReview = save("mixed-review.json", {
      ...v.plan,
      source: pin(mixed),
    });
    const mixedDry = run(["dry-run", mixedSource, "--id", v.plan.namespace], 1);
    assert.deepEqual(mixedDry.counts, {
      input: 3,
      candidates: 2,
      quarantined: 1,
      migrated: 0,
    });
    const mixedBundle = join(root, "mixed-bundle"),
      mixedLedger = join(root, "mixed-ledger");
    run(["review", mixedSource, mixedReview], 1);
    run(["export", mixedSource, mixedReview, "--out", mixedBundle], 1);
    run(["verify", mixedBundle], 1);
    run(["ledger", mixedBundle, "--out", mixedLedger], 1);
    const mixedDecisions = save(
      "mixed-decisions.json",
      decisionPlan(mixedLedger)
    );
    const mixedResolved = run(["resolve", mixedLedger, mixedDecisions], 1);
    assert.equal(mixedResolved.counts.input, 3);
    assert.equal(mixedResolved.counts.pendingReview, 1);
    assert.equal(mixedResolved.counts.quarantined, 1);
    const blocked = join(root, "blocked-store");
    run(["apply", mixedLedger, mixedDecisions, "--out", blocked], 2);
    assert.equal(existsSync(blocked), false);
    return {
      kind: "wp09_synthetic_software_acceptance",
      status: "passed",
      scenarios: [
        "reviewed-known-and-unknown-values",
        "field-and-row-accounting",
        "exact-batch-deduplication",
        "explicit-conflicting-revision-selection",
        "pending-and-quarantine-application-gates",
        "interrupted-application-resume-reuse-and-self-contained-verification",
        "verified-read-and-stale-head-rejection",
        "rollback-and-restoration-retain-store-bytes",
        "corruption-fails-closed-with-legacy-recovery",
        "historical-scores-excluded-from-v2-rankings",
      ],
      counts: {
        reviewedSourceRows: 2,
        uniqueBatchRows: 4,
        selectedCandidates: 2,
        retainedHistoricalRows: 2,
        mixedInputRows: 3,
        standaloneHistoricalScores: 2,
      },
      scope: "experimental_local_workflow",
      indexIntegration: "not_tested",
      partnerData: "not_used",
      scientificValidity: "not_checked",
    };
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const args = process.argv.slice(2);
  if (args.length && (args.length !== 2 || args[0] !== "--cli"))
    throw new Error(
      "Usage: node conformance/migration-closeout.mjs [--cli /absolute/path/to/installed/cli.js]"
    );
  console.log(JSON.stringify(runMigrationCloseout(args[1]), null, 2));
}

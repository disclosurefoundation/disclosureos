import { createHash } from "node:crypto";
import { resolve } from "node:path";
import {
  MigrationResolutionSchema,
  type MigrationResolution,
} from "@disclosureos/schema/experimental/v2";
import type { ParsedArgs } from "../utils/args";
import { readLocal } from "./packet";
import { reviewedJson } from "./migration-review";
import { verifiedMigrationLedger } from "./migration-ledger";
const pin = (bytes: Uint8Array) => ({
  sha256: createHash("sha256").update(bytes).digest("hex"),
  byteLength: bytes.byteLength,
});

export function resolveMigration(args: ParsedArgs) {
  if (args.flags["help"]) {
    console.log(
      "migrate resolve <ledger> <decisions.json> [--json]\nExplicit pinned selection/defer decisions only; no application imports."
    );
    return;
  }
  try {
    if (
      args.positional.length !== 2 ||
      Object.keys(args.flags).some((key) => key !== "json")
    )
      throw new Error(
        "Usage: migrate resolve <ledger> <decisions.json> [--json]"
      );
    const bytes = readLocal(args.positional[1]!, 2 * 1024 * 1024);
    const snapshot = verifiedMigrationLedger(resolve(args.positional[0]!));
    const report = buildMigrationResolution(snapshot, bytes);
    if (args.flags["json"]) console.log(JSON.stringify(report, null, 2));
    else {
      console.log(
        `Migration resolution: ${report.selected.length} selected candidates, ${report.counts.deferredRows} deferred rows, ${report.counts.unresolvedRows} unresolved rows, ${report.counts.pendingReview} pending, ${report.counts.quarantined} quarantined, 0 migrated.`
      );
      for (const identity of report.identities)
        console.log(
          JSON.stringify({
            identity: identity.identity,
            status: identity.status,
            decision: identity.decision,
          })
        );
      console.log(
        "Selections are application planning choices, not scientific findings. Use --json for pinned decisions and complete row accounting."
      );
    }
    if (
      report.counts.deferredRows ||
      report.counts.unresolvedRows ||
      report.counts.pendingReview ||
      report.counts.quarantined
    )
      process.exitCode = 1;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (args.flags["json"])
      console.log(
        JSON.stringify({
          success: false,
          stage: "migration_resolution",
          error: message,
        })
      );
    else console.error(message);
    process.exitCode = 2;
  }
}

export function buildMigrationResolution(
  snapshot: ReturnType<typeof verifiedMigrationLedger>,
  bytes: Uint8Array
) {
  const parsed = MigrationResolutionSchema.safeParse(reviewedJson(bytes));
  if (!parsed.success)
    throw new Error(`Invalid resolution plan: ${parsed.error.message}`);
  const plan = parsed.data;
  const ledgerPin = pin(snapshot.files.get("ledger.json")!);
  if (
    plan.ledger.sha256 !== ledgerPin.sha256 ||
    plan.ledger.byteLength !== ledgerPin.byteLength
  )
    throw new Error(
      "Ledger byte pin mismatch; decisions require the exact verified snapshot"
    );
  const inventory = new Map(
    snapshot.ledger.identities.map((identity) => [identity.identity, identity])
  );
  const decisions = new Map<string, MigrationResolution["decisions"][number]>();
  for (const decision of plan.decisions) {
    if (decisions.has(decision.identity))
      throw new Error("Duplicate resolution decision for identity");
    const identity = inventory.get(decision.identity);
    if (!identity) throw new Error("Resolution names an unknown identity");
    if (
      decision.action === "select" &&
      !identity.revisions.some(
        (revision) => revision.sha256 === decision.revision
      )
    )
      throw new Error(
        "Selected revision does not belong to the named identity"
      );
    decisions.set(decision.identity, decision);
  }
  const identities = snapshot.ledger.identities.map((identity) => {
    const decision = decisions.get(identity.identity);
    return {
      ...identity,
      ledgerStatus: identity.status,
      status:
        decision?.action === "select"
          ? "selected"
          : decision
          ? "deferred"
          : "unresolved",
      ...(decision ? { decision } : {}),
    };
  });
  const selected = identities.flatMap((identity) => {
    const decision = decisions.get(identity.identity);
    if (decision?.action !== "select") return [];
    const revision = identity.revisions.find(
      (revision) => revision.sha256 === decision.revision
    )!;
    const occurrence = revision.occurrences[0]!;
    return [
      {
        identity: identity.identity,
        revision: revision.sha256,
        path: occurrence.path,
        candidate: pin(snapshot.files.get(occurrence.path)!),
        occurrences: revision.occurrences,
      },
    ];
  });
  const receipts = snapshot.ledger.receipts.map((receipt) => ({
    ...receipt,
    rows: receipt.rows.map((row) => {
      if (!("identity" in row)) return { ...row, ledgerStatus: row.status };
      const decision = decisions.get(row.identity);
      const status =
        decision?.action === "select"
          ? decision.revision === row.revision
            ? "selected"
            : "not_selected"
          : decision
          ? "deferred"
          : "unresolved";
      return { ...row, ledgerStatus: row.status, status };
    }),
  }));
  const rows = receipts.flatMap((receipt) => receipt.rows),
    count = (status: string) =>
      rows.filter((row) => row.status === status).length;
  return {
    kind: "legacy_migration_resolution_result",
    schemaVersion: "0.1.0",
    policy: "legacy-migration-resolution:0.1.0",
    ledger: ledgerPin,
    plan: {
      ...pin(bytes),
      encoding: "base64",
      bytes: Buffer.from(bytes).toString("base64"),
    },
    decidedBy: plan.decidedBy,
    decidedAt: plan.decidedAt,
    identities,
    selected,
    receipts,
    counts: {
      input: rows.length,
      selectedRows: count("selected"),
      notSelectedRows: count("not_selected"),
      deferredRows: count("deferred"),
      unresolvedRows: count("unresolved"),
      pendingReview: count("pending_review"),
      quarantined: count("quarantined"),
      selectedCandidates: selected.length,
      migrated: 0,
    },
    decisionIdentity: "not_authenticated",
    scientificValidity: "not_checked",
    applicationStatus: "not_imported",
    verification: "current_code_replay",
  };
}

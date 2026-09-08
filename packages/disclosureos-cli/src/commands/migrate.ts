import { migrationLedger } from "./migration-ledger";
import { exportMigration } from "./migration-export";
import type { ParsedArgs } from "../utils/args";
import { readLocal } from "./packet";
import { buildMigrationReport } from "./migration-plan";
import { reviewMigration } from "./migration-review";
export function migrate(args: ParsedArgs): void {
  if (args.subcommand === "ledger" || args.subcommand === "ledger-verify") {
    migrationLedger(args);
    return;
  }
  if (args.subcommand === "export" || args.subcommand === "verify") {
    exportMigration(args);
    return;
  }
  if (args.subcommand === "review") {
    reviewMigration(args);
    return;
  }
  if (args.flags["help"]) {
    console.log(
      "disclosureos migrate dry-run <legacy.json> --id <source-namespace> [--json]\nFor explicit mappings: disclosureos migrate review <legacy.json> <review.json> [--json]\nExport: disclosureos migrate export <legacy.json> <review.json> --out <bundle> [--json]\nVerify: disclosureos migrate verify <bundle> [--json]\nLedger: disclosureos migrate ledger <bundle>... --out <ledger> [--json]\nVerify ledger: disclosureos migrate ledger-verify <ledger> [--json]\nExperimental artifacts only; no database records are written."
    );
    return;
  }
  try {
    const namespace = args.flags["id"];
    if (
      args.subcommand !== "dry-run" ||
      args.positional.length !== 1 ||
      typeof namespace !== "string" ||
      !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(namespace) ||
      Object.keys(args.flags).some((key) => !["id", "json"].includes(key))
    ) {
      throw new Error(
        "Usage: disclosureos migrate dry-run <legacy.json> --id <source-namespace> [--json]"
      );
    }
    const bytes = readLocal(args.positional[0]!, 8 * 1024 * 1024);
    const report = buildMigrationReport(bytes, namespace);
    if (args.flags["json"]) console.log(JSON.stringify(report, null, 2));
    else {
      console.log(
        `Experimental migration dry run: ${report.counts.input} inputs, ${report.counts.candidates} review candidates, ${report.counts.quarantined} quarantined, 0 migrated.`
      );
      for (const row of report.records) {
        console.log(
          JSON.stringify({
            sourcePointer: row.sourcePointer,
            sourceId: row.sourceId,
            decision: row.decision,
            unresolvedFields: row.mapping.filter(
              (field) => field.disposition === "unresolved"
            ).length,
            reasons: row.reasons,
          })
        );
      }
      console.log(
        "Use --json for exact source bytes, retained legacy data, candidates and field mappings. Every candidate requires explicit mapping review."
      );
    }
    if (report.counts.quarantined > 0) process.exitCode = 1;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (args.flags["json"])
      console.log(
        JSON.stringify({ success: false, stage: "input", error: message })
      );
    else console.error(message);
    process.exitCode = 2;
  }
}

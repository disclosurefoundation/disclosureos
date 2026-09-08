import { createHash } from "node:crypto";
import {
  mkdirSync,
  writeFileSync,
  rmSync,
  lstatSync,
  readdirSync,
} from "node:fs";
import { resolve, join } from "node:path";
import type { ParsedArgs } from "../utils/args";
import { readLocal } from "./packet";
import { buildReviewedMigration } from "./migration-review";

const POLICY = "legacy-migration-export:0.1.0";
const TOTAL_LIMIT = 256 * 1024 * 1024;
const json = (value: unknown) =>
  Buffer.from(JSON.stringify(value, null, 2) + "\n");
const pin = (bytes: Uint8Array) => ({
  sha256: createHash("sha256").update(bytes).digest("hex"),
  byteLength: bytes.byteLength,
});

export function assembleMigrationBundle(
  source: Uint8Array,
  review: Uint8Array
) {
  const report = buildReviewedMigration(source, review);
  const files = new Map<string, Uint8Array>([
    ["source.json", source],
    ["review.json", review],
  ]);
  let total = source.byteLength + review.byteLength;
  const add = (path: string, bytes: Uint8Array) => {
    total += bytes.byteLength;
    if (total > TOTAL_LIMIT)
      throw new Error("Migration export exceeds 256 MiB budget");
    files.set(path, bytes);
  };
  add("report.json", json(report));
  const rows = report.records.map((row) => {
    if (
      "candidate" in row &&
      row.candidate &&
      row.review.status === "applied"
    ) {
      const path = `candidates/${row.candidate.observation.id}.json`;
      add(path, json(row.candidate));
      return {
        sourcePointer: row.sourcePointer,
        sourceId: row.sourceId,
        disposition: "exported",
        path,
      };
    }
    return {
      sourcePointer: row.sourcePointer,
      sourceId: row.sourceId,
      disposition:
        row.decision === "quarantined" ? "quarantined" : "pending_review",
    };
  });
  const count = (disposition: string) =>
    rows.filter((row) => row.disposition === disposition).length;
  const manifest = {
    kind: "legacy_migration_export",
    schemaVersion: "0.1.0",
    policy: POLICY,
    namespace: report.namespace,
    counts: {
      input: rows.length,
      exported: count("exported"),
      pendingReview: count("pending_review"),
      quarantined: count("quarantined"),
      migrated: 0,
    },
    rows,
    files: [...files].map(([path, bytes]) => ({ path, ...pin(bytes) })),
    reviewerIdentity: "not_authenticated",
    scientificValidity: "not_checked",
  };
  add("manifest.json", json(manifest));
  return { files, manifest };
}

function privateDirectory(path: string) {
  const stat = lstatSync(path);
  if (!stat.isDirectory() || (stat.mode & 0o077) !== 0)
    throw new Error("Expected a private real directory (0700)");
}

// Paths come only from the recomputed bundle, never from an untrusted manifest.
function compare(
  destination: string,
  bundle: ReturnType<typeof assembleMigrationBundle>
) {
  privateDirectory(destination);
  privateDirectory(join(destination, "candidates"));
  const rootNames = [
    "candidates",
    "manifest.json",
    "report.json",
    "review.json",
    "source.json",
  ];
  const candidateNames = [...bundle.files.keys()]
    .filter((path) => path.startsWith("candidates/"))
    .map((path) => path.slice(11));
  if (
    JSON.stringify(readdirSync(destination).sort()) !==
      JSON.stringify(rootNames.sort()) ||
    JSON.stringify(readdirSync(join(destination, "candidates")).sort()) !==
      JSON.stringify(candidateNames.sort())
  ) {
    throw new Error("Bundle conflict: unexpected or missing files");
  }
  for (const [path, expected] of bundle.files) {
    const file = join(destination, path);
    const stat = lstatSync(file);
    if (!stat.isFile() || (stat.mode & 0o077) !== 0)
      throw new Error(`Bundle conflict: nonprivate or nonregular file ${path}`);
    const actual = readLocal(file, expected.byteLength);
    if (!Buffer.from(actual).equals(Buffer.from(expected)))
      throw new Error(`Bundle conflict: content differs at ${path}`);
  }
}

export function exportMigration(args: ParsedArgs): void {
  if (args.flags["help"]) {
    console.log(
      "disclosureos migrate export <legacy.json> <review.json> --out <bundle> [--json]\ndisclosureos migrate verify <bundle> [--json]\nPrivate review artifacts only; no database imports."
    );
    return;
  }
  let created: string | undefined;
  try {
    const verify = args.subcommand === "verify";
    const output = args.flags["out"];
    if (
      verify
        ? args.positional.length !== 1 ||
          Object.keys(args.flags).some((key) => key !== "json")
        : args.positional.length !== 2 ||
          typeof output !== "string" ||
          Object.keys(args.flags).some((key) => !["out", "json"].includes(key))
    ) {
      throw new Error(
        "Usage: migrate export <legacy.json> <review.json> --out <bundle> [--json], or migrate verify <bundle> [--json]"
      );
    }
    const destination = resolve(
      verify ? args.positional[0]! : (output as string)
    );
    if (verify) privateDirectory(destination);
    const source = readLocal(
      verify ? join(destination, "source.json") : args.positional[0]!,
      8 * 1024 * 1024
    );
    const review = readLocal(
      verify ? join(destination, "review.json") : args.positional[1]!,
      2 * 1024 * 1024
    );
    const bundle = assembleMigrationBundle(source, review);
    let action = "verified";
    if (!verify) {
      try {
        mkdirSync(destination, { mode: 0o700 });
        created = destination;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      }
      if (created) {
        mkdirSync(join(destination, "candidates"), { mode: 0o700 });
        for (const [path, bytes] of bundle.files)
          writeFileSync(join(destination, path), bytes, {
            mode: 0o600,
            flag: "wx",
          });
        action = "created";
      } else action = "reused";
    }
    compare(destination, bundle);
    created = undefined;
    const result = {
      success: true,
      action,
      directory: destination,
      policy: POLICY,
      counts: bundle.manifest.counts,
      manifest: pin(bundle.files.get("manifest.json")!),
      verification: "current_code_replay",
      migrationStatus: "not_imported",
      reviewerIdentity: "not_authenticated",
      scientificValidity: "not_checked",
    };
    if (args.flags["json"]) console.log(JSON.stringify(result, null, 2));
    else
      console.log(
        `Migration bundle ${action}: ${result.counts.exported} exported, ${result.counts.pendingReview} pending review, ${result.counts.quarantined} quarantined, 0 migrated.\n${destination}`
      );
    if (result.counts.quarantined || result.counts.pendingReview)
      process.exitCode = 1;
  } catch (error) {
    if (created) rmSync(created, { recursive: true, force: true });
    const message = error instanceof Error ? error.message : String(error);
    if (args.flags["json"])
      console.log(
        JSON.stringify({
          success: false,
          stage: "migration_export",
          error: message,
        })
      );
    else console.error(message);
    process.exitCode = 2;
  }
}

/** Recompute from bounded inputs and check every artifact before a ledger can receive it. */
export function verifiedMigrationBundle(destination: string) {
  privateDirectory(destination);
  const bundle = assembleMigrationBundle(
    readLocal(join(destination, "source.json"), 8 * 1024 * 1024),
    readLocal(join(destination, "review.json"), 2 * 1024 * 1024)
  );
  compare(destination, bundle);
  return bundle;
}

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
import { verifiedMigrationBundle } from "./migration-export";
const POLICY = "legacy-migration-ledger:0.1.0";
type Bundle = ReturnType<typeof verifiedMigrationBundle>;
const pin = (bytes: Uint8Array) => ({
  sha256: createHash("sha256").update(bytes).digest("hex"),
  byteLength: bytes.byteLength,
});
const json = (value: unknown) =>
  Buffer.from(JSON.stringify(value, null, 2) + "\n");
const privateDir = (path: string) => {
  const s = lstatSync(path);
  if (!s.isDirectory() || s.mode & 0o077)
    throw new Error("Expected a private real ledger directory");
};

function planLedger(bundles: Bundle[]) {
  const unique = new Map(
    bundles.map((bundle) => [
      pin(bundle.files.get("manifest.json")!).sha256,
      bundle,
    ])
  );
  const files = new Map<string, Uint8Array>();
  const dirs = new Set(["", "inputs"]);
  let total = 0;
  const add = (path: string, bytes: Uint8Array) => {
    total += bytes.byteLength;
    if (total > 256 * 1024 * 1024 || files.size >= 20000)
      throw new Error("Ledger exceeds 256 MiB or 20000-file budget");
    files.set(path, bytes);
  };
  const identities = new Map<
    string,
    Map<string, { bundleId: string; sourcePointer: string; path: string }[]>
  >();
  const receipts = [...unique]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([bundleId, bundle]) => {
      const root = `inputs/${bundleId}`;
      dirs.add(root);
      dirs.add(`${root}/candidates`);
      for (const [path, bytes] of bundle.files) add(`${root}/${path}`, bytes);
      const rows = bundle.manifest.rows.map((row) => {
        if (row.disposition !== "exported" || !row.path)
          return { ...row, status: row.disposition };
        const path = `${root}/${row.path}`;
        const revision = pin(bundle.files.get(row.path)!).sha256;
        // Stable ID is already derived by the verified planner from namespace and source ID.
        const identity = row.path.slice("candidates/".length, -".json".length);
        const revisions = identities.get(identity) ?? new Map();
        const occurrences = revisions.get(revision) ?? [];
        occurrences.push({ bundleId, sourcePointer: row.sourcePointer, path });
        revisions.set(revision, occurrences);
        identities.set(identity, revisions);
        return { ...row, identity, revision, status: "staged" };
      });
      return {
        bundleId,
        namespace: bundle.manifest.namespace,
        manifest: pin(bundle.files.get("manifest.json")!),
        rows,
      };
    });
  const inventory = [...identities]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([identity, revisions]) => ({
      identity,
      status: revisions.size === 1 ? "ready_for_import_review" : "conflict",
      revisions: [...revisions]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([sha256, occurrences]) => ({ sha256, occurrences })),
    }));
  const conflicts = new Set(
    inventory
      .filter((item) => item.status === "conflict")
      .map((item) => item.identity)
  );
  const finalized = receipts.map((receipt) => ({
    ...receipt,
    rows: receipt.rows.map((row) => ({
      ...row,
      status:
        "identity" in row && conflicts.has(row.identity)
          ? "conflict"
          : row.status,
    })),
  }));
  const rows = finalized.flatMap((receipt) => receipt.rows);
  const count = (status: string) =>
    rows.filter((row) => row.status === status).length;
  const ledger = {
    kind: "legacy_migration_ledger",
    schemaVersion: "0.1.0",
    policy: POLICY,
    counts: {
      bundles: unique.size,
      input: rows.length,
      stagedRows: count("staged"),
      conflictRows: count("conflict"),
      pendingReview: count("pending_review"),
      quarantined: count("quarantined"),
      identities: inventory.length,
      conflictingIdentities: conflicts.size,
      migrated: 0,
    },
    receipts: finalized,
    identities: inventory,
    files: [...files].map(([path, bytes]) => ({ path, ...pin(bytes) })),
    verification: "current_code_replay",
    reviewerIdentity: "not_authenticated",
    applicationStatus: "not_imported",
  };
  add("ledger.json", json(ledger));
  return { files, dirs, ledger };
}

function compareLedger(root: string, plan: ReturnType<typeof planLedger>) {
  for (const dir of plan.dirs) {
    const path = join(root, dir);
    privateDir(path);
    const expected = new Set<string>();
    const prefix = dir ? `${dir}/` : "";
    for (const name of [...plan.dirs, ...plan.files.keys()])
      if (name.startsWith(prefix) && name !== dir)
        expected.add(name.slice(prefix.length).split("/")[0]!);
    if (
      JSON.stringify(readdirSync(path).sort()) !==
      JSON.stringify([...expected].sort())
    )
      throw new Error("Ledger conflict: missing or unexpected entries");
  }
  for (const [path, bytes] of plan.files) {
    const file = join(root, path),
      stat = lstatSync(file);
    if (!stat.isFile() || stat.mode & 0o077)
      throw new Error("Ledger conflict: nonprivate or nonregular artifact");
    if (
      !Buffer.from(readLocal(file, bytes.byteLength)).equals(Buffer.from(bytes))
    )
      throw new Error(`Ledger conflict: changed artifact ${path}`);
  }
}

export function migrationLedger(args: ParsedArgs) {
  if (args.flags["help"]) {
    console.log(
      "migrate ledger <bundle>... --out <ledger> [--json]\nmigrate ledger-verify <ledger> [--json]\nImmutable local staging receipts; no application imports."
    );
    return;
  }
  let created: string | undefined;
  try {
    const verify = args.subcommand === "ledger-verify",
      output = args.flags["out"];
    if (
      verify
        ? args.positional.length !== 1 ||
          Object.keys(args.flags).some((key) => key !== "json")
        : !args.positional.length ||
          args.positional.length > 16 ||
          typeof output !== "string" ||
          Object.keys(args.flags).some((key) => !["out", "json"].includes(key))
    )
      throw new Error(
        "Usage: migrate ledger <1-16 bundles> --out <ledger>, or migrate ledger-verify <ledger>"
      );
    const root = resolve(verify ? args.positional[0]! : (output as string));
    let paths: string[];
    if (verify) {
      privateDir(root);
      privateDir(join(root, "inputs"));
      const ids = readdirSync(join(root, "inputs")).sort();
      if (
        !ids.length ||
        ids.length > 16 ||
        ids.some((id) => !/^[a-f0-9]{64}$/.test(id))
      )
        throw new Error("Invalid ledger input inventory");
      paths = ids.map((id) => join(root, "inputs", id));
    } else paths = args.positional.map((path) => resolve(path));
    // Bound aggregate allocation while verifying inputs, before any writes.
    let bytes = 0,
      entries = 0;
    const bundles = paths.map((path) => {
      const bundle = verifiedMigrationBundle(path);
      for (const data of bundle.files.values()) bytes += data.byteLength;
      entries += bundle.files.size;
      if (bytes > 256 * 1024 * 1024 || entries >= 20000)
        throw new Error("Ledger input budget exceeded");
      return bundle;
    });
    const plan = planLedger(bundles);
    let action = "verified";
    if (!verify) {
      try {
        mkdirSync(root, { mode: 0o700 });
        created = root;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      }
      if (created) {
        for (const dir of plan.dirs)
          if (dir) mkdirSync(join(root, dir), { mode: 0o700 });
        for (const [path, data] of plan.files)
          writeFileSync(join(root, path), data, { mode: 0o600, flag: "wx" });
        action = "created";
      } else action = "reused";
    }
    compareLedger(root, plan);
    created = undefined;
    const result = {
      success: true,
      action,
      directory: root,
      ledger: pin(plan.files.get("ledger.json")!),
      counts: plan.ledger.counts,
      applicationStatus: "not_imported",
      verification: "current_code_replay",
    };
    if (args.flags["json"]) console.log(JSON.stringify(result, null, 2));
    else
      console.log(
        `Migration ledger ${action}: ${result.counts.stagedRows} staged, ${result.counts.conflictRows} conflicting, ${result.counts.pendingReview} pending, ${result.counts.quarantined} quarantined, 0 migrated.\n${root}`
      );
    if (
      result.counts.conflictRows ||
      result.counts.pendingReview ||
      result.counts.quarantined
    )
      process.exitCode = 1;
  } catch (error) {
    if (created) rmSync(created, { recursive: true, force: true });
    const message = error instanceof Error ? error.message : String(error);
    if (args.flags["json"])
      console.log(
        JSON.stringify({
          success: false,
          stage: "migration_ledger",
          error: message,
        })
      );
    else console.error(message);
    process.exitCode = 2;
  }
}

/** Verified snapshot for downstream planning; never trust ledger-supplied artifact paths. */
export function verifiedMigrationLedger(root: string) {
  privateDir(root);
  privateDir(join(root, "inputs"));
  const ids = readdirSync(join(root, "inputs")).sort();
  if (
    !ids.length ||
    ids.length > 16 ||
    ids.some((id) => !/^[a-f0-9]{64}$/.test(id))
  )
    throw new Error("Invalid ledger input inventory");
  let bytes = 0,
    entries = 0;
  const bundles = ids.map((id) => {
    const bundle = verifiedMigrationBundle(join(root, "inputs", id));
    for (const data of bundle.files.values()) bytes += data.byteLength;
    entries += bundle.files.size;
    if (bytes > 256 * 1024 * 1024 || entries >= 20000)
      throw new Error("Ledger input budget exceeded");
    return bundle;
  });
  const plan = planLedger(bundles);
  compareLedger(root, plan);
  return plan;
}

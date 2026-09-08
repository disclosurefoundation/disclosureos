import { createHash, randomUUID } from "node:crypto";
import {
  mkdirSync,
  lstatSync,
  readdirSync,
  openSync,
  writeFileSync,
  fsyncSync,
  closeSync,
  linkSync,
  unlinkSync,
} from "node:fs";
import { resolve, join } from "node:path";
import type { ParsedArgs } from "../utils/args";
import { readLocal } from "./packet";
import { verifiedMigrationLedger } from "./migration-ledger";
import { buildMigrationResolution } from "./migration-resolution";
const POLICY = "legacy-migration-application:0.1.0";
const LIMIT = 256 * 1024 * 1024;
const pin = (bytes: Uint8Array) => ({
  sha256: createHash("sha256").update(bytes).digest("hex"),
  byteLength: bytes.byteLength,
});
const json = (value: unknown) =>
  Buffer.from(JSON.stringify(value, null, 2) + "\n");
const stat = (path: string) => {
  try {
    return lstatSync(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
};
function directory(path: string) {
  const s = lstatSync(path);
  if (!s.isDirectory() || s.mode & 0o077)
    throw new Error("Expected a private real application directory");
}
function exact(path: string, bytes: Uint8Array) {
  const s = lstatSync(path);
  if (!s.isFile() || s.mode & 0o077)
    throw new Error("Application artifact must be a private regular file");
  if (
    !Buffer.from(readLocal(path, bytes.byteLength)).equals(Buffer.from(bytes))
  )
    throw new Error(`Application conflict: changed artifact ${path}`);
}
function prepare(ledger: string, decisions: Uint8Array) {
  const snapshot = verifiedMigrationLedger(ledger),
    resolution = buildMigrationResolution(snapshot, decisions),
    c = resolution.counts;
  if (
    c.deferredRows ||
    c.unresolvedRows ||
    c.pendingReview ||
    c.quarantined ||
    !resolution.selected.length
  )
    throw new Error(
      "Local application requires explicit selections for all identities, no pending/quarantined rows and at least one candidate"
    );
  const files = new Map<string, Uint8Array>(),
    dirs = new Set(["", ".pending", "ledger", "candidates"]);
  let total = 0;
  const add = (path: string, bytes: Uint8Array) => {
    total += bytes.byteLength;
    if (total > LIMIT || files.size >= 30000)
      throw new Error("Application exceeds 256 MiB or 30000-file budget");
    files.set(path, bytes);
  };
  for (const dir of snapshot.dirs) if (dir) dirs.add(`ledger/${dir}`);
  for (const [path, bytes] of snapshot.files) add(`ledger/${path}`, bytes);
  add("resolution.json", decisions);
  add("resolution-report.json", json(resolution));
  const candidates = resolution.selected.map((item) => {
    const path = `candidates/${item.identity}.json`;
    const bytes = snapshot.files.get(item.path)!;
    add(path, bytes);
    return { ...item, path };
  });
  const receipt = {
    kind: "legacy_migration_application_receipt",
    schemaVersion: "0.1.0",
    policy: POLICY,
    status: "complete",
    target: "private_local_candidate_store",
    ledger: resolution.ledger,
    resolution: pin(decisions),
    counts: {
      inputRows: c.input,
      selectedRows: c.selectedRows,
      retainedHistoricalRows: c.notSelectedRows,
      appliedCandidates: candidates.length,
      indexImported: 0,
    },
    candidates,
    files: [...files].map(([path, bytes]) => ({ path, ...pin(bytes) })),
    decisionIdentity: "not_authenticated",
    scientificValidity: "not_checked",
    readPath: "not_activated",
  };
  add("receipt.json", json(receipt));
  const intent = json({
    kind: "legacy_migration_application_intent",
    schemaVersion: "0.1.0",
    policy: POLICY,
    ledger: resolution.ledger,
    resolution: pin(decisions),
    receipt: pin(files.get("receipt.json")!),
  });
  add("intent.json", intent);
  return { files, dirs, receipt };
}

// Validate the complete existing inventory before resuming any write.
function inspect(
  root: string,
  plan: ReturnType<typeof prepare>,
  complete: boolean
) {
  directory(root);
  const children = new Map<string, Set<string>>();
  for (const dir of plan.dirs) children.set(dir, new Set());
  for (const path of [...plan.dirs, ...plan.files.keys()]) {
    if (!path) continue;
    const slash = path.lastIndexOf("/");
    children
      .get(slash < 0 ? "" : path.slice(0, slash))!
      .add(path.slice(slash + 1));
  }
  for (const dir of plan.dirs) {
    const path = join(root, dir);
    if (!stat(path)) {
      if (complete)
        throw new Error("Completed application is missing a directory");
      continue;
    }
    directory(path);
    if (
      dir !== ".pending" &&
      readdirSync(path).some((name) => !children.get(dir)!.has(name))
    )
      throw new Error("Application conflict: unexpected entries");
  }
  for (const [path, bytes] of plan.files) {
    if (stat(join(root, path))) exact(join(root, path), bytes);
    else if (complete)
      throw new Error(`Completed application is missing ${path}`);
  }
  // Interrupted atomic writes never become candidate files. Retain bounded recognizable
  // staging files; do not delete another concurrent identical writer's temporary file.
  const pending = join(root, ".pending");
  if (stat(pending)) {
    const names = readdirSync(pending);
    if (names.length > 64)
      throw new Error("Application staging-file budget exceeded");
    const expected = new Map(
      [...plan.files.values()].map((bytes) => [pin(bytes).sha256, bytes])
    );
    let total = 0;
    for (const name of names) {
      if (!/^[a-f0-9]{64}-[a-f0-9-]{36}$/.test(name))
        throw new Error("Unexpected application staging file");
      const bytes = expected.get(name.slice(0, 64));
      if (!bytes) throw new Error("Unknown staged content");
      const path = join(pending, name),
        s = stat(path);
      if (!s) continue;
      if (!s.isFile() || s.mode & 0o077)
        throw new Error("Invalid staging file");
      total += s.size;
      if (total > LIMIT)
        throw new Error("Application staging-byte budget exceeded");
      let partial: Uint8Array;
      try {
        partial = readLocal(path, bytes.byteLength);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") continue;
        throw error;
      }
      if (
        !Buffer.from(bytes)
          .subarray(0, partial.byteLength)
          .equals(Buffer.from(partial))
      )
        throw new Error("Conflicting staged bytes");
    }
  }
}
function publish(root: string, path: string, bytes: Uint8Array) {
  const target = join(root, path);
  if (stat(target)) {
    exact(target, bytes);
    return;
  }
  const temporary = join(
    root,
    ".pending",
    `${pin(bytes).sha256}-${randomUUID()}`
  );
  let fd: number | undefined;
  try {
    fd = openSync(temporary, "wx", 0o600);
    writeFileSync(fd, bytes);
    fsyncSync(fd);
    closeSync(fd);
    fd = undefined;
    try {
      linkSync(temporary, target);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      exact(target, bytes);
    }
  } finally {
    if (fd !== undefined) closeSync(fd);
    if (stat(temporary)) unlinkSync(temporary);
  }
}
export function verifiedMigrationApplication(root: string) {
  directory(root);
  const plan = prepare(
    join(root, "ledger"),
    readLocal(join(root, "resolution.json"), 2 * 1024 * 1024)
  );
  inspect(root, plan, true);
  return plan;
}
export function applyMigration(args: ParsedArgs) {
  if (args.flags["help"]) {
    console.log(
      "migrate apply <ledger> <decisions.json> --out <store> [--json]\nmigrate apply-verify <store> [--json]\nPrivate local application only; Index read paths remain unchanged."
    );
    return;
  }
  try {
    const verify = args.subcommand === "apply-verify",
      out = args.flags["out"];
    if (
      verify
        ? args.positional.length !== 1 ||
          Object.keys(args.flags).some((key) => key !== "json")
        : args.positional.length !== 2 ||
          typeof out !== "string" ||
          Object.keys(args.flags).some((key) => !["out", "json"].includes(key))
    )
      throw new Error(
        "Usage: migrate apply <ledger> <decisions.json> --out <store>, or migrate apply-verify <store>"
      );
    const root = resolve(verify ? args.positional[0]! : (out as string));
    if (verify) directory(root);
    const plan = prepare(
      verify ? join(root, "ledger") : resolve(args.positional[0]!),
      readLocal(
        verify ? join(root, "resolution.json") : args.positional[1]!,
        2 * 1024 * 1024
      )
    );
    let created = false;
    if (!verify) {
      try {
        mkdirSync(root, { mode: 0o700 });
        created = true;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      }
    }
    if (created) {
      mkdirSync(join(root, ".pending"), { mode: 0o700 });
      publish(root, "intent.json", plan.files.get("intent.json")!);
    } else exact(join(root, "intent.json"), plan.files.get("intent.json")!);
    const completed = !!stat(join(root, "receipt.json"));
    inspect(root, plan, verify || completed);
    if (!verify && !completed) {
      for (const dir of plan.dirs)
        if (dir) {
          try {
            mkdirSync(join(root, dir), { mode: 0o700 });
          } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
            directory(join(root, dir));
          }
        }
      for (const [path, bytes] of plan.files)
        if (path !== "receipt.json") publish(root, path, bytes);
      // Recheck all existing bytes before publishing the final completion marker.
      inspect(root, plan, false);
      publish(root, "receipt.json", plan.files.get("receipt.json")!);
    }
    inspect(root, plan, true);
    const result = {
      success: true,
      action: verify
        ? "verified"
        : completed
        ? "reused"
        : created
        ? "applied"
        : "resumed",
      directory: root,
      receipt: pin(plan.files.get("receipt.json")!),
      counts: plan.receipt.counts,
      target: plan.receipt.target,
      readPath: "not_activated",
      verification: "current_code_replay",
    };
    if (args.flags["json"]) console.log(JSON.stringify(result, null, 2));
    else
      console.log(
        `Local migration ${result.action}: ${result.counts.appliedCandidates} candidates, ${result.counts.retainedHistoricalRows} historical rows retained, 0 Index imports.\n${root}`
      );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (args.flags["json"])
      console.log(
        JSON.stringify({
          success: false,
          stage: "migration_application",
          error: message,
        })
      );
    else console.error(message);
    process.exitCode = 2;
  }
}

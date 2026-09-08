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
import { resolve, join, isAbsolute } from "node:path";
import type { ParsedArgs } from "../utils/args";
import { readLocal } from "./packet";
import { reviewedJson } from "./migration-review";
import { verifiedMigrationApplication } from "./migration-apply";

const HASH = /^[a-f0-9]{64}$/;
const LIMIT = 16384;
const MAX_EVENTS = 1024;
type Pin = { sha256: string; byteLength: number };
type Target =
  | { kind: "legacy" }
  | { kind: "local_store"; directory: string; receipt: Pin };
type Event = {
  kind: "legacy_migration_read_transition";
  schemaVersion: "0.1.0";
  sequence: number;
  previous: string | null;
  action: "initialize" | "activate" | "rollback";
  target: Target;
  rollbackTo: string | null;
};
const bytes = (value: unknown) =>
  Buffer.from(JSON.stringify(value, null, 2) + "\n");
const pin = (value: Uint8Array): Pin => ({
  sha256: createHash("sha256").update(value).digest("hex"),
  byteLength: value.byteLength,
});
const name = (sequence: number) => `${String(sequence).padStart(6, "0")}.json`;
function privateDirectory(path: string) {
  const stat = lstatSync(path);
  if (!stat.isDirectory() || stat.mode & 0o077)
    throw new Error("Selector requires private real directories");
}
function privateFile(path: string) {
  const stat = lstatSync(path);
  if (!stat.isFile() || stat.mode & 0o077)
    throw new Error("Selector requires private regular files");
  return readLocal(path, LIMIT);
}
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Invalid read transition object");
  return value as Record<string, unknown>;
}
function target(value: unknown): Target {
  const v = object(value);
  if (v.kind === "legacy") return { kind: "legacy" };
  const p = object(v.receipt);
  if (
    v.kind !== "local_store" ||
    typeof v.directory !== "string" ||
    v.directory.length > 4096 ||
    !isAbsolute(v.directory) ||
    resolve(v.directory) !== v.directory ||
    typeof p.sha256 !== "string" ||
    !HASH.test(p.sha256) ||
    !Number.isSafeInteger(p.byteLength) ||
    (p.byteLength as number) < 1 ||
    (p.byteLength as number) > 256 * 1024 * 1024
  )
    throw new Error("Invalid pinned local store target");
  return {
    kind: "local_store",
    directory: v.directory,
    receipt: { sha256: p.sha256, byteLength: p.byteLength as number },
  };
}
function history(root: string) {
  privateDirectory(root);
  privateDirectory(join(root, ".pending"));
  const names = readdirSync(root)
    .filter((v) => v !== ".pending")
    .sort();
  if (
    !names.length ||
    names.length > MAX_EVENTS ||
    names.some((v, i) => v !== name(i))
  )
    throw new Error(
      "Selector history is missing, noncontiguous or exceeds its budget"
    );
  // Staging is never a read head. A crashed writer may leave a bounded partial file.
  const pending = readdirSync(join(root, ".pending"));
  if (pending.length > 64) throw new Error("Selector staging budget exceeded");
  for (const n of pending) {
    if (!/^[a-f0-9-]{36}$/.test(n))
      throw new Error("Unexpected selector staging entry");
    try {
      privateFile(join(root, ".pending", n));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  const entries: { id: string; event: Event }[] = [];
  for (const [i, n] of names.entries()) {
    const raw = privateFile(join(root, n));
    const v = object(reviewedJson(raw));
    const t = target(v.target);
    const previous = entries.at(-1)?.id ?? null;
    let action: Event["action"];
    let rollbackTo: string | null = null;
    if (i === 0 && v.action === "initialize" && t.kind === "legacy")
      action = "initialize";
    else if (i > 0 && v.action === "activate" && t.kind === "local_store")
      action = "activate";
    else if (
      i > 0 &&
      v.action === "rollback" &&
      typeof v.rollbackTo === "string"
    ) {
      const earlier = entries.find((e) => e.id === v.rollbackTo);
      if (!earlier || !bytes(earlier.event.target).equals(bytes(t)))
        throw new Error("Rollback must restore an earlier recorded target");
      action = "rollback";
      rollbackTo = v.rollbackTo;
    } else throw new Error("Invalid read transition action");
    const event: Event = {
      kind: "legacy_migration_read_transition",
      schemaVersion: "0.1.0",
      sequence: i,
      previous,
      action,
      target: t,
      rollbackTo,
    };
    if (!bytes(event).equals(Buffer.from(raw)))
      throw new Error("Changed or noncanonical selector history");
    entries.push({ id: pin(raw).sha256, event });
  }
  return entries;
}
function verifiedTarget(t: Target) {
  if (t.kind === "legacy") return [];
  const plan = verifiedMigrationApplication(t.directory);
  if (!bytes(pin(plan.files.get("receipt.json")!)).equals(bytes(t.receipt)))
    throw new Error("Selected store receipt does not match its activation pin");
  // Return the verified in-memory bytes, avoiding a second unverified filesystem read.
  return plan.receipt.candidates.map((c) => ({
    identity: c.identity,
    revision: c.revision,
    candidate: JSON.parse(
      Buffer.from(plan.files.get(c.path)!).toString("utf8")
    ) as unknown,
  }));
}
function publish(root: string, event: Event) {
  const raw = bytes(event);
  if (raw.length > LIMIT)
    throw new Error("Read transition exceeds byte budget");
  const temporary = join(root, ".pending", randomUUID());
  let fd: number | undefined;
  try {
    fd = openSync(temporary, "wx", 0o600);
    writeFileSync(fd, raw);
    fsyncSync(fd);
    closeSync(fd);
    fd = undefined;
    // Exclusive publication at the next sequence is the compare-and-swap operation.
    // Concurrent writers cannot replace a committed transition, even if identical.
    linkSync(temporary, join(root, name(event.sequence)));
  } finally {
    if (fd !== undefined) closeSync(fd);
    try {
      unlinkSync(temporary);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
}
export function migrationReadPath(args: ParsedArgs) {
  const usage =
    "migrate read-init --out <selector> [--json]\nmigrate read-path <selector> [--json]\nmigrate read-activate <selector> <completed-store> --id <expected-head> [--json]\nmigrate read-rollback <selector> <earlier-head> --id <expected-head> [--json]";
  if (args.flags["help"]) {
    console.log(usage);
    return;
  }
  let currentHead: string | undefined;
  try {
    const init = args.subcommand === "read-init",
      read = args.subcommand === "read-path";
    const allowed = init ? ["out", "json"] : read ? ["json"] : ["id", "json"];
    if (
      Object.keys(args.flags).some((k) => !allowed.includes(k)) ||
      args.positional.length !== (init ? 0 : read ? 1 : 2) ||
      (init && typeof args.flags["out"] !== "string") ||
      (!init &&
        !read &&
        (typeof args.flags["id"] !== "string" || !HASH.test(args.flags["id"])))
    )
      throw new Error(usage);
    const root = resolve(
      init ? (args.flags["out"] as string) : args.positional[0]!
    );
    if (init) {
      mkdirSync(root, { mode: 0o700 });
      mkdirSync(join(root, ".pending"), { mode: 0o700 });
      publish(root, {
        kind: "legacy_migration_read_transition",
        schemaVersion: "0.1.0",
        sequence: 0,
        previous: null,
        action: "initialize",
        target: { kind: "legacy" },
        rollbackTo: null,
      });
    }
    let entries = history(root);
    currentHead = entries.at(-1)!.id;
    if (!init && !read) {
      const head = entries.at(-1)!;
      if (args.flags["id"] !== head.id)
        throw new Error(
          "Stale expected read head; inspect the current selector before retrying"
        );
      if (entries.length >= MAX_EVENTS)
        throw new Error("Selector transition budget exceeded");
      let t: Target;
      let rollbackTo: string | null = null;
      if (args.subcommand === "read-activate") {
        const directory = resolve(args.positional[1]!);
        const plan = verifiedMigrationApplication(directory);
        t = {
          kind: "local_store",
          directory,
          receipt: pin(plan.files.get("receipt.json")!),
        };
      } else {
        const earlier = entries
          .slice(0, -1)
          .find((e) => e.id === args.positional[1]);
        if (!earlier)
          throw new Error(
            "Rollback target must be an earlier head in this selector"
          );
        t = earlier.event.target;
        rollbackTo = earlier.id;
        verifiedTarget(t);
      }
      publish(root, {
        kind: "legacy_migration_read_transition",
        schemaVersion: "0.1.0",
        sequence: entries.length,
        previous: head.id,
        action: rollbackTo ? "rollback" : "activate",
        target: t,
        rollbackTo,
      });
      entries = history(root);
    }
    const head = entries.at(-1)!;
    currentHead = head.id;
    const candidates = verifiedTarget(head.event.target);
    const result = {
      success: true,
      scope: "private_local_read_selector",
      head: head.id,
      target: head.event.target,
      history: entries,
      candidates,
      indexImported: 0,
      scientificValidity: "not_checked",
      decisionIdentity: "not_authenticated",
      verification: "current_code_replay",
    };
    if (args.flags["json"]) console.log(JSON.stringify(result, null, 2));
    else
      console.log(
        `Local read path: ${head.event.target.kind}; ${candidates.length} verified candidates.\nHead: ${head.id}\nIndex read path unchanged.`
      );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (args.flags["json"])
      console.log(
        JSON.stringify({
          success: false,
          stage: "migration_read_path",
          head: currentHead,
          error: message,
        })
      );
    else console.error(message);
    process.exitCode = 2;
  }
}

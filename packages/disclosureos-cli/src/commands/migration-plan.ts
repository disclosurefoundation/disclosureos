import { createHash } from "node:crypto";
import { parseEnrichedObservation } from "@disclosureos/schema";
import {
  parseExperimentalClaimHistory,
  type ExperimentalClaimHistory,
} from "@disclosureos/records/experimental/v2";
const POLICY = "legacy-migration-dry-run:0.1.0";
const sha256 = (bytes: Uint8Array | string) =>
  createHash("sha256").update(bytes).digest("hex");
const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const escape = (key: string) => key.replace(/~/g, "~0").replace(/\//g, "~1");

export interface Mapping {
  pointer: string;
  disposition: "mapped" | "unresolved";
  target?: string;
  reason: string;
}

// Include empty containers and nulls. Bound traversal before recursive validators.
function fields(value: unknown): string[] {
  const pending = [{ value, pointer: "", depth: 0 }];
  const leaves: string[] = [];
  let visited = 0;
  while (pending.length) {
    const item = pending.pop()!;
    if (++visited > 100_000 || item.depth > 64)
      throw new Error("Record exceeds 100000 nodes or depth 64");
    const entries =
      item.value !== null && typeof item.value === "object"
        ? Object.entries(item.value)
        : [];
    if (!entries.length) leaves.push(item.pointer);
    for (let i = entries.length - 1; i >= 0; i--) {
      const [key, value] = entries[i]!;
      pending.push({
        value,
        pointer: `${item.pointer}/${escape(key)}`,
        depth: item.depth + 1,
      });
    }
  }
  return leaves;
}

function mapping(pointer: string, candidate: boolean): Mapping {
  if (
    candidate &&
    ["/id", "/createdAt", "/updatedAt", "/summary"].includes(pointer)
  ) {
    return {
      pointer,
      disposition: "mapped",
      target: `/observation${pointer}`,
      reason:
        pointer === "/id"
          ? "Deterministic namespace and legacy ID hash; original ID retained in legacy data."
          : "Copied without inference.",
    };
  }
  return {
    pointer,
    disposition: "unresolved",
    reason: !candidate
      ? "Quarantined record retained; no candidate mapping applied."
      : pointer === "/status"
      ? "Candidate is a review draft; original publication status retained only in legacy data."
      : pointer.startsWith("/temporal/")
      ? "Time scale, precision, provenance and possible sentinel use require explicit review."
      : pointer.startsWith("/location/")
      ? "Reference frame, provenance and possible sentinel use require explicit review; zero is retained."
      : "Retained only in versioned legacy data; requires explicit mapping. Legacy evaluations are not v2 claims or comparable scores.",
  };
}

export function buildMigrationReport(bytes: Uint8Array, namespace: string) {
  const input: unknown = JSON.parse(
    new TextDecoder("utf-8", { fatal: true }).decode(bytes)
  );
  const rows = Array.isArray(input) ? input : [input];
  if (!rows.length || rows.length > 10_000)
    throw new Error("Input must contain 1 to 10000 records");
  const digest = sha256(bytes);
  const counts = new Map<string, number>();
  for (const row of rows) {
    if (object(row) && typeof row.id === "string")
      counts.set(row.id, (counts.get(row.id) ?? 0) + 1);
  }
  const records = rows.map((legacy, index) => {
    const sourcePointer = Array.isArray(input) ? `/${index}` : "";
    const reasons: string[] = [];
    let pointers: string[] = [];
    try {
      pointers = fields(legacy);
    } catch (error) {
      reasons.push((error as Error).message);
    }
    if (
      object(legacy) &&
      typeof legacy.id === "string" &&
      counts.get(legacy.id)! > 1
    ) {
      reasons.push(
        "Duplicate legacy ID in this input; all occurrences quarantined."
      );
    }
    const validation = reasons.length
      ? undefined
      : parseEnrichedObservation(legacy);
    if (validation && !validation.success) {
      reasons.push(
        ...validation.issues.map((issue) => `${issue.path}: ${issue.message}`)
      );
    }
    let candidate: ExperimentalClaimHistory | undefined;
    if (!reasons.length && object(legacy)) {
      const id = `legacy-${sha256(JSON.stringify([namespace, legacy.id]))}`;
      const proposal = {
        kind: "claim_history",
        schemaVersion: "0.1.0",
        id: `${id}-history`,
        observation: {
          kind: "observation",
          schemaVersion: "0.1.0",
          id,
          status: "draft",
          createdAt: legacy.createdAt,
          updatedAt: legacy.updatedAt,
          ...(legacy.summary !== undefined ? { summary: legacy.summary } : {}),
          eventTime: { state: "unknown", reason: "unavailable" },
          position: { state: "unknown", reason: "unavailable" },
          sources: [
            {
              id: "legacy-input",
              kind: "other",
              access: "unknown",
              digest: { algorithm: "sha256", value: digest },
            },
          ],
          products: [],
          methods: [],
          frames: [],
          assertions: [],
          measurements: [],
          processing: [],
        },
        claims: [],
      };
      const parsed = parseExperimentalClaimHistory(proposal);
      if (parsed.success) candidate = parsed.data;
      else
        reasons.push(
          ...parsed.issues.map((issue) => `${issue.pointer}: ${issue.message}`)
        );
    }
    return {
      sourcePointer,
      sourceId:
        object(legacy) && typeof legacy.id === "string" ? legacy.id : null,
      decision: candidate ? "candidate_requires_review" : "quarantined",
      legacy: {
        format: "disclosureos-v1-input",
        validation: validation?.success
          ? "valid"
          : validation
          ? "invalid"
          : "not_checked",
        // Do not re-serialize an over-depth tree; exact bytes and row pointer retain it.
        ...(pointers.length
          ? { data: legacy }
          : { retainedIn: "source.bytes" }),
      },
      ...(candidate ? { candidate } : {}),
      reasons,
      mappingComplete: pointers.length > 0,
      mapping: pointers.map((pointer) =>
        mapping(pointer, candidate !== undefined)
      ),
    };
  });
  const candidates = records.filter(
    (row) => row.decision === "candidate_requires_review"
  ).length;
  return {
    kind: "legacy_migration_dry_run",
    schemaVersion: "0.1.0",
    policy: POLICY,
    namespace,
    source: {
      sha256: digest,
      byteLength: bytes.byteLength,
      encoding: "base64",
      bytes: Buffer.from(bytes).toString("base64"),
    },
    counts: {
      input: rows.length,
      candidates,
      quarantined: rows.length - candidates,
      migrated: 0,
    },
    records,
  };
}

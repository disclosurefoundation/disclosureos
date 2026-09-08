import { createHash } from "node:crypto";
import {
  MigrationReviewSchema,
  type MigrationReview,
} from "@disclosureos/schema/experimental/v2";
import { parseExperimentalClaimHistory } from "@disclosureos/records/experimental/v2";
import type { ParsedArgs } from "../utils/args";
import { readLocal } from "./packet";
import { buildMigrationReport } from "./migration-plan";
const hash = (bytes: Uint8Array) =>
  createHash("sha256").update(bytes).digest("hex");

// Compare exact decimal spellings without expanding exponents or using floating-point arithmetic.
function decimalKey(literal: string): string {
  const [mantissa = "", exponent = "0"] = literal.toLowerCase().split("e");
  if (exponent.replace(/^[+-]/, "").length > 6)
    throw new Error("JSON numeric exponent exceeds review budget");
  const negative = mantissa.startsWith("-");
  const unsigned = negative ? mantissa.slice(1) : mantissa;
  const [whole = "", fraction = ""] = unsigned.split(".");
  let digits = (whole + fraction).replace(/^0+/, "");
  if (!digits) return "0";
  const withoutTrailing = digits.replace(/0+$/, "");
  const scale =
    Number(exponent) - fraction.length + digits.length - withoutTrailing.length;
  digits = withoutTrailing;
  return `${negative ? "-" : ""}${digits}e${scale}`;
}

/** Audit valid JSON lexically before allowing reviewed mappings. No recursive walk. */
function reviewedJson(bytes: Uint8Array): unknown {
  const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  const value: unknown = JSON.parse(text);
  const stack: (Set<string> | null)[] = [];
  for (let i = 0; i < text.length; ) {
    const char = text[i]!;
    if (char === "{" || char === "[") {
      stack.push(char === "{" ? new Set() : null);
      if (stack.length > 64) throw new Error("Reviewed JSON exceeds depth 64");
      i++;
      continue;
    }
    if (char === "}" || char === "]") {
      stack.pop();
      i++;
      continue;
    }
    if (char === '"') {
      const start = i++;
      while (i < text.length) {
        if (text[i] === "\\") {
          i += 2;
          continue;
        }
        if (text[i++] === '"') break;
      }
      let after = i;
      while (/\s/.test(text[after] ?? "") && after < text.length) after++;
      if (text[after] === ":") {
        const key = JSON.parse(text.slice(start, i)) as string;
        const keys = stack[stack.length - 1];
        if (keys?.has(key))
          throw new Error(
            "Duplicate JSON object key; reviewed mapping requires unambiguous input"
          );
        keys?.add(key);
      }
      continue;
    }
    if (char === "-" || (char >= "0" && char <= "9")) {
      const start = i++;
      while (i < text.length && !/[\s,\]}]/.test(text[i]!)) i++;
      const literal = text.slice(start, i);
      const number = Number(literal);
      if (
        !Number.isFinite(number) ||
        (Number.isInteger(number) && !Number.isSafeInteger(number)) ||
        Object.is(number, -0) ||
        decimalKey(literal) !== decimalKey(String(number))
      ) {
        throw new Error(
          "Unsafe JSON numeric representation; reviewed mapping requires explicit source normalization"
        );
      }
      continue;
    }
    i++;
  }
  return value;
}

type Row = ReturnType<typeof buildMigrationReport>["records"][number];
function applyDecisions(
  row: Row,
  decisions: MigrationReview["decisions"],
  plan: MigrationReview,
  digest: string
) {
  if (!decisions.length) return { ...row, review: { status: "not_requested" } };
  if (!row.candidate)
    return {
      ...row,
      review: { status: "rejected", reason: "Base row is quarantined." },
    };
  const candidate = structuredClone(row.candidate);
  const issues: string[] = [];
  const mapped = new Map<string, { target: string; reason: string }>();
  // Values remain unknown until the owning package validates the full proposal.
  const observation: Record<string, unknown> = { ...candidate.observation };
  for (const decision of decisions) {
    const prefix = decision.field === "eventTime" ? "/temporal/" : "/location/";
    for (const pointer of decision.sourcePointers) {
      if (
        !pointer.startsWith(prefix) ||
        !row.mapping.some((field) => field.pointer === pointer)
      ) {
        issues.push(`Unknown or out-of-domain source pointer: ${pointer}`);
      }
      mapped.set(pointer, {
        target: `/observation/${decision.field}`,
        reason: decision.rationale,
      });
    }
    observation[decision.field] = decision.value;
    if (decision.field === "position") observation.frames = decision.frames;
  }
  observation.extensions = {
    "disclosureos.migration": {
      policy: "legacy-migration-review:0.1.0",
      reviewSha256: digest,
      sourceId: row.sourceId,
      sourcePointer: row.sourcePointer,
      reviewedBy: plan.reviewedBy,
      reviewedAt: plan.reviewedAt,
      decisions,
      reviewerIdentity: "not_authenticated",
      scientificValidity: "not_checked",
    },
  };
  const validated = parseExperimentalClaimHistory({
    ...candidate,
    observation,
  });
  if (!validated.success)
    issues.push(
      ...validated.issues.map((issue) => `${issue.pointer}: ${issue.message}`)
    );
  if (issues.length || !validated.success) {
    const { candidate: omitted, ...rest } = row;
    void omitted;
    return {
      ...rest,
      decision: "quarantined",
      reasons: [...row.reasons, ...issues],
      mapping: row.mapping.map((field) => ({
        pointer: field.pointer,
        disposition: "unresolved",
        reason: "Reviewed mapping rejected; no candidate emitted.",
      })),
      review: { status: "rejected" },
    };
  }
  return {
    ...row,
    candidate: validated.data,
    mapping: row.mapping.map((field) =>
      mapped.has(field.pointer)
        ? {
            pointer: field.pointer,
            disposition: "mapped",
            ...mapped.get(field.pointer)!,
          }
        : field
    ),
    review: {
      status: "applied",
      reviewerIdentity: "not_authenticated",
      scientificValidity: "not_checked",
    },
  };
}

export function reviewMigration(args: ParsedArgs): void {
  if (args.flags["help"]) {
    console.log(
      "disclosureos migrate review <legacy.json> <review.json> [--json]\nApply explicit time/position decisions to review drafts; no imports or file writes."
    );
    return;
  }
  try {
    if (
      args.positional.length !== 2 ||
      Object.keys(args.flags).some((key) => key !== "json")
    ) {
      throw new Error(
        "Usage: disclosureos migrate review <legacy.json> <review.json> [--json]"
      );
    }
    const reviewBytes = readLocal(args.positional[1]!, 2 * 1024 * 1024);
    const parsed = MigrationReviewSchema.safeParse(reviewedJson(reviewBytes));
    if (!parsed.success)
      throw new Error(`Invalid review plan: ${parsed.error.message}`);
    const plan = parsed.data;
    const source = readLocal(args.positional[0]!, 8 * 1024 * 1024);
    if (
      hash(source) !== plan.source.sha256 ||
      source.byteLength !== plan.source.byteLength
    )
      throw new Error(
        "Source byte pin mismatch; regenerate and review decisions for the exact input"
      );
    reviewedJson(source);
    const base = buildMigrationReport(source, plan.namespace);
    const seen = new Set<string>();
    const sourceIds = new Set(base.records.map((row) => row.sourceId));
    const byId = new Map<string, MigrationReview["decisions"]>();
    for (const decision of plan.decisions) {
      const key = JSON.stringify([decision.sourceId, decision.field]);
      if (seen.has(key))
        throw new Error("Duplicate decision for source ID and field");
      seen.add(key);
      const group = byId.get(decision.sourceId) ?? [];
      group.push(decision);
      byId.set(decision.sourceId, group);
      if (!sourceIds.has(decision.sourceId))
        throw new Error("Review decision names an unknown source ID");
      if (
        new Set(decision.sourcePointers).size !== decision.sourcePointers.length
      )
        throw new Error("Duplicate source pointer in review decision");
    }
    const digest = hash(reviewBytes);
    const records = base.records.map((row) =>
      applyDecisions(row, byId.get(row.sourceId ?? "") ?? [], plan, digest)
    );
    const candidates = records.filter(
      (row) => row.decision === "candidate_requires_review"
    ).length;
    const report = {
      ...base,
      kind: "legacy_migration_review_result",
      policy: "legacy-migration-review:0.1.0",
      review: {
        sha256: digest,
        byteLength: reviewBytes.byteLength,
        encoding: "base64",
        bytes: Buffer.from(reviewBytes).toString("base64"),
        reviewerIdentity: "not_authenticated",
      },
      records,
      counts: {
        input: records.length,
        candidates,
        quarantined: records.length - candidates,
        migrated: 0,
      },
    };
    if (args.flags["json"]) console.log(JSON.stringify(report, null, 2));
    else {
      console.log(
        `Experimental migration review: ${
          records.length
        } inputs, ${candidates} candidates, ${
          records.length - candidates
        } quarantined, 0 migrated.`
      );
      for (const row of records)
        console.log(
          JSON.stringify({
            sourceId: row.sourceId,
            decision: row.decision,
            review: row.review,
            unresolvedFields: row.mapping.filter(
              (field) => field.disposition === "unresolved"
            ).length,
            reasons: row.reasons,
          })
        );
      console.log(
        "Review identity and scientific validity remain unchecked. Use --json for pinned inputs, decisions and candidate mappings."
      );
    }
    if (report.counts.quarantined) process.exitCode = 1;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (args.flags["json"])
      console.log(
        JSON.stringify({
          success: false,
          stage: "review_input",
          error: message,
        })
      );
    else console.error(message);
    process.exitCode = 2;
  }
}

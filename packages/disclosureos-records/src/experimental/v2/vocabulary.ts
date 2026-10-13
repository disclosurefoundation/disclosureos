import { z } from "zod";
import { checkTime, type PrimitiveIssue } from "./primitives";
import {
  VocabularyCatalogSchema,
  VocabularyBindingsSchema,
  VOCABULARY_CATALOG_SCHEMA_ID,
  VOCABULARY_BINDINGS_SCHEMA_ID,
} from "./vocabulary-schema";

export interface VocabularyIssue {
  code: string;
  stage: "structural" | "semantic" | "profile";
  pointer: string;
  message: string;
}
function parse<T>(
  schema: z.ZodType<T>,
  input: unknown,
  schemaId: string,
  validate: (data: T, issues: VocabularyIssue[]) => void,
) {
  const parsed = schema.safeParse(input),
    contract = { schemaId, rulesetVersion: "0.1.0" } as const;
  if (!parsed.success)
    return {
      success: false as const,
      contract,
      checks: {
        structural: "failed",
        semantic: "not_checked",
        profile: "not_checked",
        external: "not_checked",
      } as const,
      issues: parsed.error.issues.map(
        (i): VocabularyIssue => ({
          code: "STRUCT.VALUE",
          stage: "structural",
          pointer: "/" + i.path.join("/"),
          message: i.message,
        }),
      ),
      uncheckedRefs: [] as string[],
    };
  const issues: VocabularyIssue[] = [];
  validate(parsed.data, issues);
  const result = {
    contract,
    issues,
    uncheckedRefs: [] as string[],
    checks: {
      structural: "passed" as const,
      semantic: issues.length ? ("failed" as const) : ("passed" as const),
      profile: "not_checked" as const,
      external: "not_checked" as const,
    },
  };
  return issues.length
    ? { ...result, success: false as const }
    : { ...result, success: true as const, data: parsed.data };
}
function time(value: string, pointer: string, issues: VocabularyIssue[]) {
  const times: PrimitiveIssue[] = [];
  checkTime({ kind: "instant", value, timeScale: "UTC" }, pointer, times);
  times.forEach((i) =>
    issues.push({
      code: i.code,
      stage: "semantic",
      pointer: i.pointer,
      message: i.message,
    }),
  );
}
function unique(
  values: Array<{ value: string; pointer: string }>,
  issues: VocabularyIssue[],
  code: string,
) {
  const seen = new Set<string>();
  for (const { value, pointer } of values) {
    if (seen.has(value))
      issues.push({
        code,
        stage: "semantic",
        pointer,
        message: "Identity must be unique within this document.",
      });
    seen.add(value);
  }
}
/** Validates the shared catalog; domain extensions and scientific validity are not assessed. */
export function parseVocabularyCatalog(input: unknown) {
  return parse(
    VocabularyCatalogSchema,
    input,
    VOCABULARY_CATALOG_SCHEMA_ID,
    (data, issues) => {
      time(data.publishedAt, "/publishedAt", issues);
      unique(
        data.terms.map((t, i) => ({ value: t.id, pointer: `/terms/${i}/id` })),
        issues,
        "VOCABULARY.DUPLICATE_TERM",
      );
      unique(
        data.terms.flatMap((t, i) =>
          t.code === undefined
            ? []
            : [{ value: t.code, pointer: `/terms/${i}/code` }],
        ),
        issues,
        "VOCABULARY.DUPLICATE_CODE",
      );
    },
  );
}
/** Local structure only; use the schema evaluator to resolve exact catalog and history bytes. */
export function parseVocabularyBindings(input: unknown) {
  const result = parse(
    VocabularyBindingsSchema,
    input,
    VOCABULARY_BINDINGS_SCHEMA_ID,
    (data, issues) => {
      data.bindings.forEach((b, i) =>
        time(b.recordedAt, `/bindings/${i}/recordedAt`, issues),
      );
      unique(
        data.bindings.map((b, i) => ({
          value: b.id,
          pointer: `/bindings/${i}/id`,
        })),
        issues,
        "VOCABULARY.DUPLICATE_BINDING",
      );
    },
  );
  return result.success
    ? {
        ...result,
        uncheckedRefs: [
          ...new Set(
            result.data.bindings.flatMap((b) => [
              b.claim.document.sha256,
              b.term.document.sha256,
            ]),
          ),
        ],
      }
    : result;
}

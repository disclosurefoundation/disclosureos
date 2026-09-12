import { CaseLinksSchema, CASE_LINKS_SCHEMA_ID } from "./case-links-schema";
import { checkTime, type PrimitiveIssue } from "./primitives";
import type { ContextIssue } from "./context";
export function parseCaseLinks(input: unknown) {
  const parsed = CaseLinksSchema.safeParse(input),
    contract = {
      schemaId: CASE_LINKS_SCHEMA_ID,
      rulesetVersion: "0.1.0",
    } as const;
  if (!parsed.success)
    return {
      success: false as const,
      contract,
      checks: {
        structural: "failed",
        semantic: "not_checked",
        external: "not_checked",
        profile: "not_checked",
      } as const,
      issues: parsed.error.issues.map((i) => ({
        code: "STRUCT.VALUE",
        stage: "structural" as const,
        pointer: "/" + i.path.join("/"),
        message: i.message,
      })),
      uncheckedRefs: [] as string[],
    };
  const data = parsed.data,
    issues: ContextIssue[] = [],
    seen = new Set<string>();
  const problem = (code: string, pointer: string, message: string) =>
    issues.push({ code, stage: "semantic", pointer, message });
  const times: PrimitiveIssue[] = [];
  checkTime(
    { kind: "instant", value: data.recordedAt, timeScale: "UTC" },
    "/recordedAt",
    times,
  );
  times.forEach((i) => problem(i.code, i.pointer, i.message));
  for (const [i, l] of data.links.entries()) {
    if (seen.has(l.id))
      problem("REF.UNIQUE_ID", `/links/${i}/id`, "Link IDs must be unique.");
    seen.add(l.id);
    const loc = l.basis.provenance.locator;
    if (loc?.kind === "time_range" && loc.endSeconds < loc.startSeconds)
      problem(
        "TIME.INTERVAL",
        `/links/${i}/basis/provenance/locator`,
        "Source locator end precedes start.",
      );
    if (l.kind === "intake") {
      const keys = (l.artifactLinks ?? []).map(
        (a) => `${a.artifactId}|${a.observationRef}`,
      );
      if (new Set(keys).size !== keys.length)
        problem(
          "REF.UNIQUE_ID",
          `/links/${i}/artifactLinks`,
          "Artifact associations repeat.",
        );
    }
  }
  const result = {
    contract,
    issues,
    uncheckedRefs: [
      data.caseRef.sha256,
      ...data.links.map((l) =>
        l.kind === "intake" ? l.document.sha256 : l.reference.document.sha256,
      ),
    ],
    checks: {
      structural: "passed" as const,
      semantic: issues.length ? ("failed" as const) : ("passed" as const),
      external: "not_checked" as const,
      profile: "not_checked" as const,
    },
  };
  return issues.length
    ? { ...result, success: false as const }
    : { ...result, success: true as const, data };
}

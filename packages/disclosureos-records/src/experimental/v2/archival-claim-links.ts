import type { ArchivalClaimHistory } from "./archival-claim-history-schema";
import type { LaboratoryClaimHistory } from "./laboratory-claim-history-schema";
import { checkTime, type PrimitiveIssue } from "./primitives";
import type { ContextIssue } from "./context";
export function checkArchivalClaimLinks(
  data: ArchivalClaimHistory | LaboratoryClaimHistory,
) {
  const issues: ContextIssue[] = [];
  const problem = (code: string, pointer: string, message: string) =>
    issues.push({ code, stage: "semantic", pointer, message });
  const snapshots = new Set(data.entityRefs.map((r) => JSON.stringify(r)));
  const sources = new Map<
    string,
    | (typeof data.observation.sources)[number]
    | (typeof data.observation.products)[number]
  >([
    ...data.observation.sources.map((s) => [`source:${s.id}`, s] as const),
    ...data.observation.products.map((s) => [`product:${s.id}`, s] as const),
  ]);
  for (const [i, claim] of data.claims.entries()) {
    const p = `/claims/${i}`;
    const citations =
      claim.kind === "source_assertion"
        ? claim.editionCitation
          ? [claim.editionCitation]
          : []
        : (claim.editionInputRefs ?? []);
    if (
      new Set(citations.map((c) => JSON.stringify(c))).size !== citations.length
    )
      problem("REF.UNIQUE_ID", p, "Edition citations repeat.");
    for (const citation of citations) {
      if (!snapshots.has(JSON.stringify(citation.document)))
        problem(
          "REF.LOCAL_RESOLUTION",
          p,
          "Edition citation must select a declared entity snapshot.",
        );
      const source = sources.get(citation.artifact.sourceRef);
      if (
        !source?.digest ||
        source.digest.value !== citation.artifact.digest.value
      )
        problem(
          "ARCHIVE.ARTIFACT_IDENTITY",
          p,
          "Edition citation must match an inventory artifact's SHA-256 declaration.",
        );
      if (
        citation.locator.kind === "time_range" &&
        citation.locator.endSeconds < citation.locator.startSeconds
      )
        problem("TIME.INTERVAL", p, "Edition locator end precedes its start.");
      if (
        claim.kind === "source_assertion" &&
        (claim.provenance.sourceRef !== citation.artifact.sourceRef ||
          (claim.provenance.sourceDigest &&
            claim.provenance.sourceDigest.value !==
              citation.artifact.digest.value) ||
          JSON.stringify(claim.provenance.locator) !==
            JSON.stringify(citation.locator))
      )
        problem(
          "ARCHIVE.CITATION_SCOPE",
          p,
          "A source statement's provenance and edition citation must name the same artifact and locator.",
        );
    }
    const review =
      claim.kind === "source_assertion"
        ? claim.reportedArtifactReview
        : claim.status === "assessed"
          ? claim.artifactReview
          : undefined;
    if (!review) continue;
    if (
      claim.subject.kind !== "entity" ||
      !["source_edition", "digital_artifact"].includes(
        claim.subject.reference.target.kind,
      )
    )
      problem(
        "ARCHIVE.REVIEW_SUBJECT",
        p,
        "Artifact review requires an exact source-edition or digital-artifact subject.",
      );
    if (
      claim.kind === "assessment" &&
      claim.inputRefs.length +
        (claim.entityInputRefs?.length ?? 0) +
        (claim.contextInputRefs?.length ?? 0) +
        citations.length ===
        0
    )
      problem(
        "REF.LOCAL_RESOLUTION",
        p,
        "Artifact review requires explicit inputs.",
      );
    if (review.reportRef && !sources.has(review.reportRef))
      problem(
        "REF.LOCAL_RESOLUTION",
        p,
        "Review report is absent from the observation inventory.",
      );
    if (review.reviewedAt) {
      const found: PrimitiveIssue[] = [];
      checkTime(review.reviewedAt, `${p}/artifactReview/reviewedAt`, found);
      found.forEach((v) => problem(v.code, v.pointer, v.message));
    }
  }
  return issues;
}

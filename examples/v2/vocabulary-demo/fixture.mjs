import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
export const bytes = (data) =>
  Buffer.from(JSON.stringify(data, null, 2) + "\n");
export const digest = (data) => createHash("sha256").update(data).digest("hex");
export const snapshot = (data, schemaId) => ({
  documentId: data.id,
  schemaId,
  sha256: digest(bytes(data)),
});
export function fixture() {
  const history = JSON.parse(
    readFileSync(new URL("../claim-history.json", import.meta.url), "utf8"),
  );
  const catalog = {
    kind: "vocabulary_catalog",
    schemaVersion: "0.1.0",
    id: "local-characteristics-2026-10",
    catalogId: "urn:example:characteristics",
    revision: "2026-10-13",
    publishedBy: "Example research group",
    publishedAt: "2026-10-13T12:00:00Z",
    terms: [
      {
        id: "radial_motion",
        label: "Radial motion",
        description: "Change in distance relative to a stated reference point.",
      },
    ],
  };
  const binding = (id, claimId, relation, assignedBy) => ({
    id,
    recordedAt: "2026-10-13T13:00:00Z",
    assignedBy,
    rationale:
      "Synthetic declaration of which defined characteristic this statement addresses.",
    claim: {
      document: snapshot(
        history,
        "urn:disclosureos:experimental:claim-history:0.1.0",
      ),
      claimId,
    },
    relation,
    term: {
      catalogId: catalog.catalogId,
      revision: catalog.revision,
      document: snapshot(
        catalog,
        "urn:disclosureos:experimental:vocabulary-catalog:0.1.0",
      ),
      termId: "radial_motion",
    },
  });
  const reviewer = history.claims.find((c) => c.id === "review-2").evaluatedBy;
  const bindings = {
    kind: "vocabulary_bindings",
    schemaVersion: "0.1.0",
    id: "local-term-bindings",
    bindings: [
      binding(
        "reported-characteristic",
        "statement-1",
        "about",
        "person:curator",
      ),
      binding("review-criterion", "review-2", "assessment_criterion", reviewer),
    ],
  };
  return { history, catalog, bindings };
}
export function refresh(f) {
  for (const b of f.bindings.bindings) {
    b.claim.document = snapshot(f.history, b.claim.document.schemaId);
    b.term.document = snapshot(f.catalog, b.term.document.schemaId);
  }
  return f;
}
export const documents = (f) =>
  new Map([f.history, f.catalog].map((v) => [digest(bytes(v)), bytes(v)]));

# RFC 0006: Versioned evaluation profiles

Status: proposed v2 contract. Owner: scoring, with schema owning profile orchestration.

Default evaluation returns separate profile completion, data-quality diagnostics, supported assessment summaries, and disagreement. It MUST NOT infer anomalous support from an origin label. Population coverage remains a labeled descriptive diagnostic and is not independent-analysis completeness.

Each profile pins identity/version, applicability rules, required and recommended inputs, methods, diagnostic codes, and next actions. Required unavailable inputs yield not checked or failure as specified by the profile. Inapplicable requirements are excluded with rationale; they do not improve or suppress unrelated domain assessments. An unassessed domain is not an assessed negative result.

Do not replace legacy compellingness with another unexplained weighted mean. Optional ranking policies are explicit, opt-in, versioned, and experimental until evaluated against controls and independently reviewed cases. Unknown confidence is not 1; repeated identical assessments do not change an outcome; superseded claims are retained but excluded from current summaries. Dependence through shared inputs must be disclosed. A spread between claims is disagreement, not a statistical confidence interval.

Reproducible outputs pin input digests, schema/vocabulary/profile/policy versions, and method/environment identifiers. Arbitrary callbacks without stable identities cannot produce a complete reproducibility record. Reproduction compares declared tolerances, not just matching scores.

Preserve the existing algorithm under a versioned legacy interface. Do not combine its scores with v2 results in a ranking without an explicit comparison method. First implement a sensor-data profile against synthetic controls and the bounded partner pilot. Other profiles remain experimental until exercised and reviewed.

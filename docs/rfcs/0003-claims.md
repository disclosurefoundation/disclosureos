# RFC 0003: Source assertions and supported assessments

Status: proposed v2 contract. Owners: records, observables, origins, schema.

## Decision

A source assertion records what a source states. A current assessment records an evaluator's interpretation and inputs. Their provenance is different and MUST remain separate. Every assertion/assessment has a stable document-scoped ID; changed meaning creates a revision with explicit supersession, not an in-place overwrite. Supersession MUST be acyclic and must not erase the older statement.

```json
{
  "id": "assertion-1",
  "kind": "source_assertion",
  "sourceRef": "source:interview-1",
  "locator": { "kind": "time_range", "startSeconds": 30, "endSeconds": 42 },
  "reportedLevel": "confirmed",
  "text": "Synthetic quoted assertion for contract illustration.",
  "extractedBy": "agent:synthetic-extractor"
}
```

This can be a preservable assertion even when the original speaker is unknown. The extracting system MUST NOT become the speaker or the scientific evaluator. `reportedLevel` preserves the source's wording; it MUST NOT grant current confirmed status.

An assessment includes its evaluator reference, evaluation timestamp, method reference/version, input references, rationale, and status. A profile-eligible confirmed observable additionally requires sensor-derived data products and the method-specific context needed to assess them. Merely resolving `sensor:r` to a descriptor is insufficient. Trace inputs through source/product locators and processing lineage; declaring a method does not prove it was applied correctly.

```json
{
  "id": "assessment-1",
  "kind": "assessment",
  "status": "unassessed",
  "inputRefs": ["assertion:assertion-1"],
  "rationale": "Source assertion preserved; measurement support has not been checked."
}
```

Unassessed is distinct from assessed absence. Testimony may support a reported observation without sensor confirmation. Confidence remains absent when unknown; it does not enter an average as certainty. Multiple claims sharing a source are dependent inputs, not independent votes. Duplicate and superseded assessments must not amplify a result.

## Profile boundary

The archive profile can preserve incomplete assertions with explicit gaps. The supported-assessment profile fails missing attribution, absent methods, dangling references, or insufficient product support. An external reference unavailable offline is not checked and cannot satisfy a required input. A passing automated profile establishes documentary eligibility only. Scientific adequacy and exclusion criteria require separate qualified review.

Legacy claims with insufficient provenance migrate into source assertions with preserved original fields and unresolved mappings. They must not be silently upgraded to current assessments or discarded to make a dataset pass.

## Experimental implementation

The first records-owned implementation is the [experimental claim history](../experimental/claim-history.md): a separate envelope around an Observation snapshot with source text, attributed assessments, and revision semantics. Profile eligibility remains unimplemented and explicitly not checked. Domain-specific scientific rules, shared orchestration, and migration remain follow-up work.

The [assessment documentation profile](../experimental/assessment-documentation.md) now provides an experimental documentary preflight and local byte-integrity checks. It does not implement method-specific scientific eligibility or external verification of locator contents, calibration, or processing.

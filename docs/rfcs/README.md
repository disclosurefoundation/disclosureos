# DisclosureOS V2 design decisions

These RFCs record the design of DisclosureOS V2. RFCs 0001–0006 describe the original WP02 decisions; later implementation is documented in the [experimental contract guides](../experimental). RFC 0007 records the published experimental vocabulary contract and direct definition baseline. See the [current release record](../releases/2.0.0-beta.6.md) for package availability and verification.

| RFC | Decision | Implementation reference |
| --- | --- | --- |
| [0001: Conformance](0001-conformance.md) | Separate structural, semantic and profile checks with explicit unchecked states | [Conformance corpus](../../conformance/README.md) |
| [0002: Missingness](0002-missingness.md) | Keep unknown, redacted and approximate values distinct from valid zero values | [Records primitives](../experimental/records-v2-primitives.md) |
| [0003: Claims](0003-claims.md) | Source assertions remain distinct from attributed assessments | [Claim histories](../experimental/claim-history.md) |
| [0004: Scientific neutrality](0004-scientific-neutrality.md) | Measurements, assessments and hypotheses have separate roles | [Observable definition review](0007-vocabulary/definition-review.md) |
| [0005: Instrument exchange](0005-instrument-exchange.md) | Pin acquisition context and product lineage | [Acquisition context](../experimental/acquisition-context.md) |
| [0006: Evaluation](0006-evaluation.md) | Explicit profiles and diagnostics define what was checked | [Profile evaluation](../experimental/profile-evaluation.md) |
| [0007: Vocabulary references](0007-vocabulary-references.md) | Pin catalog identity, immutable revision and term separately from claim subjects and sources | [Shared vocabulary API](../experimental/vocabulary-references.md) |

RFC 0007 is implemented in the published Beta 6 packages. It directly revises all twelve observable definitions, supplies shared catalog and binding contracts for observables, origins and custom vocabularies, and includes executable reference-resolution checks. It introduces no compatibility aliases or migration crosswalks. The reviewed definitions describe characteristics without treating term membership as an anomaly, mechanism, cause or origin finding.

The [structured definition review](0007-vocabulary/observable-catalog-proposal.json) is editorial material. Package exports supply runtime definitions; `createObservableCatalog` and `createOriginCatalog` create the shared envelopes. Released catalog bytes must be retained unchanged for future reproducibility. Independent scientific review and external authentication remain separate from structural and reference validation.

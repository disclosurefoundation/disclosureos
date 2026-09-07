# DisclosureOS v2 contract proposals

These six proposals implement the design phase of WP02. They define intended requirements for v2 development, not a released contract or completed scientific review. Review serialization choices before implementing new schemas; substantive changes require updating the proposals and their fixtures together.

| RFC | Decision | Next implementation |
| --- | --- | --- |
| [0001: Conformance](0001-conformance.md) | Separate structural, semantic, and profile stages; stable diagnostics and explicit unchecked state | Shared result/rule types and cross-client stage fixtures |
| [0002: Missingness](0002-missingness.md) | Preserve unknown/redacted/approximate values and competing assertions | Records v2 primitives plus non-destructive migration fixtures |
| [0003: Claims](0003-claims.md) | Source assertions remain distinct from supported assessments | IDs, provenance, supersession, and eligibility rules |
| [0004: Scientific neutrality](0004-scientific-neutrality.md) | Measurements, operational assessments, and hypotheses remain separate | Attributed vocabulary review and conventional controls |
| [0005: Instrument exchange](0005-instrument-exchange.md) | Pin acquisition context and product lineage | Revision/session/product contracts and partner adapter |
| [0006: Evaluation](0006-evaluation.md) | Profile completion and diagnostics replace default aggregate ranking | Versioned profiles and legacy reproduction path |

## Current executable scope

The conformance matrix contains 22 synthetic v1-shaped fixtures, checked through runtime, committed JSON Schema, and the actual CLI in normal and strict modes. It freezes observed disagreements rather than certifying v2 agreement. See [the corpus](../../conformance/README.md) for commands and limitations. In particular, successful preservation of unknown confidence does not prove that the legacy scorer handles it correctly, and an accepted offline sensor reference does not prove resolution.

## Review boundaries

- Missingness field names, source/assessment envelopes, and versioned reference serialization are proposals for records implementation, not frozen wire formats.
- Scientific threshold validity and external reproduction need qualified independent review; no reviewer or approval is invented here.
- Preserve immutable v1 artifact IDs. Package major versions and artifact revisions are separate; already-2.x schema families require new revision IDs, not replacement content.
- Browser/Python parity, explicit v2 stage fixtures, conflicting estimates, not-applicable cases, migration reconciliation, and profile eligibility remain necessary before WP02/WP06 can be considered complete.

The next bounded change is records v2 value/provenance primitives with executable known, approximate, unknown, redacted, conflicting, and valid-zero examples. Existing v1 entry points must remain stable until the coordinated release introduces the new API and migration guide.

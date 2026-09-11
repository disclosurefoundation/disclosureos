# C2c laboratory results and attributable material review

This is an **unreleased source checkpoint**. The public npm set remains beta.3;
publication stays on hold under the [consolidated V2 policy](../releases/v2-completion.md).
It extends the [material foundation](materials.md). The full material portal view
is the next C2c checkpoint; application access and case organization remain C3.

## Contracts and use

| Contract | Package entry | API |
| --- | --- | --- |
| research-entities 0.4.0 | records `/experimental/v2` | `parseLaboratoryEntities`, `laboratoryEntitiesJsonSchema` |
| claim-history 0.5.0 | records `/experimental/v2` | `parseLaboratoryClaimHistory`, `laboratoryClaimHistoryJsonSchema` |
| Supplied-document review | schema `/experimental/v2` | `evaluateLaboratoryClaimHistory` |

Explicit records JSON exports are `/experimental/v2/entities/schema/0.4.0` and
`/experimental/v2/claims/schema/0.5.0`. The new entity contract contains witness,
archival and material kinds plus `laboratory_analysis` and `laboratory_result`.
Earlier schema artifacts and parser entry points retain their contracts. Each
history chooses its own entity schema explicitly; nothing rewrites a document
into an earlier version to make it validate.

## Analysis and result identity

An analysis names input specimens, optional preparation records and its result
IDs. A result names the same analysis and one of its input specimens. Dependencies
must exist with the correct kind, result membership is reciprocal, and a selected
preparation must produce an analyzed specimen. An aliquot result never applies
automatically to a parent, sibling or mixture. An empty result list is allowed;
the report that an analysis occurred does not manufacture results.

Analysis fields retain sourced method/version, laboratory, operator, calendar
time, protocol, preparation description and exact report-artifact declarations.
Known, approximate, unknown, redacted and unmapped assertions remain distinct and
may conflict. Unknown operators and methods stay unknown. Preparation descriptions
do not establish calibration, sampling representativeness or method performance.

Result assertions have three forms:

- **Quantitative:** references an observation measurement. Its existing contract
  supplies value, units and explicit uncertainty, including unknown uncertainty.
  The result also records a reported detection/quantification limit, an unknown
  limit with a reason, or an explicit not-applicable reason.
- **Below limit:** records the source-declared threshold, unit, kind and basis.
  There is no numeric measurement slot, so a nondetection is not silently encoded
  as zero. A detection or quantification limit is not measurement uncertainty.
- **Qualitative:** retains the source wording without inventing a numeric result.

The optional analyte field preserves the reported constituent or characteristic.
No chemistry ontology, unit conversion, statistical significance calculation or
automatic threshold interpretation is introduced. Multiple reported results may
coexist; the parser does not choose among them.

## Review remains attributable

Claim-history 0.5.0 addresses exact entity snapshots, fields and assertions, and
retains the existing context, witness and edition-citation behavior. A source
statement may carry `reportedMaterialReview`; an assessed claim may carry
`materialReview`. Unassessed claims cannot carry an assessed review payload.

Material reviews require a material or laboratory entity subject and explicit
inputs. Assessed claims retain evaluator, evaluation time, method/version and
rationale. Quality/custody vocabularies, contamination, representativeness,
limitations and findings are declarations by that reviewer. They are not computed
from the presence of a report, a digest or a laboratory name. Independent reviewers
can disagree; one cannot supersede another's evaluation. Composition alone does
not establish unusual origin, and a valid review document does not validate its
scientific conclusion.

## Supplied-document checks

The evaluator takes UTF-8 JSON bytes keyed by SHA-256. It never fetches URLs. It
checks digest, document ID, explicit schema and complete observation scope for
entity/context snapshots, resolves review subjects and assertion inputs, and
retains the existing archival edition and page-bound checks.

For analytical records it resolves measurement IDs and method/version pairs against
the observation. Report references must match the inventory's declared SHA-256.
A reported threshold must use the measurement's exact unit; no conversion is
inferred. The observation parser separately checks uncertainty and its sources.

For material selection links it also loads the existing physical-sample-selection
0.1.0 document. That contract scopes by observation/history IDs, not an observation
digest. Checks include specimen/transfer uniqueness, selected specimen existence,
known lineage consistency, referenced source records, transfer existence, unambiguous
party declarations and explicitly selected predecessor order. Unknowns remain
unknown. These checks extend the declared transfer's identity rather than creating
a replacement custody profile. The collected-specimen applicability profile is
unchanged and is not run here.

Success means the supplied declarations and references pass these engineering
checks. `sourceArtifactIntegrity`, `scientificInterpretation`, `temporalNormalization`,
`multiSensorFusion` and profile checks remain `not_checked`. No source report bytes,
physical specimen identity, actual laboratory execution, custody completeness or
scientific merit are authenticated. The result names its integrity scope explicitly,
including supplied specimen-selection snapshot bytes. Missing or tampered required
snapshots prevent success and suppress current-claim output.

Public shapes are not an authorization layer or privacy sanitizer. Source names,
storage locations, URLs and free text must already be approved for exchange.

## Worked control and field accounting

The [fictional worked example](../../examples/v2/laboratory-review-demo/README.md)
contains a parent specimen, two aliquots, three analytical result forms and a
review that records uncertainty and custody limitations. It includes source-report
declarations but no report bytes. It is not real ELDÆON data.

The [material field ledger](material-baseline-mapping.csv) now connects retained
analysis wording and quality labels to the typed analytical records and attributable
reviews. Sparse source wording can stay sparse; there is no automatic migration
that fabricates a laboratory or a measured value.

```sh
pnpm --filter "@disclosureos/schema..." build
pnpm test:v2-laboratory
python3 scripts/check-c2-material-mapping.py
node examples/v2/laboratory-review-demo/run.mjs
```

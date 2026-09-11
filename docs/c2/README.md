# C2a: witnesses and accounts

Implementation candidate following C1. These additions are **not in published
2.0.0-beta.1 packages**. Review this package checkpoint before another beta and
its matching portal reference. No stable v2 release, testimony authentication or
scientific profile certification is declared here.

The approved domain design separates witnesses, their accounts and reviewer
interpretations. This checkpoint implements that separation. Document editions,
action-level digital custody and material/analysis entities remain the next C2
sections. Case records and public/private application enforcement remain C3.

## Contracts

| Contract | Owner | Explicit API |
| --- | --- | --- |
| research-entities 0.1.0 | records | `researchEntitiesJsonSchema`, `parseResearchEntities` |
| claim-history 0.3.0 | records | `researchClaimHistoryJsonSchema`, `parseResearchClaimHistory` |
| Supplied-document review | schema | `evaluateResearchClaimHistory` |

Use each package's `/experimental/v2` entry. JSON Schema exports are records
`/experimental/v2/entities/schema/0.1.0` and `/experimental/v2/claims/schema/0.3.0`.
Existing observation and claim-history contracts remain unchanged. The default
claims export and existing testimony applicability profiles retain their stated
versions. Extended history is never silently projected into an older profile.

## Witnesses, accounts, procedures and aggregate declarations

A public research-entities document identifies its author, recording time and
exact observation snapshot. Optional contextual detail is supplied through
explicit context snapshot references; each must also be declared in the history.
It carries four typed entity kinds:

- **witness**: public display identity, anonymity, willingness to be identified,
  category, role, organization, relevant experience, clearance and background.
  Each qualification includes its relevant calendar time, context reference or
  explicit unknown time. A clearance declaration is not authentication.
- **account**: scoped speaker IDs, separate recorder, recording date/precision,
  testimony context, source wording, attributed summary, source document, oath,
  interview/report availability, custody status and supporting artifact references.
  A later retelling has its own account ID and can link to the same witness.
- **procedure**: sourced polygraph administration and result, witness/account,
  date, context and source document. A passed result never validates an account.
- **witness_group**: sourced roster, reported count, categories and aggregate
  descriptions. A count declaration need not equal the documented roster. The
  number of accounts is not a deduplicated or independent witness count.

Fields retain independently identified, sourced assertions. Known, approximate,
unknown, redacted and unmapped states are distinct. Omission has no default value;
explicit false requires provenance. Alternatives may coexist and none is selected
automatically. Summary text identifies its summarizer rather than attributing an
editor's words to a witness. Recording time and event time remain separate.

The worked control describes **Witness A**, an event in **the third quarter of
1952**, a recording in **1981** and a second account in **1990**. Five years of
aviation experience is a sourced declaration relevant to the event quarter. No
July 1 date, UTC instant, missing sensor plot or independent corroboration is
invented. Oath, consent and polygraph status remain unknown. Every person and
statement in the example is fictional.

## Attributable review

Claim-history 0.3.0 accepts observation, measurement, C1 context and research-entity
subjects. Entity subjects select a document ID, exact SHA-256, kind, entity ID and
optional closed field. Entity assertion inputs additionally identify a particular
assertion on that field. `witness:A` and `account:A` are different identities.
Changing the snapshot changes the assessment subject.

An assessed claim can carry `witnessReview`: retained rating/factor/detractor
vocabularies, consistency, independence and notes. This requires an entity subject,
explicit inputs, evaluator, method/version, evaluation time and rationale. Factor
labels are reviewer declarations, not built-in rules. Anonymity never produces an
automatic penalty. Qualitative ratings are not converted to numeric scores. Two
reviewers can disagree; timestamps do not select a winner. Supersession retains
kind, subject, topic and evaluator; claim dependencies remain acyclic.

## What the checks mean

Record parsers check structure, local typed links, uniqueness, date validity and
history rules. External references remain `not_checked` until supplied-document
review. The async evaluator copies supplied bytes, checks SHA-256, requires strict
UTF-8 JSON, verifies document identity and complete observation scope, and resolves
source, context, entity, field and assertion references. It reuses the C1 closed
measurement-role vocabulary. It does not fetch URLs or source artifacts.

A successful result reports integrity only for supplied entities, context,
observation and acquisition snapshots. Source artifact integrity, scientific
interpretation, temporal normalization, sensor fusion and profile applicability
remain `not_checked`. Declared source hashes are compared for consistency but are
not authenticated against source bytes. An unavailable snapshot prevents success.

Strict public shapes reject private identity-map and contact properties. This is
**not a privacy sanitizer or authorization system**: free text, public identity
values and source URLs must already be approved for publication. The example and
its exports contain only fictional public fields. Applications must not serialize
private intake envelopes into these documents; comprehensive access and output
controls belong to the C3 checkpoint.

## Coverage and verification

[The field ledger](witness-baseline-mapping.csv) accounts for all frozen v1
witness/testimony occurrences. Source-document edition fields have explicit C2b
owners rather than being falsely marked complete. The dated baseline is unchanged.
`check-c2-witness-mapping.py` checks accounting against its exact schema digest;
field counts do not establish semantic equivalence.

From the repository root, using Node 22:

```sh
pnpm --filter "@disclosureos/schema..." build
pnpm test:v2-entities
python3 scripts/check-c2-witness-mapping.py
```

The [worked example](../../examples/v2/witness-accounts-demo/README.md) can also run
in a consumer using the candidate records/schema builds. Publication and the
portal page follow review of this checkpoint, so live beta documentation will not
advertise APIs that its installed package version lacks.

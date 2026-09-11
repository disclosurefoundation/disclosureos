# C2c material foundation: identity, physical custody and lineage

This is an **unreleased source checkpoint**, not an API in npm beta.3. Further npm
publication is held until the remaining V2 implementation is complete under the
[consolidated release policy](../releases/v2-completion.md).

A collected specimen, an uncollected surface trace, a file describing either, and
a laboratory interpretation are different records. This checkpoint provides the
material foundation. The [laboratory checkpoint](laboratory.md) adds typed results,
measurement links, review claims and supplied-snapshot resolution. The material
portal preview is merged in [dashboard #222](https://github.com/disclosurefoundation/dashboard/pull/222),
with production access still blocked pending the coordinated release.

## What this checkpoint implements

Research-entities `0.3.0` retains the existing witness and archival entity kinds
and adds four kinds:

| Kind | Meaning |
| --- | --- |
| `material` | A physical specimen with declared collected, derived or unresolved lineage. Retains label, type, description, collection time/method/person/organization, storage, reported quality/custody, photograph/report availability, original analysis wording and notes. |
| `material_trace` | A reported physical trace with its own description, location, recording context and source references. A trace does not establish collection of a specimen. A collected material may explicitly link to the described trace. |
| `material_preparation` | Explicit input and output specimens, operation and sourced method/version, operator, organization, time and description. Every output names this same preparation in its lineage. |
| `material_custody_action` | An action on one exact local specimen, with sourced time, parties, location and reference. Its predecessor is an action on that specimen, a declared beginning or an explicit unknown gap. |

All descriptive fields use independent sourced assertions with known,
approximate, unknown, redacted and unmapped states. Conflicts coexist. A known
false requires provenance; omission is not false. Collection time retains calendar
precision. A qualitative quality label, availability flag or reported analysis
summary is a source declaration, never an executed laboratory test or independent
review. Legacy media and radiation/EM records belong to source/product inventories
and measurements; unresolved labels can remain unmapped rather than being forced
into a material category.

## Physical identity and custody

Material IDs are local to this document. An aliquot has its own identity; it does
not inherit collection metadata, a custody chain or analytical results from its
parent. Shared specimen labels in different documents do not prove physical identity.
A SHA-256 identifies document bytes or digital artifacts, not a physical object.

When describing an existing physical-sample selection, `material.selectionRef`
selects its exact document ID, schema ID, digest and specimen ID. Reuse that
specimen ID. A custody action may identify its existing transfer through
`transferRef`; it must reuse the transfer ID and the material's same selection
snapshot. These links remain externally unchecked here. The laboratory checkpoint's
supplied-document resolver verifies actual selection contents and observation scope. Local
reference consistency does not establish that a selection or transfer exists.

The existing `evaluatePhysicalSamples` selection/profile remains separate and
unchanged. It is not extended to certify derived samples by this document. No
second independent chain or automatic public profile is manufactured from material
metadata. Array order is not chronology. Known single-party handoffs must agree;
comparable unambiguous action times cannot reverse predecessor order. Unknown or
conflicting declarations remain unresolved. No computed custody-complete flag is
returned.

## Preparation and lineage

Inputs and outputs must resolve to material entities; traces and digital files
cannot stand in for specimens. A split has one input and at least two outputs;
a mixture has at least two inputs and one output. Generic preparation/other
operations retain explicit nonempty input/output sets. All outputs must be distinct
from all inputs. Duplicate identities, parent cycles and competing assignments of
one output to different preparations fail local checks.

These are relationship conventions, not a mass-balance calculation. A split does
not prove conservation of mass, representative sampling, noncontamination or
physical execution. No quantities, units, dates or laboratory identities are
invented. More detailed preparation protocols and typed result interpretation
belong to the following analytical checkpoint.

## APIs and validation boundaries

From the source-built `@disclosureos/records/experimental/v2` entry:

- `MaterialEntitiesSchema`, `MaterialEntitySchema` and `parseMaterialEntities`
- `materialEntitiesJsonSchema` and `MATERIAL_ENTITIES_SCHEMA_ID`
- Typed entity and assertion-reference schemas for later claim addressing

The explicit JSON Schema export is
`@disclosureos/records/experimental/v2/entities/schema/0.3.0`, with identity
`urn:disclosureos:experimental:research-entities:0.3.0`.

`parseMaterialEntities` checks structure, typed local identities, graph consistency,
provenance presence and local time rules. It retains the witness/archival local
validation rules and returns the original new-version document. It does not project
that document through an older parser. Previously published schemas and entry
points retain their bytes and versions.

Even on success, `checks.external` and `checks.profile` remain `not_checked`.
Observation, context, source and selection references are listed as unchecked;
no URLs are fetched and no snapshot or source artifact bytes are verified. Current
claim-history 0.4.0 does not accept material entities 0.3.0. A matching new claim
history and supplied-document evaluator are provided separately by the unreleased
[laboratory checkpoint](laboratory.md), using entities 0.4.0 and history 0.5.0.

Public fields are not a privacy sanitizer: names, storage locations, URLs and
free text must already be approved for public exchange. Application access and
output enforcement remain C3.

## Worked control and field accounting

The [fictional material control](../../examples/v2/material-lineage-demo/README.md)
contains an uncollected impression, a collected soil specimen, two derived aliquots
and explicit custody gaps. Reported spectroscopy has no invented result or report.
The control is not real ELDÆON material.

The [30-row field ledger](material-baseline-mapping.csv) accounts for all frozen
`physicalEvidence` occurrences and the generic physical-custody fields handed off
by C2b. Original analysis and quality wording have a home in the material
foundation. Richer results and reviewer semantics are provided by the
[laboratory checkpoint](laboratory.md). Accounting is not an assertion that all of C2c is complete.

```sh
pnpm --filter @disclosureos/records build
pnpm test:v2-materials
python3 scripts/check-c2-material-mapping.py
node examples/v2/material-lineage-demo/run.mjs
```

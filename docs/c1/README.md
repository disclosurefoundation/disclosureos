# C1: event context and addressable claims

Implementation candidate for the approved domain-completion design. The new APIs
are **not in the published 2.0.0-beta.0 packages**. This document travels with the
package PR; publication and the portal's package-pin update are separate steps.
No stable v2 release or scientific review is declared by this checkpoint.

## Contracts and package ownership

| Contract | ID/version | Owner and new export |
| --- | --- | --- |
| Observation context | `urn:disclosureos:experimental:observation-context:0.1.0` | records, `observationContextJsonSchema`, `parseObservationContext`; JSON at `experimental/v2/context/schema/0.1.0` |
| Context-aware claim history | `urn:disclosureos:experimental:claim-history:0.2.0` | records, `contextClaimHistoryJsonSchema`, `parseContextClaimHistory`; JSON at `experimental/v2/claims/schema/0.2.0` |
| Cross-document review | Declared checks, no new scientific profile | schema, async `evaluateContextClaimHistory` |

All functions use the owning package's `/experimental/v2` entry. The existing
Observation 0.1.0, acquisition contract and claim-history 0.1.0 artifacts, parsers
and default schema exports remain unchanged. Do not feed a 0.2.0 history to existing
provenance profiles: they accept their documented versions, not silently stripped
approximations. A future profile must explicitly opt into a new version.

No Zod object crosses package boundaries. Schema calls the records and instruments
parsers and receives their plain outputs. New JSON schemas share local `$defs` to
avoid repeating large provenance definitions. Record parsing performs no fetching
or hashing; cross-document evaluation uses Web Crypto on supplied byte copies and
works without importing Node-only modules into the package entry.

## Describe a field without promoting a report into a fact

A context document names its observation snapshot and optionally an acquisition
snapshot. It records its curator and time and carries typed entities:

- `event`: sourced event descriptor and links to setting/time.
- `reported_object`: shared shape/maneuver vocabulary, appearance, sound,
  formation, movement descriptions and reported radar/infrared contact.
- `place`: geography, framed position, site/terrain/airspace, proximity and
  infrastructure sensitivity, separate from publication instructions.
- `platform`: observer/station/aircraft/vessel roles, identity, mission and
  sourced operational declarations.
- `environment`: station/place/time, weather, visibility, celestial conditions
  and links to ambient measurements.
- `temporal`: existing event-time values, historical calendar periods/ranges,
  relative anchors, local clocks, timezone declarations and narrative duration.
- `collection`: acquisition/product references, retention, anomalies and declared
  correlation/alignment context. It does not certify fused tracks.

Each field is an optional, non-empty list of assertions with IDs. Missing fields
mean not supplied. Assertions use known, approximate, unknown, redacted or unmapped
content. Known means a value was provided with provenance, not verified truth.
Unknown has a reason; an unmapped source term retains its original wording instead
of pretending to match a shared vocabulary. Zero/false remain supplied values,
never substitutes for missingness. Source locators and original wording survive.

```json
{
  "kind": "reported_object",
  "id": "object-A",
  "fields": {
    "shape": [
      {
        "id": "shape-1",
        "content": {
          "state": "known",
          "value": "triangle",
          "originalWording": "a triangular light",
          "provenance": { "sourceRef": "source:account-a" }
        }
      }
    ]
  }
}
```

This is an entity fragment, not a standalone document. Contradictory assertions
are separate entries. An optional selection cites a field's chosen assertion and
considered assertions, reviewer, method/version, time and rationale. Selection does
not copy or derive a second value, and cannot silently pick the latest assertion.
The example deliberately leaves its conflicting shapes unselected.

## Measurement roles and historical time

Numeric quantities remain in the Observation. An entity's `measurements` links an
ID and role to a measurement ID; the cross-document evaluator checks entity kind,
quantity, unit and relevant range. For example, `ambient_temperature` belongs to
an environment, accepts `temperature` or `ambient_temperature`, and uses `Cel` or
`K`. `target_temperature` or a length unit fails. The complete closed role table is
exported as `CONTEXT_MEASUREMENT_ROLES`. No unit inference/conversion occurs.

Proximity assertions identify the other place and optional distance/bearing
measurements; a nearest-site declaration does not prove a spatial search occurred.
Known geographic positions reuse observation frame/unit/source checks. Unknown
position is valid. Infrastructure sensitivity preserves the earlier critical/high/
moderate/standard/none meaning; it is not confused with public/withheld access.

Quarter, decade and century values do not manufacture a representative instant.
Calendar ranges retain endpoint certainty, display, notes, range purpose and end
inclusivity. Same-precision reversed ranges fail; different endpoint precisions
remain represented without claiming normalization. Relative anchors are local
identified temporal entities and must be acyclic. `around` and week offsets remain
expressible. An unavailable outside anchor is represented by an explicitly unknown
local anchor; it is not automatically fetched. Local timezone names are checked
without computing or guessing UTC/DST conversions. Temporal normalization remains
`not_checked`.

## Exact snapshots and claims

`{documentId, schemaId, sha256}` selects an exact document. IDs must match the bytes
and contracts must parse under the stated version. A same-ID but different-content
observation cannot be substituted for the embedded history observation. The byte
hash differs when serialization differs; parsed equality ignores object key order
but preserves list order. URLs, signatures and automatic entity resolution are
outside this check.

A 0.2.0 history has explicit `contextRefs`. A context claim subject contains a
`reference` with a document snapshot and `{kind,id,field?}` target. Field names are
closed per entity kind. An assessment's optional `contextInputRefs` adds
`assertionId`; input resolution requires the named field. Existing `inputRefs`
remain available for measurements, sources, products, assertions and claims.

The dependency direction is Observation/acquisition, then context, then history.
Strict contracts exclude reverse links. Context entity links and relative dates
resolve locally; array indices are not research identities. C1 targets only the
seven implemented context kinds. Witness/material/case targets await their own
C2/C3 contracts rather than permitting unvalidated future kinds now.

Supersession keeps kind, topic, subject (including snapshot), evaluator and time
rules. Claims from different reviewers coexist. A changed context snapshot needs
a new assessment, which may cite an earlier claim as input; it cannot supersede a
claim about different bytes as though its subject were unchanged. Current means
not superseded, not scientifically confirmed.

## Run the complete synthetic case

From this repository after installing and building the packages:

```sh
pnpm --filter '@disclosureos/schema...' build
node examples/v2/context-demo/run.mjs
pnpm test:v2-context
```

The example includes independent optical/radio acquisitions, known source bytes,
station temperature, two conflicting shape reports and unknown alignment. Every
value and account is fictional. It is not ELDÆON data. Files in the example folder
are reproducible with `node conformance/emit-context-example.mjs`.

A caller supplies a history and a map of SHA-256 to exact UTF-8 JSON bytes:

```ts
import { evaluateContextClaimHistory } from '@disclosureos/schema/experimental/v2';
const result = await evaluateContextClaimHistory(history, { documents });
```

The complete runnable code is [run.mjs](../../examples/v2/context-demo/run.mjs).
Do not label the fragment above as runnable without the input documents.

The valid example returns structural and semantic checks passed, profile
`not_checked`, external passed. `integrityScope` restricts that last result to
supplied context/observation/acquisition snapshot bytes. Source artifact integrity,
scientific interpretation, temporal normalization and sensor fusion remain
`not_checked`. Missing snapshot bytes prevent success and leave external checks
incomplete; changed bytes fail integrity. Supplying no contexts does not manufacture
an external-check pass. Calibration and alignment unknowns remain unknown even
when all document references resolve.

## Coverage and remaining milestones

The [field ledger](baseline-mapping.csv) explicitly maps every baseline occurrence
assigned to C1, with owner/destination and semantic notes. It is an implementation
map, not an automatic converter or a completeness score. The baseline source is
records 1.1.0 as inventoried in dashboard commit
`2576920f6b5885f94289540964f66881a9cd78f7`. No whole-domain disposition is silently
promoted to complete by these rows.

C2 retains witness/document/material/analysis/digital-provenance work. C3 retains
case relationships, investigation/response, presentation and enforcement of the
public/private boundary. The design scenario's link to a second observation is
therefore a C3 case relationship, not a new C1 chronology graph. This evaluator
never treats source access or location sensitivity as authorization or redaction.
The existing public dataset viewer and scoring behavior are unchanged.

The remaining C1 delivery step after package review is a beta publication and a
portal pin update. The portal must display schema fields from that published
artifact, not a parallel hand-maintained schema. See the dashboard companion
checkpoint for the prepared reference page and cutover checklist.

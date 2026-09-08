# Experimental physical-sample provenance profile

`evaluatePhysicalSamples` checks selected collected-specimen declarations, their
supplied custody sequence and the exact bytes of cited records. A specimen is not a
source file or a measurement. This selection introduces local specimen declarations
without changing the base observation or claim-history contracts.

This is a bounded WP08 documentation convention, not a reviewed laboratory standard,
forensic chain-of-custody certification or scientific origin assessment.

Profile: `urn:disclosureos:experimental:profile:physical-sample-provenance`, version
`0.1.0`, scope `selected_collected_specimen_custody_declarations`.
Selection schema: `urn:disclosureos:experimental:physical-sample-selection:0.1.0`.

## Run the synthetic example

Use Node 22 after installing repository dependencies:

```sh
pnpm --filter '@disclosureos/schema...' build
node --input-type=module <<'JS'
import { readFileSync } from 'node:fs';
import { evaluatePhysicalSamples } from './packages/disclosureos-schema/dist/experimental/v2/index.js';
const root = 'examples/v2/physical-sample-demo';
const history = JSON.parse(readFileSync(`${root}/history.json`, 'utf8'));
const selection = JSON.parse(readFileSync(`${root}/selection.json`, 'utf8'));
const assets = new Map([['source:report', new Uint8Array(readFileSync(`${root}/custody.txt`))]]);
const result = await evaluatePhysicalSamples(history, selection, { assets });
console.log(JSON.stringify(result.samples, null, 2));
JS
```

This is entirely synthetic: there is no real specimen, collector, custodian, field
collection, laboratory result or partner material. The example contains a restricted
source declaration to exercise access preservation; the fixture itself is repository
example data. Observation time and position remain unknown, with no measurements or
assessments. Record timestamps are not specimen collection dates.

Installed consumers import from `@disclosureos/schema/experimental/v2`. JSON Schema
exports are `@disclosureos/schema/experimental/v2/physical-samples/schema` and its
`/0.1.0` alias. Public types include `PhysicalSampleSelection`, `PhysicalSampleResult`,
`PhysicalSampleReport`, `PhysicalSampleRecordCheck`, requirement and issue types.
These APIs are unreleased; existing package versions and schemas remain unchanged.

## Explicit specimen selection

A strict selection contains `kind: physical_sample_selection`, `schemaVersion`,
a local `id`, exact `historyId` and `observationId`, and a nonempty `samples` array.
Each sample has a unique local `id` and the following declarations:

| Field | Meaning |
| --- | --- |
| `lineage` | `collected_specimen`, `derived_sample`, `mixture` or `unknown` |
| `label` | Known recorded specimen label, or unknown with a reason |
| `collection` | Known `collectedBy` attribution and `recordRef`, or unknown with a reason |
| `custody` | Explicitly documented ordered `transfers`, or unknown with a reason |
| `currentCustodian` | Known `holder` and `recordRef`, or unknown with a reason |
| `catalogIdentifier` | Optional existing external catalog or persistent sample identifier |

Known labels use `{ state: "known", value }`. Collection and current custody use
`state: known` with the fields above. Unknown declarations use
`{ state: "unknown", reason }`. Documented custody uses
`{ state: "documented", transfers: [...] }`; each transfer supplies a unique local
`id`, `from`, `to` and `recordRef`.

Only declared `collected_specimen` lineage is applicable in this increment. Unknown
lineage remains a missing applicability input. Derived samples and mixtures fail this
selected scope and block downstream checks. This does not invalidate them in the wider
standard. Do not relabel aliquots, processed material or mixtures to make this profile
pass. Derivation, splitting, mixing and destructive-analysis lineage remain future work.

Sample IDs are local declaration identifiers, not proof of distinct objects. Labels
and external identifiers are not authenticated or checked for global uniqueness. The
history/observation link is a supplied association, not proof that a specimen came from
an observed event. Origin remains unchecked.

## Custody continuity and records

The supplied transfer array is checked in its declared order. The first sender must
match the collector; each subsequent sender must match the preceding recipient; and
the final recipient must match the declared current custodian. Matching uses exact
strings. No alias resolution, identity authentication or organization lookup occurs.
Self-transfers fail because this array represents handoffs. Inventory checks belong
in the source records. Returning to an earlier holder through connected handoffs is
allowed.

An explicitly documented empty transfer array can pass when collector and current
custodian agree. It declares no handoffs. It must not replace missing custody history;
use `state: unknown` for that. Known internal conflicts are still reported when a
collection or current-custodian declaration is missing. Without both endpoints, a
conflict-free partial sequence remains unchecked.

No transfer timestamps are modeled by this profile. Declared order does not establish
chronology, uninterrupted possession, completeness or genuine custody. Collection time,
place, preservation conditions, signatures and seals can be retained in the cited
records but are not inspected here. Do not infer them from observation metadata.

Each `recordRef` must resolve to a source in the supplied base history. Collection,
transfer and current-custody records can cite the same source; its bytes are checked
once per selected sample. A record's kind and access declaration are preserved. This
profile checks citations and bytes without requiring records to be public or assuming
that a particular file format establishes custody.

The source must declare SHA-256, and caller-supplied nonempty local bytes must match.
A digest verifies the cited record bytes, not the specimen. The evaluator does not
read the record to establish whether it actually names the label, collector or holder.
Repeated use of one record does not create independent corroboration.

## Required and recommended inputs

| Requirement | Importance | Passing scope |
| --- | --- | --- |
| Sample scope | Required | Declared collected specimen |
| Sample identity | Required | Recorded label supplied |
| Collection record | Required | Collector and resolved record citation supplied |
| Custody record | Required | Supplied handoff sequence connects the declared endpoints |
| Current custodian | Required | Holder and resolved record citation supplied |
| Record integrity | Required | Every cited record has matching nonempty local bytes |
| Catalog identifier | Recommended | Existing external identifier is retained when available |

The catalog recommendation is a non-blocking identification aid, not a laboratory
requirement or scientific weight. Registration, resolution and uniqueness are unchecked.
No identifier should be invented to satisfy it.

Missing required declarations or digest pins and known custody/byte conflicts fail.
Unavailable bytes or hashing leave the profile unchecked unless another required check
has failed. Invalid selections or histories, duplicate sample/transfer IDs and unresolved
references yield no positive sample rows. Empty record sets cannot produce an integrity
pass. Results retain per-sample requirements, blocked prerequisites, reasons, actionable
diagnostics, per-record byte checks, parsed selection and the full base validation.
A later missing-file warning cannot hide an earlier byte mismatch.

## Interpretation and access boundaries

`specimenIdentity`, `collectionAuthenticity`, `custodyAuthenticity`,
`custodyCompleteness`, `custodyChronology`, `recordContents`, `contaminationControl`,
`composition`, `origin`, `redistributionRights`, `assessmentSupport` and
`scientificEligibility` remain `not_checked`. No score, confidence default, chemical
interpretation, contamination clearance or unusual-origin inference is produced.
A confirmed assessment in the history remains a declaration, not an endorsed result.

All access states are preserved. Legitimately held local records can be checked
without making their contents public. The result includes the full validated history
and sample selection; it is not a redaction or public-projection mechanism. Apply access
policy before displaying it. The API never fetches URLs or modifies inputs. Selection,
history and supplied bytes are snapshotted before asynchronous hashing. Callers must
bound untrusted input sizes before loading records or bytes.

## Relationship to established provenance work

The [IGSN metadata project](https://github.com/IGSN/metadata) distinguishes identifier
registration from sample description. This profile similarly keeps the optional
external identifier separate from a specimen's provenance declarations; it does not
register identifiers or claim IGSN conformance.

[W3C PROV-O](https://www.w3.org/TR/prov-o/) distinguishes entities, activities and
responsible agents, including derivation relationships. These concepts inform future
interoperability and derivation work. This local JSON profile supplies no PROV-O mapping
or conformance claim. Its required groups are experimental project conventions, not
requirements attributed to either external standard.

Qualified laboratory/collection review, conventional controls, derived-sample lineage,
profile-specific receipts/replay and consumer presentation remain open. The
[evaluation checkpoint](evaluation-checkpoint.md) distinguishes these from implementation.

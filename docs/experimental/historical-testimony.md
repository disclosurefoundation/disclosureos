# Experimental historical-testimony provenance profile

`evaluateHistoricalTestimony` checks explicitly selected testimony sources and their
supplied direct extractions. It does not require sensor measurements, known event
time or location, evaluator assessments, public access, or a legal name for a speaker.
This is an experimental WP08 traceability convention, not a reviewed credibility
model. “Historical” identifies the intended use; no age threshold or inferred event
date is applied. Contemporary recorded testimony can use the same contract.

Profile: `urn:disclosureos:experimental:profile:historical-testimony-provenance`,
version `0.1.0`, scope `selected_testimony_sources_and_direct_extractions`.
Selection schema: `urn:disclosureos:experimental:historical-testimony-selection:0.1.0`.

## Run the synthetic example

Use Node 22 after installing repository dependencies:

```sh
pnpm --filter '@disclosureos/schema...' build
node --input-type=module <<'JS'
import { readFileSync } from 'node:fs';
import { evaluateHistoricalTestimony } from './packages/disclosureos-schema/dist/experimental/v2/index.js';
const root = 'examples/v2/historical-testimony-demo';
const history = JSON.parse(readFileSync(`${root}/history.json`, 'utf8'));
const selection = JSON.parse(readFileSync(`${root}/selection.json`, 'utf8'));
const assets = new Map([['source:report', new Uint8Array(readFileSync(`${root}/account.txt`))]]);
const result = await evaluateHistoricalTestimony(history, selection, { assets });
console.log(JSON.stringify(result.accounts, null, 2));
JS
```

The fixture is entirely synthetic, including its recorder and pseudonymous speaker.
Its restricted access label exercises preservation of that declaration; the fixture
itself is repository example data. Unknown event time and position remain unknown.
No real witness, partner dataset, event date, measurement or assessment is fabricated.
The example URL is not fetched.

Installed consumers import from `@disclosureos/schema/experimental/v2`. Selection
schema exports are `@disclosureos/schema/experimental/v2/historical-testimony/schema`
and its `/0.1.0` alias. Types include `HistoricalTestimonySelection`,
`HistoricalTestimonyResult`, `HistoricalTestimonyReport`, and requirement/issue types.
These additions are unreleased; existing package versions and schemas are unchanged.

## Selection and recording citation

The strict selection contains `kind: historical_testimony_selection`, `schemaVersion`,
a local `id`, exact `historyId` and `observationId`, and a nonempty `accounts` array.
Each entry supplies a unique existing `sourceRef` and a `recording` declaration:

- `{ state: "known", recordedBy, reference }` identifies the declared person or
  organization responsible for preserving the account and a citation or record ID.
  This can describe a transcript, interview record or recording; it does not require
  audio or video. It does not establish who spoke or authenticate the recorder.
- `{ state: "unknown", reason }` preserves missing recording context. It is valid
  input but does not satisfy the required recording citation.

Each selected source must declare `kind: testimony`. Unknown kind is missing;
known other kinds fail applicability. A document containing testimony may remain a
`document` source and use the released-document profile. Do not relabel it to pass;
represent separately sourced testimony only when the actual provenance supports it.

All access states are retained, including restricted, withheld and unknown. A caller
who legitimately holds local bytes can check integrity without changing their access
status. Neither supplied bytes nor a passing result establishes redistribution rights.
This is not a public projection. Callers must apply access policy before presenting
returned history or selections, including speaker labels.

## Requirements and next actions

| Group | Importance | What is checked |
| --- | --- | --- |
| Testimony source | Required | Source declares testimony |
| Recording citation | Required | Recorder/preserver attribution and a reference are supplied |
| Content digest | Required | Source declares SHA-256 for the exact preserved account |
| Content integrity | Required | Supplied nonempty local bytes match that digest |
| Extraction traceability | Required when direct extractions exist | Each has a locator, extractor identity and speaker attribution |
| Source title | Recommended | Human-readable citation aid is present |
| Source URI | Recommended | Retrieval reference is present; it is never fetched |

Recommendations are non-blocking experimental citation aids, not scientific weights.
Missing required metadata fails this selected checklist. Missing local bytes or hash
capability leaves it unchecked unless another required check has already failed.
Empty or mismatching bytes fail. Missing digests block byte comparison. Invalid base
histories, empty selections, duplicates, mismatched IDs and unresolved references yield
no positive account rows. Full base validation and the parsed selection are retained.

Current `source_assertion` claims and observation value assertions directly citing
a selected source form the extraction scope. Each must declare `locator`, `extractedBy`
and `attributedTo` in its existing provenance. `attributedTo` is the speaker label
actually used in the account; a documented pseudonym is sufficient. Never infer the
speaker from `recordedBy` or `extractedBy`. A missing speaker label remains a gap.
Mixed-speaker material should retain passage-specific attribution rather than assigning
one presumed witness to the whole record. Attribution strings are not authenticated.

Superseded claims do not determine the current extraction checklist. No direct extraction
means `not_applicable`, not exhaustive transcription. Page, time-range and JSON-pointer
locators use the existing contract; their content and bounds are unchecked. Derived
translations, OCR, edited recordings and transitive processing require their own
provenance and remain outside this direct-extraction scope. Digest agreement proves
identity with the declared bytes, not that a transcript faithfully represents speech.

## Interpretation boundaries

Every account retains separate requirements, reasons, blocked prerequisites, next
actions, extraction references and byte results. Unknown event context is preserved.
No credibility score, confidence default, independent-witness count or aggregate grade
is produced. Repeated accounts do not become corroboration through this profile.
Use the separate assessment summary to inspect current declarations and shared inputs.

`recordingAuthenticity`, `speakerIdentity`, `accountAccuracy`, `firsthandKnowledge`,
`witnessIndependence`, `redistributionRights`, `locatorContents`, `extractionAccuracy`,
`assessmentSupport` and `scientificEligibility` remain explicitly `not_checked`.
A structurally valid confirmed assessment can coexist with a passing testimony profile;
this does not evaluate or endorse that assessment or turn reported statements into
sensor-confirmed findings. Assessment documentation and research-prerequisite validators
remain separate and unchanged.

Inputs and bytes are snapshotted before asynchronous hashing and are not modified.
No network request occurs. Library callers should bound untrusted input sizes before
loading records or bytes. The output contains the full validated history and selection,
so it is not a redaction mechanism.

A collected-specimen profile is available separately. Qualified review of these
experimental rules and CLI/Index presentation remain separate work. See the
[evaluation checkpoint](evaluation-checkpoint.md).

Exact-input receipts and fixed local replay are available through the experimental
[profile-evaluation workflow](profile-evaluation.md). Their results preserve this
profile's applicability, failures, missingness and interpretation limits.

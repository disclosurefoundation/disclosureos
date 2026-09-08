# Experimental released-document provenance profile

`evaluateReleasedDocuments` checks documentary provenance for an explicitly selected
set of document sources. It accepts records with unknown event time or location,
no sensor measurements and no evaluator assessments. A released archival record
need not pretend to be an instrument observation to have useful traceability.

This is an experimental WP08 profile, not a reviewed scientific threshold or an
authentication service. It checks supplied declarations and local bytes, not whether
a release actually occurred, whether publication is authorized, or whether claims
inside the document are true. Assessment support and scientific eligibility remain
explicitly unchecked.

Profile: `urn:disclosureos:experimental:profile:released-document-provenance`, version
`0.1.0`, scope `selected_document_sources_and_direct_extractions`.
Selection contract: `urn:disclosureos:experimental:released-document-selection:0.1.0`.

## Run the synthetic example

Use Node 22 after installing repository dependencies:

```sh
pnpm --filter '@disclosureos/schema...' build
node --input-type=module <<'JS'
import { readFileSync } from 'node:fs';
import { evaluateReleasedDocuments } from './packages/disclosureos-schema/dist/experimental/v2/index.js';
const root = 'examples/v2/released-document-demo';
const history = JSON.parse(readFileSync(`${root}/history.json`, 'utf8'));
const selection = JSON.parse(readFileSync(`${root}/selection.json`, 'utf8'));
const assets = new Map([['source:report', new Uint8Array(readFileSync(`${root}/document.txt`))]]);
const result = await evaluateReleasedDocuments(history, selection, { assets });
console.log(JSON.stringify(result.documents, null, 2));
JS
```

The fixture is a synthetic text document, not a real release. Its citation explicitly
says so. Its event time and position remain unknown, and it contains only a source
assertion. No measurements, assessments, release authority or partner data are invented
as real facts. The example URI is not fetched.

Installed consumers use `@disclosureos/schema/experimental/v2`. Selection schema
exports are `/experimental/v2/released-documents/schema` and the `/0.1.0` alias on
the schema package. These additions are unreleased; existing schemas and package
versions remain unchanged.

## Explicit selection and applicability

The strict selection document contains `kind: released_document_selection`,
`schemaVersion`, a local `id`, the exact `historyId` and `observationId`, and a nonempty
`documents` array. Each entry supplies a unique existing `sourceRef` and a `release`:

- `{ state: "known", releasedBy, reference }` records a declared releasing authority
  or publisher and a citation, catalog identifier or release reference.
- `{ state: "unknown", reason }` preserves a gap. It is structurally valid but does
  not satisfy the release-citation requirement.

The selected source must declare `kind: document` and `access: public`. Unknown
values remain missing; known conflicting kinds or restricted/withheld access fail
this selected profile. Other record kinds remain valid in the base standard. Next
actions never recommend removing restrictions or changing classification merely to
pass. A public access declaration does not establish redistribution rights.

The full base history is validated first. Invalid histories or mismatched, duplicate,
empty or unresolved selections do not yield a positive document result. Valid but
incomplete unselected documents do not penalize the selected sources. The parsed
selection and unmodified full history validation result remain available in output.

## Required and recommended groups

| Group | Importance | Meaning |
| --- | --- | --- |
| Document source | Required | A selected source declares a public document |
| Release citation | Required | A release attribution and reference are supplied |
| Content digest | Required | SHA-256 is declared on that source |
| Content integrity | Required | Exact nonempty local bytes match the declared SHA-256 |
| Extraction traceability | Required when direct extractions are present | Each supplied direct extraction has a locator and extractor identity |
| Source title | Recommended | A human-readable title helps identify the source |
| Source URI | Recommended | A declared retrieval reference helps another reader find it |
| Source attribution | Recommended when direct extractions are present | Attribution distinguishes the voice in the document from the extractor |

The recommendations are non-blocking experimental citation conventions. They are not
scientific sufficiency requirements, inferred missing evidence or scored weights.
Their rationale is reader identification, retrieval and attribution. They need no
fabricated metadata: absent authorship or retrieval information can remain missing.
Their values, availability and identities are not authenticated by this tool.

Extraction scope includes current `source_assertion` claims and observation value
assertions whose provenance directly cites a selected source. Superseded source
statements do not determine this checklist. Locators use the existing page, time-range
or JSON-pointer contract; contents and page/range bounds are not inspected. The supplied
extractor string identifies a declared person or system, not a verified reviewer.

A selected source with no supplied direct extraction gets `not_applicable` for the
extraction and source-attribution groups. That means no direct extraction was supplied;
it does not claim exhaustive extraction or adequate assessment support. Transitive
products, translations, OCR and quotations citing derived products require their own
processing provenance and remain outside this direct-extraction profile.

## Status and limits

Each document retains its own requirements, reasons, blocked prerequisites, actionable
diagnostics, direct extraction refs and local asset check. Recommended gaps do not
change its profile status or the overall required-check result. No percentage, grade
or aggregate score is produced.

Missing required metadata or known byte mismatches fail the selected requirements.
Unavailable bytes or hashing leave the profile unchecked unless another required
check already failed. Missing digests block byte comparison. A non-document source
blocks its downstream groups. Required and recommended statuses remain visible as
`satisfied`, `missing`, `failed`, `not_checked` or `not_applicable` rather than being
collapsed into a numeric completeness value.

Documents, selection and supplied byte maps are snapshotted before asynchronous
hashing. No URL is fetched and no input is modified. Library callers should bound
untrusted input size before loading records or bytes. This is not a public projection;
callers must apply their own access policy when presenting returned data.

`releaseAuthenticity`, `redistributionRights`, `locatorContents`, `extractionAccuracy`,
`assessmentSupport` and `scientificEligibility` remain unchecked. In particular, a
confirmed evaluator claim can coexist with a passing selected-document profile without
its assessment support being evaluated. Use the separate [assessment documentation
profile](assessment-documentation.md) or [research prerequisites](research-prerequisites.md)
for those questions. This API does not relabel claims or relax those profiles.

This increment introduces the released-document provenance path and its required /
recommended distinction. Historical testimony, physical-sample profiles, qualified
review, profile-specific receipts/replay, and CLI/Index presentation remain separate
work. The [evaluation checkpoint](evaluation-checkpoint.md) tracks those boundaries.

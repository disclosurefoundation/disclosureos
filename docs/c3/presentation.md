# C3d: public case presentation

This is an **unreleased source checkpoint**, held for the [coordinated V2 release](../releases/v2-completion.md).
It implements the shared presentation contract and public-output projection.
It does not activate a website, store private notes, authenticate a publisher or
implement asset delivery. Portal integration and end-to-end access enforcement
are the next application checkpoint.

A public case is an editorial selection of narrative, citations, findings and
attachments. It references exact research snapshots without copying their complete
contents into a public response. Research assertions and publication decisions
have separate owners. A case can have a narrative without sensor recordings,
attachments or selected findings; absence does not create a chart or assessment.

## Entry points

All APIs belong to `@disclosureos/schema/experimental/v2`:

- `CasePresentationSchema`, `parseCasePresentation`, `casePresentationJsonSchema`
- `buildPublicCase`: verify declared references and construct public renderer data
- `buildPublicCaseOutputs`: construct the same data plus JSON, escaped Markdown,
  search text and title/description metadata

The plain schema export is `/experimental/v2/presentation/schema/0.1.0`.
No Zod schema crosses a package boundary. The existing records, case, link and
assessment contracts are unchanged. Use built source until coordinated publication;
these APIs are not available in npm beta.3.

## Editorial input

The `case_presentation` document has schemaVersion `0.1.0`, a public identifier,
an exact case reference, title, summary, update time and publication status.
Optional `linksRef` selects an exact C3c link document for supplement citations.
Public identifiers are reviewed aliases, not automatically copied internal IDs.

| Element | Meaning |
| --- | --- |
| Narrative blocks | Plain text, optional heading and explicit citation IDs. |
| Citations | Reviewed public label/description plus an internal case, observation artifact or supplemental-link target. Targets never enter the public payload. |
| Findings | Exact case-assessment history and claim ID; reviewed title, summary and reviewer label. Status, outcome and revision are derived from the pinned assessment, never from editorial overrides. |
| Attachments | Public ID, source/product identity in the case observation, declared SHA-256, kind/role, caption, credit, rights wording and citations. Optional MIME type, byte count, image/video dimensions and audio/video duration remain declarations. |
| Featured media | Selects an existing attachment rather than duplicating it. |
| Thumbnails | Separate image attachments, with their own source/product identity, digest, alt text and explicit thumbnail role. A thumbnail cannot point to another thumbnail. |
| Notices | Scope, correction, archive, withdrawal and rights text selected for publication. |

Image attachments require alt text. Dimensions are paired positive integer pixels.
A thumbnail must be an image. Attachment labels do not prove file format, rights,
metadata accuracy or scientific relevance. Private identity mappings and source
locators are not public presentation fields.

`draft` and `withdrawn` never yield a public payload, even with an approval object.
`archived` requires an archive notice and remains visibly archived. A withdrawal
notice may be retained internally, but the current builder emits no public
tombstone. The presentation lifecycle does not mutate the observation's own
lifecycle. Review queues, retraction decisions and withdrawal responses remain
application responsibilities.

## Approval and projection

```ts
import { buildPublicCaseOutputs } from '@disclosureos/schema/experimental/v2';

const result = await buildPublicCaseOutputs(presentationBytes, {
  documents: suppliedSnapshotBytesBySha256,
  approval: trustedServerApproval,
});
if (!result.success) {
  // Map to a generic unavailable response. No source values or error pointers exist here.
  return;
}
// result.data -> text-node renderer
// result.json / result.markdown -> downloads
// result.search -> search document
// result.metadata -> framework metadata API
```

The separately supplied approval names a `presentationSha256` and `policyVersion`.
It is a **trusted application decision**, not a signed credential or a document
field. The application must obtain it from its own authenticated, current
publication policy. Never accept it from a public request, source `access` label,
intake receipt or arbitrary stored record. The same presentation can be reviewed
under different policies; the server owns which policy is currently acceptable.

The approval binds exact presentation bytes, including text, aliases, target
snapshot digests and selected media digests. Editing any byte requires a new
approval. The publisher must review all intended public text, labels and media;
a shape validator cannot detect a sensitive name inside otherwise valid prose.

The builder copies declared buffers before awaiting, verifies SHA-256 and document
identity, evaluates the case, and resolves all selected references. Finding
histories receive case-assessment validation. They must target this exact case
revision. Source assertions cannot masquerade as selected assessments. Explicitly
superseded assessments remain labeled superseded; independent reviewers are not
merged. Selecting an assessment is editorial emphasis, not an assertion that all
reviews were included. Public outputs include a fixed assessment notice.

Supplement citations resolve through the pinned link document with its explicit
association-only validation limits. Full nested research-reference checks remain
separate. Attachments require matching observation-inventory digests; original
media bytes are not loaded here. No URL is fetched and unrelated buffers are ignored.
Successful projection does not establish raw-file integrity or scientific truth.

## Public output boundary

Only deliberately selected public fields are copied. Case IDs, snapshot hashes,
source URLs, assessment rationale, private reviewer identities, internal references
and approval details do not enter the output automatically. Approved reviewer
labels may be pseudonyms. Sources are represented by reviewed citations even when
the underlying source cannot be served publicly.

The output is `kind: public_case`, schemaVersion `0.1.0`; its TypeScript shape is
`PublicCasePayload`. It is produced by the builder, not by accepting a client-supplied
object with that type. All public outputs are derived together from that projection.
The Markdown encoder escapes user-controlled punctuation. Renderer strings remain
plain text: use framework text nodes, not raw HTML or automatic linkification.
Do not inline the JSON download string into a script tag. Metadata is passed as
text to the framework API, not interpolated HTML. No private filename or media URL
is used as an automatic social image.

Failures contain only a fixed code: approval required, invalid presentation,
not published or invalid references. No detailed validator issue or offending
value is returned. Full private diagnostic evaluation can happen separately inside
the application; do not forward it to public clients.

## Required application integration

The following are acceptance requirements, **not implemented server features**:

1. Keep private research/review envelopes and identity mappings server-side. Resolve
   current authorization before invoking the builder. Apply this same boundary to
   pages, downloads, search, metadata and caches; no fallback to raw records.
2. Implement `/case-assets/{publicId}/{attachmentId}` on the host app. Look up the
   current approved presentation, resolve only the selected artifact and verify
   its exact bytes against the approved digest. Independently check delivery MIME
   type and disposition, including active document/image formats. Never redirect
   a client to a private storage URL. The package generates route references but
   does not implement these routes or certify media safety.
3. Recheck publication state and approved revision before serving or caching a
   response or artifact. Invalidate old page/data/asset caches and remove or update
   search/metadata on withdrawal, approval revocation or policy changes. Pin cache
   identities to both presentation digest and policy revision; reusing the public
   alias alone is insufficient. The builder has no persistent cache or revocation store.
4. Review free-text labels, relationship descriptions, captions and precise places
   for intentional publication. A strict field allowlist is not automatic redaction.
5. Integrate the four design cases and verify routes, downloads, metadata and cache
   behavior. The shared contract alone does not close C3 application acceptance.

## Continuity and checks

The [presentation field ledger](presentation-baseline-mapping.csv) accounts for
27 property occurrences across description, media, featured media, lifecycle and
private notes. It explicitly leaves private-note storage and review-state integration
pending. Original storage URLs become approved artifact routes; arbitrary locators
are not automatically published. No bulk migration or baseline semantic-parity claim
is made.

The [fictional example](../../examples/v2/case-presentation-demo/presentation.json)
uses a two-station case and independent review history. Its public response is
committed alongside it; no real partner data or source artifact bytes are included.
The example's approval is synthetic and must never become a production default.

```sh
pnpm --filter '@disclosureos/schema...' build
pnpm test:v2-case-presentation
python3 scripts/check-c3-presentation-mapping.py
node examples/v2/case-presentation-demo/run.mjs
```

Checkpoint verification: 449 C1/C2/C3 conformance tests (including 42 new
presentation tests) and 19 schema unit tests pass, for 468 total. The schema
package builds, type-checks and passes strict ESM package-export checks. Emitted
schema/fixture reproduction and the 27-occurrence mapping check pass.

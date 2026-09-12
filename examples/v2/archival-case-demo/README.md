# Connected archival control

Run `node examples/v2/archival-case-demo/run.mjs` after building the schema package.
This wraps the existing archival-editions control, including its exact three
fictional UTF-8 text files. No real scans, PDFs or partner data are added.

The `archival_case_presentation` 0.1.0 envelope explicitly selects source editions,
page-bound source assertions, release/declassification declarations, digital
custody actions and an attributed edition-relationship review. Public payload
0.4.0 feeds JSON, Markdown, search and metadata. The original case, context and
testimony contracts are unchanged. Testimony and archival builders share internal
snapshot capture; each retains its own parsers, semantics and approval boundary.

Approval separately pins the complete envelope. The builder checks exact case
membership, history/entity snapshots, edition artifact identity, selected page
bounds and matching citations. Source titles never substitute for edition IDs.
Every selected custody predecessor must be selected too; predecessor edges order
the output, and unknown predecessors remain explicit gaps. Unknown dates are not
filled from nearby events. Unselected fields remain outside the selection.

The first contract supports single known/unknown declarations for selected edition
metadata, known titles/page counts, date-precision release/declassification events,
selected custody actions, MD5 declarations for unavailable originals, page-locator
passages and assessed direct-source edition reviews. Approximate/redacted/unmapped
states, alternative declarations, other event precision, indirect claim inputs
and hashes scoped to supplied files fail closed until represented explicitly.
Attachment selections must match the exact edition artifact in the original
presentation. The separately generated portal serves approved text files with
byte checks. This builder itself does not fetch or verify source-file bytes.

Public output excludes unselected raw titles/URIs, archive locations, filenames,
receiver identities, predecessor reason prose, identifier URLs and private review
metadata. Public labels and review summaries are approved editorial text. The old
MD5 describes an unavailable original, not a successful check on either supplied
edition. Snapshot and delivery checks do not establish authenticity, faithful
reproduction, rights or scientific validity. Npm publication stays on hold.

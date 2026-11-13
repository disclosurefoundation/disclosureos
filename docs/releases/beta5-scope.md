# Beta 5 scope closeout

**Release update, 2026-11-13:** Beta 5 is published and its registry bytes and
tags are verified. The earlier preparation holds below are historical. See the
[release record](2.0.0-beta.5.md) and its registry receipt. The portal update can
now use Beta 5; provider permissions and the documented scope boundaries remain
unchanged.

Decision checkpoint: 2026-11-10. Scope is closed and coordinated Beta 5 version
preparation is authorized. Merges and npm publication remain on hold. See the
[versioned candidate](2.0.0-beta.5.md).

Beta 5 consolidates capabilities exercised by the ELDÆON, Speculor and Sky360
integrations. Package versioning and schema revision are separate: published
Beta 4 contracts remain immutable, and new contracts use new schema identities.

## Included and retained capabilities

| Area | Beta 5 boundary | Verification |
| --- | --- | --- |
| Original MCAP recordings | Optional source mapping pins bytes, channel, schema, message and payload selection; decoding stays in adapters. | Mapping conformance and isolated consumer recovery. |
| Relative video frames | Optional mapping pins product, stream, presentation frame and rational timestamp; UTC is not inferred. | Mapping conformance and independent integration readers. |
| Unknown processing time | Observation 0.2.0 can retain a reason for an unknown processing time, with method and lineage intact. | Observation, source-mapping and review tests. |
| Observation and case reviews | Claim history 0.6.0, case record 0.2.0 and case claim history 0.2.0 support the new Observation revision. Requests and receipts support offline evaluation and replay. | Review evaluation, snapshot identity, tamper and replay tests. |
| Specialized reviews | Existing context, witness, archival and laboratory histories remain supported with Observation 0.1.0. They reject Observation 0.2.0 and the observation-only 0.6.0 history. | Positive and negative tests in `test:beta5-scope`. |
| Public case displays | Existing selected case, context, testimony, archival and material outputs remain supported. Their existing case revisions and exact presentation approval are required. | Positive output tests, approval mismatch and new-case rejection tests. |
| Other evaluation paths | Research completion, reproduction packets, qualification, scoring and case links retain their existing contracts. | Existing conformance suites; no implicit conversion. |

The specialized and public-display revisions are deliberately not extended in
this release. None of the three retained integration exports requires an
Observation 0.2.0 inside a specialized review or a case 0.2.0 public projection.
A follow-up should begin with a concrete review or publication use case, then
version its envelope and policy together. Converting unknown time to a date, or
relabelling a new document as an old revision, is not a supported workaround.

## Public-display boundary

A successful parser, review receipt or source comparison does not grant public
access. Public presentation builders continue to expose only selected outputs
under an approval bound to the exact presentation bytes. New review receipts do
not automatically authorize public projections. Private payloads and source
files do not become publishable because a review succeeds.

Partner displays have a separate access boundary:

- **ELDÆON:** retain the provider-approved presentation and attribution. Original
  data access goes to the restricted licensing page. Corrected sensor meanings,
  the base-site radar location, bistatic quantities and remaining unit uncertainty
  travel with the data. Package work does not reopen original-file redistribution.
- **Speculor:** the full-series and MCAP mapping remain in the held review portal.
  Provider reuse approval and portal deployment are separate from package release.
- **Sky360:** the pilot covers six historical public clips. Current-station export
  support, capture UTC, calibration and media reuse confirmation remain separate.

The browser inspector has an explicit supported-revision list. Installing newer
packages must not silently expand its advertised checks. New contracts can be
used through the package APIs; browser coverage is a separately reviewed UI change.

## Compatibility evidence and release gates

The published identity baseline now includes all 61 schema artifacts from the
seven Beta 4 registry packages. Each tarball was checked against npm's SHA-512
integrity value, and earlier published identities were unchanged. Recheck with:

```sh
node scripts/record-published-schema-baseline.mjs 2.0.0-beta.4
pnpm test:release
pnpm test:beta5-scope
```

Portal compatibility must use the exact unpublished candidate tarballs, including
transitive dependencies. Check the shipped guide scripts, retained integration
exports, inspector revision boundaries, app tests and production build. Retain
candidate commit and artifact hashes with the results. Keep public dependency pins
on published Beta 4 until a release is approved and verified in the registry.

Source-candidate success is not final Beta 5 release approval. Repeat conformance,
consumer and portal checks on the coordinated seven-package candidate. Publication
and production changes need their own authorization.

## Follow-ups outside this release

Missing mission media, broader provider adapters, current-station Sky360 formats,
new specialized review envelopes and new public presentation revisions remain
separate checkpoints. Scientific protocols and conclusions are not inferred from
structural compatibility. The retained real-source receipts remain the evidence
for prior original-file comparisons; this closeout does not repeat those checks.

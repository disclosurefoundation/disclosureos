# Beta 5 integration compatibility checkpoint

Review date: 2026-10-31. Unpublished source work; merges and npm publication are
on hold. The portal's installed packages remain on `2.0.0-beta.4`.

## What is ready to carry forward

The initial integration work supports three distinct handoffs:

| Integration | Retained handoff | Boundary still visible |
| --- | --- | --- |
| ELDÆON | Sensor readings, radar histories, EEG numeric channels and original/playback video references, with independent recovery tools and retained verification receipts. | Partial mission intake. Public access follows ELDÆON's restricted licence; download actions direct people to the provider. Verification receipts are not permission to redistribute originals. |
| Speculor | Full supported scalar series and original MCAP references, with an official-reader importer and a separate recovery implementation. | One reviewed session and its supported encodings; not a general-purpose converter. Provider reuse review remains separate from package readiness. |
| Sky360 | Six public clips with exact relative frame references and independent frame-index comparison. | Historical public clips, not an integration of a current station export. Capture UTC, station calibration and synchronization are not inferred. Media permission remains a separate review. |

Implementation and intake evidence are maintained in the portal repository:
[ELDÆON](https://github.com/disclosurefoundation/dashboard/blob/codex/eldaeon-provider-corrections/docs/plans/2026-10-17-eldaeon-mission-import.md),
[Speculor](https://github.com/disclosurefoundation/dashboard/blob/codex/eldaeon-provider-corrections/docs/speculor-integration.md),
and [Sky360](https://github.com/disclosurefoundation/dashboard/blob/codex/eldaeon-provider-corrections/docs/sky360-pilot.md).
Those are held review branches, not statements of production deployment.
This checkpoint does not repeat the original-media verification or replace its receipts.

## Supported contract path

`parseExperimentalObservation()` accepts Observation `0.1.0` and `0.2.0`.
The MCAP and relative-video evaluators accept a supported Observation directly;
they do not require a claim-history wrapper. An Observation `0.2.0` derivative can
therefore retain `{ "state": "unknown", "reason": "not_recorded" }` as its
processing time and still resolve its source selections.

The compatibility suite verifies this path without replacing missing times:

- MCAP selections still resolve the exact source value.
- Video selections retain exact presentation ticks beyond JavaScript's safe
  integer range, with capture time left unchecked.
- Broken producer/output relationships still fail before external verification.
- Structural and source-content checks do not become scientific qualification.

These are synthetic contract tests with controlled resolver functions. The
integration readers and their original-source comparisons supply the separate
real-file verification.

## Claim and case boundaries

Published claim-history revisions `0.1.0` through `0.5.0` embed Observation
`0.1.0`. They correctly reject an Observation `0.2.0`, including one whose
processing times happen to be exact. Documentary evaluation also stops at the
unsupported envelope instead of returning a profile result.

The review found one inconsistency in case snapshot resolution: a valid
Observation `0.2.0` could pass under a reference declaring Observation `0.1.0`
when its document ID and digest matched. The resolver now checks the declared
schema revision as well. A correct hash does not authorize a different schema.
This keeps existing snapshot identities and schema artifacts unchanged.

**Open next checkpoint:** define the claim/case/evaluation path for Observation
`0.2.0`. This needs explicit new versioned contracts and review of linked
snapshots, evaluation receipts and public projections. It is not solved by
loosening an existing schema under its published ID. No automatic downgrade,
placeholder processing date or implicit scientific assessment is appropriate.
Whether that extension enters Beta 5 remains a release-scope decision; this
checkpoint does not silently defer it or declare the overall milestone complete.

## Verification

Run after building the seven packages:

```sh
pnpm test:beta5-compatibility
pnpm test:v2-observation
pnpm test:v2-mcap-source-mapping
pnpm test:v2-video-frame-source-mapping
pnpm test:v2-case
pnpm test:v2-case-claims
pnpm test:v2-case-links
pnpm test:v2-case-presentation
```

The new compatibility command is part of CI. It exercises supported source
mappings, all five published claim-history boundaries, documentary rejection,
and the case snapshot mismatch regression. Existing case/presentation suites
cover the unchanged successful path.

After committing, `pnpm verify:source` and `pnpm verify:source-pack` can verify
unpublished tarballs in a separate npm consumer. Source-mode verification does
not version packages or authorize publication.

## Remaining release work

1. Decide and implement the Observation `0.2.0` evaluation-contract scope above.
2. Reconcile provider feedback and record remaining intake/context limitations.
   ELDÆON's provider corrections include DIONYSUS base-site radar, bistatic
   range/range-rate, corrected tube identities and stale-link interval, RF
   placeholders, polling limits and magnetic units awaiting confirmation.
3. Complete the agreed contract review, including the published-schema identity
   baseline for Beta 4, before authorizing coordinated version preparation.
4. Prepare all seven packages, then run full conformance, exact-tarball consumer
   checks and portal example validation against the candidate artifacts.
5. Review release approval separately from provider-media access and portal
   deployment approval. Publish only after explicit authorization; update portal
   package pins and availability wording after registry verification.

Broader adapters, missing mission media and current-station Sky360 acquisition
formats require their own scoped follow-ups. They are not implied by these
portable export demonstrations.

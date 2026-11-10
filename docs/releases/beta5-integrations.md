# Beta 5: initial data integrations

Initial decision: 2026-10-19. Updated 2026-11-10: scope closed and coordinated
Beta 5 versions prepared for verification. Merges and publication remain on hold.

Beta 5 will consolidate standard changes learned from ELDÆON, Speculor and Sky360.
The published baseline remains `2.0.0-beta.4`. Reviewed source changes can merge
before this release, subject to authorization. npm publication remains on hold.

## Integration checkpoints

| Integration | Release review focus |
| --- | --- |
| ELDÆON | Map the agreed available mission data, verify the portable handoff and record remaining source/context gaps. Additional inaccessible media can remain explicitly pending. |
| Speculor | Verify complete supported readings, original-source references and recovery without the portal; review the mapping with the provider where available. |
| Sky360 | Six public clips are mapped in the review pilot. Verify portable relative frame references against every original frame; current-station formats and media reuse confirmation remain separate follow-ups. This is not a partnership claim. |

For each checkpoint, record the selected capture scope, source formats, retained
values and timestamps, missing context, independent recovery results and any
standard changes required. If a source or provider dependency blocks the agreed
scope, review that scope explicitly rather than silently declaring it complete.

## Standard changes in the candidate

- Optional MCAP source-reference mapping: identifies original recording bytes,
  channels, schemas, exact messages and selected payload fields. It accompanies
  existing observation/capture documents and uses an external reader/decoder.
- Optional relative video-frame source mapping: pins the original product, stream,
  presentation-order frame and exact rational timestamp without inventing UTC.
  Includes an external decoder boundary and full-index comparison.
- Observation revision `0.2.0`: preserves an explicit unknown processing time
  for derived products while retaining actor, method and input/output lineage.
  The published `0.1.0` contract is unchanged.
- Explicit observation-level claim history `0.6.0`, case record `0.2.0` and
  case claim history `0.2.0`, with offline review requests and replayable receipts.
  These support Observation `0.2.0` without changing existing schema identities.
  Specialized reviews and public projections retain their existing version
  boundaries; see [the evaluation checkpoint](../experimental/observation-review.md).
- Provider-specific decoding remains in adapters. Further scope additions require
  another checkpoint; this candidate adds no provider recordings.

The MCAP document's `0.1.0` schema revision is separate from the planned package
version `2.0.0-beta.5`. Neither identifier establishes that publication occurred.

## Compatibility checkpoint

See the [2026-10-31 compatibility review](beta5-compatibility-review.md) for the
verified source-mapping path, snapshot revision checks, and the subsequent
versioned observation/case evaluation checkpoint. This checkpoint is not release approval.

## Closeout and release

1. Complete the agreed integration checkpoints and review their findings together.
2. Resolve shared contract gaps or explicitly document deferred capabilities.
   Review duplication, source fidelity, versioned schemas and portable consumption.
3. When release preparation is authorized, advance the coordinated seven-package
   set, update the release plan and changelogs, and preserve existing schema IDs.
   The published-identity baseline already includes verified Beta 4 registry bytes.
4. Run the full package/conformance suite, pack and install the exact artifacts in
   an isolated consumer, and verify portal examples against those artifacts.
5. Obtain publication approval, publish the verified set under `beta`, and verify
   registry versions, integrity and unchanged stable `latest` tags.
6. Update portal dependencies, documentation and availability language after the
   published packages have been verified.

Data reuse approval and public asset delivery remain independent of npm release.
Do not bundle provider recordings into standard packages as part of this plan.

The [Beta 5 scope closeout](beta5-scope.md) defines the included capabilities,
retained specialized-review boundaries and public-display policy.

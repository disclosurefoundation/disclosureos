# Beta 5: initial data integrations

Decision: 2026-10-19. Planned, not versioned or published.

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

## Standard changes under review

- Optional MCAP source-reference mapping: identifies original recording bytes,
  channels, schemas, exact messages and selected payload fields. It accompanies
  existing observation/capture documents and uses an external reader/decoder.
- Optional relative video-frame source mapping: pins the original product, stream,
  presentation-order frame and exact rational timestamp without inventing UTC.
  Includes an external decoder boundary and full-index comparison.
- Observation revision `0.2.0`: preserves an explicit unknown processing time
  for derived products while retaining actor, method and input/output lineage.
  The published `0.1.0` contract is unchanged.
- Further additions only where integration findings justify a shared standard
  capability. Provider-specific decoding remains in adapters where appropriate.

The MCAP document's `0.1.0` schema revision is separate from the planned package
version `2.0.0-beta.5`. Neither identifier establishes that publication occurred.

## Compatibility checkpoint

See the [2026-10-31 compatibility review](beta5-compatibility-review.md) for the
verified source-mapping path, snapshot revision checks, and the separate
claim/evaluation extension still to scope. This checkpoint is not release approval.

## Closeout and release

1. Complete the agreed integration checkpoints and review their findings together.
2. Resolve shared contract gaps or explicitly document deferred capabilities.
   Review duplication, source fidelity, versioned schemas and portable consumption.
3. When release preparation is authorized, advance the coordinated seven-package
   set, update the release plan and changelogs, and preserve existing schema IDs.
   Include Beta 4 in the published-identity baseline using verified registry bytes.
4. Run the full package/conformance suite, pack and install the exact artifacts in
   an isolated consumer, and verify portal examples against those artifacts.
5. Obtain publication approval, publish the verified set under `beta`, and verify
   registry versions, integrity and unchanged stable `latest` tags.
6. Update portal dependencies, documentation and availability language after the
   published packages have been verified.

Data reuse approval and public asset delivery remain independent of npm release.
Do not bundle provider recordings into standard packages as part of this plan.

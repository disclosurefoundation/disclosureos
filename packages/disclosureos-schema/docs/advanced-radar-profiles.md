# Steered and secondary radar profiles (experimental V2)

These optional standard contracts compose an `Observation`, an `AcquisitionContext`
and a `ProductSourceSelection`. They are public package APIs, portable JSON Schemas
and byte readers. A developer can implement a different viewer without using the
DisclosureOS portal. Existing fixed, airborne and shipborne rotating-scan packets
continue to use `RadarProfile` without changes.

The two profiles describe different retained data products. A steered radar can
record reflected power using an arbitrary beam schedule. A secondary radar records
cooperative transponder replies. Neither a service label such as “military” nor a
platform label determines radar physics. The fictional military example uses the
steered profile, but the profile makes no military hardware, classification,
identification, operational performance or engagement claim.

## Public interfaces

```ts
import {
  SteeredRadarProfileSchema, SecondaryRadarProfileSchema,
  evaluateSteeredRadarProfile, evaluateSecondaryRadarProfile,
  readSteeredRadarProducts, readSecondaryRadarProducts,
  steeredRadarProfileJsonSchema, secondaryRadarProfileJsonSchema,
} from '@disclosureos/schema/experimental/v2';

const result = await evaluateSteeredRadarProfile(
  observation, acquisitionContext, sourceSelection, steeredProfile,
  { assets: retainedBytesByProductRef },
);
if (result.success) {
  const { declaration, layouts, products } = result.data!;
  // Render the exact retained beams, power, detections and estimates.
}
```

The equivalent secondary evaluator takes the same arguments. Each evaluator
snapshots and validates every provided source layout against its bytes, digest and
standard source selection before decoding. A success includes the declaration,
layouts and decoded products. Metadata alone cannot pass the source checks.

The exported readers have no schema-runtime dependency. They validate exact table
columns, finite numeric syntax, row extents and binary shapes. They do **not** hash
bytes or replace the full evaluator. Empty optional secondary fields decode to
`null`, never to zero. A Mode A code remains a four-character string, including
leading zeros.

Portable schema subpaths:

- `@disclosureos/schema/experimental/v2/steered-radar-profile/schema/0.1.0`
- `@disclosureos/schema/experimental/v2/secondary-radar-profile/schema/0.1.0`

Unversioned `/schema` aliases point to the same experimental artifacts. All
schemas reject unsupported properties and semantics rather than silently removing
fields. Publication remains deferred to the coordinated V2 release.

## Steered beams and reflected-power processing

`SteeredRadarProfile` uses `kind: "steered_radar_profile"`,
`mode: "electronically_steered_sector"`, a fixed local origin and horizontal ranges.
The independent binary dimensions are **dwell × range**. There is no assumed
regular azimuth dimension, mechanical revolution, constant dwell length or fixed
number of beams per cycle. A cycle is an ordered grouping declared in the schedule.

The `beamSchedule` table has these columns:

```text
dwell_index,cycle_index,start_s,end_s,beam_azimuth_deg,beam_width_deg,purpose
```

Dwell indices begin at zero and are contiguous. Cycle groups also begin at zero
and advance without gaps. Each positive-duration dwell follows the prior dwell
without overlap and lies within the acquisition interval. Bearing can change in
any order; a revisit can return to an earlier bearing. `purpose` is `search` or
`revisit`. Beam width is the full width at half maximum power. It is not a statement
that reception outside this width is physically impossible.

The `returns` and `thresholds` products use little-endian float32 arrays with
`normalized_return_power`, unit `1` and identical coordinates. Relative power is
nonnegative; it is not restricted to 0–1 and does not claim calibrated watts or dBm.
Ranges are increasing nonnegative bin centers in meters.

Other exact tables:

```text
# detections
detection_id,dwell_index,range_index,time_s,east_m,north_m,power
# tracks
track_id,dwell_index,time_s,state,east_m,north_m,velocity_east_m_s,velocity_north_m_s,cov_ee_m2,cov_en_m2,cov_nn_m2
# associations
track_id,dwell_index,detection_id
# optional synthetic truth
target_id,dwell_index,time_s,east_m,north_m
```

A detection selects one retained beam/range cell. Its time falls within that dwell,
its power matches the cell and meets its retained threshold, and its position is
the declared cell center in the local horizontal frame. Duplicate detections from
the same cell are rejected. Schedule lineage is required for localization.

Processing is available at `dwell_end`. Each retained track state therefore carries
its dwell's exact end time. Estimates and associations can depend on detections,
not synthetic truth. An association selects an earlier detection in the same
dwell. Each detection can be used once. This profile permits multiple detections
in one estimate; the example's method makes the narrower choice of at most one.
`coasting` means that estimate has no detection association. `tentative` and
`confirmed` are tracker states, not verified target identities.

Position covariance is a symmetric positive-semidefinite east/north matrix in
square meters with an explicit contour probability. It is not a certification of
Gaussian error coverage. The evaluator does not rerun arbitrary detector or
tracker implementations; the executable example's reproduction checks do.

## Cooperative Mode A and Mode C reports

`SecondaryRadarProfile` uses `kind: "secondary_radar_profile"`,
`mode: "mode_a_mode_c"` and `positionRepresentation: "polar_only"`. The capture
channel has quantity `decoded_reply`, unit `1`. The input artifact is the retained
decoded-reply table, not an RF recording or reflected-power array. Decoder methods
and upstream captures can be retained separately in standard provenance.

Exact tables:

```text
# interrogations
interrogation_id,start_s,end_s,beam_azimuth_deg,beam_width_deg,mode
# decodedReplies
reply_id,interrogation_id,time_s,available_s,slant_range_m,bearing_deg,validity,mode_a_code,pressure_altitude_ft
# reports
report_id,reply_id,interrogation_id,time_s,available_s,slant_range_m,bearing_deg,validity,mode_a_code,pressure_altitude_ft
# optional independent synthetic truth
target_id,interrogation_id,time_s,east_m,north_m,up_m,transponder
```

An interrogation row declares a retained listening window and mode (`mode_a` or
`mode_c`). Windows are positive, ordered, non-overlapping and inside acquisition
time. A reply selects an exact interrogation and has a reception time in that
window. `available_s` is the explicit per-reply processing availability, at or
after reception. This is not a batch model: availability need not wait until the
end of the listening window. All times are seconds from the profile's UTC origin.

A `valid` decoded reply has a nonnegative slant range and a clockwise bearing in
[0, 360). A Mode A reply retains a four-digit octal code and no altitude. A Mode C
reply has no Mode A code and may retain pressure altitude in 100-foot increments;
its altitude can also be unavailable. Pressure altitude uses the standard
1013.25 hPa reference. It is **not geometric height**, and the profile provides no
slant-to-ground projection. A slant-range/bearing display must identify its radial
coordinate correctly rather than label it a ground map.

An `invalid` reception retains its identity and times but has empty range,
bearing, code and altitude fields under this profile. It cannot create a report.
An interrogation with no received reply has no decoded-reply row. That absence
means only that no reply was retained for the window. It does not establish that
no aircraft or other target was present. Displaying a generator's silent target
requires opening the separate synthetic-truth layer.

The `reports` table is a lossless selection of **every valid decoded reply**. Each
report has a unique ID, points to exactly one source reply and preserves all source
fields, including null values and processing availability. There are no fabricated
zero-range rows, fabricated altitudes, inferred identity joins or automatic
Mode A/Mode C fusion. Two replies may share the same reported code without being
asserted to be the same aircraft. These profiles do not model Mode S, ADS-B or
military identification systems.

## Retained empty outcomes

The shared source-layout contract accepts a header-only CSV with `rowCount: 0`.
This supports a full capture with no received replies, no detections or no tracks.
The declared columns and pinned bytes remain available for review. There is no
row-zero selection into an empty table, and the empty branch forbids partition
or scalar-sample mappings. The evaluator verifies its exact header even when no
selection points into the table. An empty retained table is different from an
unavailable artifact or a missing field.

## Provenance and limits

Calculated products require explicit processing lineage. The acquisition artifact
must identify the same bytes as the primary input product. Each role selects a
distinct retained product. Optional truth is accepted only with
`dataOrigin: "synthetic"` and is kept out of acquisition, schedule, detection and
report processing.

Truth isolation forbids shared **products**, **processes** and instrument-data
sources from serving as an oracle input. Only shared source-level documents, such
as method descriptions and executable generator code, are allowed as common
configuration. Declaring a payload to be a configuration document cannot prove
that it contains no leaked answers; source classifications and the implementation
remain subject to scientific review. Every success therefore preserves
`scientific`, `physicalCalibration`, `trackingPerformance` and
`identityVerification` as `not_checked`.

## Reproducible examples

`examples/radar-advanced` includes both packets, executable numerical source,
retained source tables, methods, portable standard declarations and a verifier.
The military example has a prescribed search/revisit schedule; the revisit plan
is not a claim of adaptive target acquisition. The secondary example has valid,
invalid, missing-altitude and no-reply windows. Source reports are created from
retained decoded replies; independent truth is never a report input.

```sh
pnpm verify:radar-advanced
pnpm test:v2-radar-profile
```

## Public technical context

The distinction between reflected primary returns and cooperative transponder
replies follows the [FAA AIM description of ATCRBS](https://www.faa.gov/air_traffic/publications/atpubs/aim_html/chap4_section_5.html).
Mode C pressure-altitude reporting is described in the [FAA AIM transponder section](https://www.faa.gov/air_traffic/publications/atpubs/aim_html/chap4_section_1.html).
These references explain the general concepts. The fictional packets use their own
explicit reduced models and make no claim to reproduce particular hardware.

# Rotating radar profile 0.1.0

This optional V2 profile describes retained products from full clockwise scans by a fixed station or an explicitly declared moving platform. It connects the source capture, detector output and track estimates without placing a radar-specific object in every observation. It does not describe every radar or imply that civilian, military or platform labels identify mutually exclusive technologies.

The profile composes the existing observation, acquisition-context and product-source-selection contracts. Its JSON Schema is exported as `@disclosureos/schema/experimental/v2/radar-profile/schema/0.1.0`. The evaluator and dependency-free reader are exported through `@disclosureos/schema/experimental/v2`.

```ts
import { evaluateRadarProfile } from "@disclosureos/schema/experimental/v2";

const result = await evaluateRadarProfile(
  observation,
  acquisitionContext,
  sourceSelection,
  radarProfile,
  { assets: new Map([["product:returns", returnsBytes] /* every layout */]) }
);
if (result.success) {
  // Parsed numerical rows and complete array values from verified bytes.
  const { declaration, layouts, products } = result.data!;
}
```

No URL is fetched by the evaluator. The caller supplies the retained bytes. Inputs are parsed and bytes are copied before the first asynchronous verification step. Successful evaluation requires every declared source layout to have matching bytes and hashes. Unavailable or altered content does not produce a partially trusted display payload.

## Product roles and geometry

Each role names a different observation product with a standard source layout. `acquisitionProductRef` explicitly identifies the acquisition-context product holding the same return bytes. `channelId` selects a captured channel from the acquisition's pinned manifest, whose quantity and unit must match the return array. The frame must be Cartesian in meters. `origin.eastM` and `origin.northM` place the fixed station within that frame. For a moving platform, they identify the first retained pose and must match that row. The profile does not infer an earth transform.

| Role                         | Layout        | Meaning                                                      |
| ---------------------------- | ------------- | ------------------------------------------------------------ |
| `scanSchedule`               | CSV           | One dwell for every scan and azimuth bin                     |
| `returns`                    | Float32 array | The retained relative-power capture                          |
| `thresholds`                 | Float32 array | The threshold applied at every return cell                   |
| `detections`                 | CSV           | Selected source cells and calculated positions               |
| `tracks`                     | CSV           | Estimates produced from detections                           |
| `associations`               | CSV           | Explicit detection-to-estimate links                         |
| `platformPose` (moving only) | CSV           | One platform position and heading at each dwell midpoint     |
| `truth` (optional)           | CSV           | Separate synthetic scenario coordinates; never tracker input |

The arrays use little-endian float32 values in row-major `[scan, azimuth, range]` order. The scan axis is a zero-based index. Azimuth is a regular axis in degrees covering exactly 360 degrees with increasing clockwise bearings. Fixed profiles use local north; moving profiles explicitly select north or platform heading. Range is a regular axis of nonnegative distances in meters in the declared horizontal or slant convention. Regular-axis origins identify cell centers. `normalized_return_power`, with unit `1`, is a nonnegative relative scale; values may exceed one. It is not calibrated received power. Threshold arrays must use exactly the same axes.

The beam direction in each schedule row equals its azimuth cell center. Beam width is explicitly the full angular width at half maximum power. It describes the declared antenna model; the evaluator does not establish an actual antenna pattern, detectability boundary, range coverage or physical angular resolution.

`timeOrigin` plus relative seconds gives UTC capture time. Dwells have positive `[start_s, end_s)` intervals, follow scan/azimuth order and cannot overlap. Gaps are permitted. Every dwell lies inside the selected acquisition interval. `processingAvailability: "scan_end"` declares batch processing: a detection's measurement time may be an earlier dwell, but detector and track results must only be exposed after the scan is complete. A display must not present a completed centroid or track as available during its contributing scan.

## Standard tables

Column names and order are fixed. Role tables declare the whole retained table: a partition or scalar sample mapping is rejected, so the reader cannot expose rows outside a selected partition. Additional algorithm-specific artifacts, such as a full filter-state covariance, remain ordinary products outside these roles. Missing numeric cells, non-finite values, duplicate identities and unknown columns are rejected; unknown measurements are not encoded as zero.

- **Schedule:** `scan_index,azimuth_index,start_s,end_s,beam_azimuth_deg,beam_width_deg`
- **Platform pose:** `scan_index,azimuth_index,time_s,east_m,north_m,up_m,heading_deg`
- **Detections:** `detection_id,scan_index,azimuth_index,range_index,time_s,east_m,north_m,power`
- **Tracks:** `track_id,scan_index,time_s,state,east_m,north_m,velocity_east_m_s,velocity_north_m_s,cov_ee_m2,cov_en_m2,cov_nn_m2`
- **Associations:** `track_id,scan_index,detection_id`
- **Synthetic truth:** `target_id,scan_index,time_s,east_m,north_m`

A detection names one exact return cell. Its power must equal the retained value and meet the corresponding threshold. A cell cannot create duplicate detections. A declaration does not assert that all threshold crossings became detections; the detector may apply further filtering described by its versioned method.

Positions use one of two explicit rules:

1. `cell_center`: project the retained range/bearing center into east/north using the fixed station origin or that cell’s own retained platform pose.
2. `power_weighted_neighborhood`: subtract declared `backgroundPower`, clamp each weight to zero, project every cell center into east/north, then calculate the weighted Cartesian mean. The declared azimuth/range radii determine the neighborhood. Azimuth wraps across north; the neighborhood must fit the range extent and cannot repeat an azimuth cell. Positive total weight is required. Slant cells that cannot intersect the declared plane have no location and are excluded before weighting; the selected detection center itself must be projectable. Each contributing cell uses its own pose, not the pose at the detection center or scan end. The evaluator independently recomputes the position from actual source values. Its position comparison uses an absolute `1e-6` meter tolerance plus `32 * Number.EPSILON` times coordinate magnitude for floating-point roundoff; changing the frame origin does not introduce a parts-per-million location allowance.

A track has one estimate per `track_id` and `scan_index`, with strictly increasing times and scan indices for that track. An association references an earlier detection in the same scan. Each detection may update at most one estimate. `tentative` and `confirmed` estimates need at least one association; `coasting` estimates need none. These are processing states, not confirmation of target identity, observation validity or a physical explanation. Track velocities are declared estimator outputs, not direct Doppler measurements. The evaluator does not reconstruct or approve an arbitrary tracking algorithm.

Truth may contain several rows per target and scan at distinct times. It is only allowed when `dataOrigin` is `synthetic`. Truth products are source material for a separately labeled model overlay or evaluation, never evidence that a radar detected that object.

## Moving airborne and shipborne platforms

Moving profiles add these declarations:

```json
{
  "platform": {
    "kind": "moving",
    "environment": "airborne",
    "poseSampling": "dwell_midpoint",
    "attitudeModel": "level_yaw_only"
  },
  "beamReference": "platform_heading",
  "rangeConvention": "slant_range",
  "projection": {
    "kind": "declared_horizontal_plane",
    "upM": 0,
    "assumption": "all_returns_on_plane"
  },
  "products": { "platformPose": "product:platform-pose" },
  "uncertainty": { "conditioning": "declared_pose_and_projection" }
}
```

The example above shows only the added fields; the other mandatory profile fields and product roles remain required. `environment` is contextual metadata, not a claim about military/civilian use, sensor capability or an imposed range convention. Shipborne and airborne platforms can use either supported range convention when its assumptions fit the retained data.

The pose product has exactly one row per dwell in schedule order. Its `time_s` equals `(start_s + end_s) / 2`, allowing `1e-7` seconds for decimal serialization. Positions use the same local Cartesian meter frame as detections. `up_m` is relative to that frame’s vertical datum, not an inferred altitude above terrain or sea level. Heading is clockwise from frame north in `[0,360)` degrees. The first east/north pose matches the declared origin. Missing poses, duplicate or reordered rows, implicit interpolation and poses sampled at the scan end are rejected.

`level_yaw_only` describes a level, horizontally stabilized azimuth model. It does not represent pitch, roll, antenna lever arms or a six-degree-of-freedom attitude transform. It assumes pose is constant for geometric localization within each dwell at the retained midpoint. This is a declared approximation that a provider must justify for its motion and dwell duration. Moving detections use that same midpoint as their measurement time. A more demanding acquisition needs a separately specified extension rather than silently treating these assumptions as measured facts.

With `beamReference: "platform_heading"`, frame bearing is the retained cell azimuth plus the pose heading, modulo 360. With `"north"`, the cell azimuth is already referenced to frame north. The world position is the platform east/north position plus the cell’s horizontal polar vector. Each cell in a weighted centroid is transformed separately before averaging, including cells recorded at different platform positions and headings.

For `horizontal_range`, the retained radial coordinate already describes horizontal distance. No height correction is inferred and `projection` is omitted. For `slant_range`, a declared horizontal target plane is mandatory. Given slant range `r` and vertical separation `h = pose.up_m - projection.upM`, horizontal distance is `sqrt(r² - h²)`. A cell with `r < |h|` has no intersection and must not be drawn as a zero-range return. The plane is an explicit localization assumption for the returns, **not measured target height**. Terrain, elevated targets, varying sea surface and unknown vertical target position can invalidate it. These scenarios show flat-ground/sea-level projections; they do not implement arbitrary airborne target localization.

`radarCellPosition(profile, pose, beamAzimuthDeg, rangeM)` is the dependency-free reference calculation. It returns east/north, horizontal range and frame bearing, or `null` for an impossible slant-to-plane cell. Callers must supply the exact dwell pose, never interpolate or substitute a nearby row without another declared model. The helper alone does not validate the packet, pose sampling, source hashes or applicability of the plane.

Moving covariance has `conditioning: "declared_pose_and_projection"`. The contour and velocities are expressed in the fixed local frame, conditional on the supplied pose and projection. They exclude navigation error, heading uncertainty, target-plane uncertainty, frame-registration error and unmodeled attitude. A provider cannot label this contour as total geolocation uncertainty. The acquisition-context contract continues to hold available calibration and clock information.

## Uncertainty and processing

The position covariance is the symmetric matrix `[[cov_ee_m2,cov_en_m2],[cov_en_m2,cov_nn_m2]]` in the declared east/north frame. It must be positive semidefinite. Tiny normalized determinant errors up to `1e-12` are allowed for serialized roundoff; renderers should clamp a numerical negative eigenvalue within that tolerance to zero. Singular covariance is valid and gives a degenerate contour, not a finite circular radius.

The optional display contour is a two-dimensional Gaussian probability contour under the **declared model**. Its squared scale is `-2 * ln(1 - confidenceProbability)`. At 95% this is approximately 5.99146, not the squared 1.96 multiplier for a one-dimensional marginal interval. Cross-covariance controls the ellipse orientation. This contour does not claim calibrated confidence, target extent or an independent measurement uncertainty. `radarCovarianceScaleSquared` provides this calculation.

Thresholds, detections, associations and tracks must be derived products with processing lineage. Thresholds depend on returns, detections on returns and thresholds, and tracks and associations on detections. Moving localization additionally depends on its retained pose product and scan schedule. The existing observation validator checks producer/output consistency and dependency cycles. The radar evaluator checks that neither synthetic truth nor a raw oracle payload appears in detector, threshold, association, tracker or platform-pose ancestry. Shared generator configuration or method descriptions are permitted. These checks validate the declared dependency graph; review and reproducibility tests must still establish that executable code follows it.

The acquisition context continues to own channel calibration, exact manifest revision, clock uncertainty, calibration validity and reports. An example can provide fictional calibration documentation when clearly marked simulated. The radar profile does not replace these contracts or turn unknown calibration into a passed scientific finding.

## What a passing result establishes

Passing checks establish declared structure, source bytes, layout consistency, temporal ordering, selected-cell geometry, association integrity, admissible covariance and declared processing separation. The receipt keeps `scientific`, `physicalCalibration` and `trackingPerformance` as `not_checked`.

The deterministic [fixed scanning example](../../../examples/radar-scanning) and [moving-platform examples](../../../examples/radar-moving) include separate algorithm verifiers. Its return synthesis, threshold procedure, localizer and detector-only tracker demonstrate the contract. They are not an electromagnetic propagation model, a certified constant-false-alarm detector or a benchmark of real radar capability.

`readRadarProducts` is a dependency-free numerical decoder for browser/standalone implementations after profile evaluation or equivalent verification of the exact pinned artifacts. It does not independently verify hashes, lineage, covariance or scientific adequacy. Do not treat successful decoding as profile validation.

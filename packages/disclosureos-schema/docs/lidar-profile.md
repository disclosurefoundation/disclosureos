# Optional static lidar point-cloud profile

The `lidar_point_cloud_profile` is an opt-in contract for a retained discrete-return point table with a complete static raster pulse ledger. It binds local coordinates, return ordinals, source class annotations and normalized amplitude to exact source bytes. It does not replace LAS/LAZ, decode those formats or claim compatibility with all lidar systems.

Import `LidarProfileSchema`, `evaluateLidarProfile`, `readLidarProducts` and `validateLidarDeclaration` from `@disclosureos/schema/experimental/v2`. The portable schema is exported at `@disclosureos/schema/experimental/v2/lidar-profile/schema/0.1.0`. The canonical example is `examples/lidar-point-cloud`.

## Retained source contracts

The strict declaration identifies the observation, acquisition context, acquisition, pinned channel, source selection and two distinct source products. Each acquisition product must be a retained raw source artifact for the selected acquisition. The corresponding observation product and source layout must have the same SHA-256 digest, media type and byte extent. Here `raw` describes the retained source before viewer transformation, including source-provided annotations; it does not mean unprocessed receiver waveform or sensor voltages. Synthetic examples use explicitly authored source tables.

The profile uses UTF-8 CSV with headers, comma separators and complete table rows. Product source selections address zero-based logical data rows, excluding the header. The pulse columns are `pulse_id,scan_row,scan_column,aim_x_m,aim_y_m,aim_z_m,status,return_count`. The return columns are `pulse_id,return_number,return_count,x_m,y_m,z_m,intensity,class_code`. The reader returns exact byte spans for each logical CSV row, excluding its line terminator. Quoted cells and CRLF are supported through the shared CSV reader.

A raster contains one row per declared cell, in row-major index order. The order is not a timestamp, scan frequency or travel-time measurement. The current profile has no pulse timestamps. It does not infer pulse time from the observation's publication date.

## Coordinates and returns

The frame is local right-handed east/north/up in metres with an explicit origin description and fixed sensor origin. Geographic registration is not provided by this profile. A provider requiring geographic coordinates must retain the transformation and registration metadata separately; this local profile does not claim a surveyed origin or positional accuracy.

Each pulse aim coordinate defines a direction from the sensor. It is not a measured surface or a maximum range boundary. A retained point must lie on the positive ray within the declared encoding tolerance and range limits. The derived `rangeM` is Euclidean distance from the retained XYZ to the sensor, not an independent time-of-flight measurement. The ray tolerance expresses numeric consistency only, never physical uncertainty or survey accuracy.

A retained pulse has one to fifteen returns. All return ordinals from 1 through its declared count must exist once, with consistent counts and strictly increasing slant range. A single return is both first and last. Return order does not determine whether a point is ground, vegetation or a structure. The maximum pulse count is 65,536 and maximum point count is 983,040; these are bounded reference-reader limits rather than limits on the wider standard.

## Availability and annotations

- `retained` has a complete return group and a positive count.
- `no_return` records zero detected returns, with numeric count zero. It does not establish an empty volume, a transparent medium or a cause of the detection result.
- `unavailable` has no retained returns and an empty count cell. The count is unknown. It is not coerced to zero, and it does not distinguish unacquired, lost or withheld data.

An all-no-return capture may retain a header-only point table. Missing points are not interpolated or turned into a terrain mesh by the profile reader.

Intensity is an explicitly normalized source amplitude between zero and one. It is not calibrated reflectance, power, material identity or a guarantee of cross-instrument comparability. A provider must document normalization separately when using real data.

The class lookup and method are required. Class labels are source-provided annotations. Synthetic examples must use `authored_annotations`; a real source may use `source_annotations`. The example lookup uses numeric codes 0, 2, 5 and 6 for unassigned, terrain, vegetation and structure. These declared meanings do not imply LAS conformance, independent classification accuracy or material identification.

## Evaluation boundaries

`evaluateLidarProfile(observation, context, selection, profile, {assets})` validates structures, acquisition linkage, hashes, table layout, complete return groups, class vocabulary, intensity bounds and local ray geometry. Missing bytes or any inconsistency fails evaluation without exposing decoded data. The dependency-free reader checks numerical and table semantics; callers must separately verify hashes and document linkage, preferably with the evaluator.

Successful evaluation leaves `scientific`, `physicalCalibration`, `classificationAccuracy` and `georeferencing` at `not_checked`. It is not a detection-quality, surveying or calibration certificate. The example model omits beam footprint/divergence, propagation, waveforms, receiver response, detection thresholds, noise and temporal dynamics. The opaque roof patch blocks its intersecting rays; walls are not modeled.

## References

The return ordinal, count, class and intensity distinctions follow the terminology in the [ASPRS LAS specification](https://lasformat.org/latest/02.00_definition.html#point-data-record-format-6). This profile does not assert LAS conformance. [USGS collection requirements](https://www.usgs.gov/ngp-standards-and-specifications/lidar-base-specification-collection-requirements) treat return coverage and voids as separate quality concerns. The [USGS lidar glossary](https://pubs.usgs.gov/tm/11b4/pdf/tm11-B4.pdf) explains why discrete-return intensity depends on the acquisition system and is not a general calibrated energy measurement.

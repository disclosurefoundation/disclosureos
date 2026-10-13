# Optional active sonar envelope profile

The `SonarProfileSchema` contract interprets an existing retained monostatic echo envelope. It is additive: generic observations and acquisition records do not need a sonar profile. It does not add a sonar-specific source format or change the core observation contract.

The runtime schema, `sonarProfileJsonSchema()` and portable `experimental/v2/sonar-profile/schema/0.1.0` export describe the same declaration. `evaluateSonarProfile(observation, acquisition, sourceSelection, profile, { assets })` checks the cross-document relationships and source content. `assets` is a map from observation product references to retained byte arrays. These exports are implemented on the current V2 development branch; package publishing is separate.

## Required meaning

This bounded profile supports monostatic normalized echo envelopes with a constant assumed sound speed. It requires distinct amplitude and receive-mask source products, both explicitly bound to raw acquisition products from the selected capture. Here, raw means the retained envelope input; it does not imply the original electrical receiver waveform.

Both products use existing standard `binary_array` layouts with the same ordered axes:

1. `ping`: a `time` axis with the declared UTC origin, positive rational step and ping count.
2. `two_way_delay`: a `regular` axis in seconds with nonnegative origin, positive step and delay-bin count.

Amplitude is little-endian float32, quantity `normalized_echo_amplitude`, unit `1`, in [0,1]. Receive availability is uint8, quantity `receive_availability`, unit `1`. The whole, row-major sources start at byte offset zero. The profile supports at most 16,777,216 cells. Every receive sample must precede the next ping; this version does not describe ambiguous or overlapping ping receive windows.

## Missing reception

The mask is required, even when every sample is available. A value of 1 means the amplitude is retained. A value of 0 means no amplitude is retained at this coordinate; its storage slot must be zero. This is a storage placeholder, not a measurement. A measured zero with mask 1 remains valid. Empty reception across every cell is also valid.

Do not infer why a sample is absent. The mask does not identify a physical shadow, sensor failure, propagation loss, exclusion rule or negative observation. Do not interpolate or connect a plotted line through masked cells.

## Distance and source selection

The profile declares `constant_assumed_sound_speed`, `two_way` travel path and `modeled_one_way_path_length`. The conditional calculation is:

```text
modeled path length = assumed sound speed × two-way delay / 2
```

This is not a measured depth, horizontal range, bearing, target location or physical range resolution. It assumes the declared constant speed along the path; no sound-speed profile or ray tracing is supplied.

The dependency-free `readSonarProducts(profile, layouts, assets)` returns decoded storage arrays after layout/content checks. It deliberately does not perform hashing or validate acquisition lineage; use the evaluator or another trusted integrity boundary first. Its structural `SonarDeclaration` type does not depend on the schema runtime.

`sonarSample(profile, ping, bin)` gives the declared delay, modeled distance, ping-origin offset, receive offset and exact amplitude/mask byte offsets. `sonarDistance(profile, delaySeconds)` applies the declared two-way conversion. `readSonarSample(profile, decodedProducts, ping, bin)` returns `amplitude: null` for an unavailable cell and a number for an available cell. The standard `readProductSourceSelection` reader remains available for inspection of the original storage value, including a documented placeholder.

A ping-origin timestamp and a received delay sample have different times. Source selection returns the ping-axis time; the receive offset adds that cell's two-way delay. Both are checked against the declared acquisition and observation intervals, including UTC digits finer than milliseconds.

## Verification boundary

The evaluator checks exact document IDs, acquisition/channel and artifact bindings, source layouts, dimensions, axes, units, UTC intervals, SHA-256 digests, finite normalized values and binary mask semantics. Caller-owned buffers are copied before asynchronous digest checks.

A passed result leaves `scientific`, `physicalCalibration` and `propagationAccuracy` as `not_checked`. It does not certify an instrument, pressure calibration, object identity, bathymetry, physical clock, bandwidth, propagation, multipath, detection or tracking performance. Unknown properties and unsupported semantics are rejected rather than silently accepted.

The [reproducible example](../../../examples/sonar-active) supplies a 64 × 256 envelope and mask, methods, executable synthesis, complete contracts and a source index. It shows converging and overlapping authored components, a transient and explicit gaps. It performs no detector or tracker. The [NOAA sonar overview](https://oceanservice.noaa.gov/facts/sonar.html) provides background on transmitted pulses and received echoes; the synthetic fixture is not a NOAA instrument model.

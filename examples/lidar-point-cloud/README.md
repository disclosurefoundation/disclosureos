# Static lidar return example

This fictional DisclosureOS reference capture contains a complete 33 × 41 pulse ledger and retained discrete returns from an authored scene. It is not partner data or a physically validated lidar simulation.

The local frame is right handed, in metres: x points toward authored east, y toward authored north, and z upward. The origin and cardinal directions are illustrative and have no surveyed geographic reference. The fixed sensor is at (0, 0, 18). No pulse timestamps are supplied: raster index is not time.

The pulse aim coordinates define a ray from the sensor, not a measured surface. Retained return groups contain every listed ordinal, nearest first. A single return is both first and last. Vegetation can have multiple authored returns. The opaque roof patch blocks the rays that intersect it and has only its roof return. Walls are not modeled. No terrain surface is interpolated under it.

Two rectangular parts of the pulse ledger demonstrate different source states. `no_return` means the authored detector reports zero returns without a physical cause model. It does not establish empty space. `unavailable` means the return information is not retained; the return-count CSV cell is empty, not zero. Neither state is rendered as a surface.

Point class labels are authored annotations using a declared example lookup, not the result of a classifier or a claim of LAS conformance. Intensity is an authored normalized amplitude between 0 and 1. It is not reflectance, material identity or calibrated power. The scene does not model beam divergence, atmospheric propagation, footprint, waveform, receiver response, detection thresholds, range noise or classification accuracy.

Run `node examples/lidar-point-cloud/build.mjs` and `node examples/lidar-point-cloud/verify.mjs` from the repository root. The verification command regenerates and compares every file, then invokes the published optional profile evaluator. The evaluator checks source identity, exact retained bytes, complete groups and local ray consistency. It does not validate real surveying accuracy.

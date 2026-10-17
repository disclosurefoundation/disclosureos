# Moving-platform scanning radar examples

Two reproducible, fictional captures extend the optional radar profile: an airborne sensor looking at an assumed ground plane and a shipborne sensor reporting horizontal surface ranges. Both retain received-power arrays, dwell schedules, per-dwell platform position and heading, detector thresholds, detections, filter states, associations and separate scenario truth.

## Reproduce

From the repository root, build the experimental packages, then run:

```sh
node examples/radar-moving/build.mjs
node --test examples/radar-moving/model.test.mjs
node examples/radar-moving/verify.mjs
```

The packets are written under `generated/airborne` and `generated/shipborne`. Each packet retains `model.mjs`, its complete `radar-scanning-model.mjs` dependency and the parameters in `methods.json`. Import `simulate` and `scenarioConfigs` from the retained model to reproduce the numerical products without the website.

## What these scenes demonstrate

The airborne platform follows a constant-speed, constant-turn path at an assumed 900 metres above a flat ground plane. Two moving ground returns, a stationary landmark, broad fixed clutter and one transient contribute to the received array. Its sensor measures slant range. An assumed known ground plane allows that range to be projected onto local east/north coordinates. This is not a three-dimensional target-height measurement. The elevation response is not modeled; every modeled scattering component is assigned to that plane, including background power when shown spatially. Bins shorter than the platform-to-plane distance cannot be projected and must be omitted from spatial localization.

The shipborne platform follows a slower constant-speed turn. Two moving surface returns and a fixed buoy sit in a horizontal plane. The source includes a broad fixed clutter component and a short-range directional background described as a sea-return teaching model. It is an authored intensity field, not a hydrodynamic or electromagnetic sea-clutter simulation. Horizontal range is reported directly; antenna height, pitch, roll and wave motion are excluded.

In both captures, the antenna bearing is clockwise from platform heading. Each sampled cell is translated and rotated using its own retained dwell-midpoint platform pose before a detection position is formed. A native sensor-relative display therefore changes as the platform moves and turns, while a common-frame display preserves the stationary landmark's approximate position. That distinction represents an actual coordinate transform, not a different visual skin.

## Processing and uncertainty

The detector uses only retained return powers and neighborhood thresholds to choose local peaks. It then uses the retained schedule and platform pose to localize each positive-weight neighborhood cell before calculating a weighted centroid. The tracker receives only these detections. It never receives scene identifiers or truth positions. Detection timestamps are peak-dwell midpoints; detections and tracks become available only after the complete scan. Moving targets sampled in neighboring dwells are not shifted to a common target epoch, so the estimator does not eliminate target scan skew.

The constant-velocity Kalman tracker uses a declared Cartesian measurement-error assumption. Its position covariance is conditional on the declared platform states and projection plane, both treated as exact. Navigation, heading, antenna alignment, altitude and plane uncertainty are not propagated. The displayed contours are not empirically calibrated confidence guarantees.

Truth is retained separately at every dwell end. It can be shown for comparison but is excluded from detector and tracker inputs. Fading periods and a transient return exercise prediction gaps, uncertainty growth, track creation and retirement without target-identity labels being handed to the estimator.

## Boundaries

These are synthetic educational captures, not ELDÆON data or representative aircraft/vessel hardware performance. There is no RF waveform, propagation, Doppler, real navigation system, full attitude solution, multipath, terrain/sea masking or calibrated false-alarm probability. The optional profile checks source structure, lineage, timing, dimensions and declared coordinate arithmetic. It does not establish physical validity, calibration or real-world detection capability.

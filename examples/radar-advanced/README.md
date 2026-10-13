# Steered sector and cooperative radar examples

These fictional examples demonstrate two distinct optional radar profiles in DisclosureOS. They are educational numerical sources, not simulations of named operational hardware or claims about military performance.

## Reproduce

From the repository:

```sh
node examples/radar-advanced/build.mjs
node --test examples/radar-advanced/model.test.mjs
node examples/radar-advanced/verify.mjs
```

Each downloaded packet retains `model.mjs`, its dependency `radar-scanning-model.mjs`, and the complete declared parameters in `methods.json`. Run either packet outside the repository:

```js
import { simulate, scenarioConfigs } from "./model.mjs";
const military = simulate(scenarioConfigs.military);
const secondary = simulate(scenarioConfigs.secondary);
```

Both models are seeded and deterministic. Retained packet bytes, product/source bindings and every data selection are verified. Scientific validity and physical calibration remain explicitly unchecked.

## Electronically steered sector

The military example uses a prescribed sector search with longer revisits between search beams. Not all military radars work this way. The schedule is authored in advance; it is not an adaptive scheduler and does not use hidden truth during processing.

`beam-schedule.csv` is the source of direction, start/end times and search/revisit purpose. Arrays have shape `[dwell, range]`. Neighboring dwell indices need not have neighboring beam directions. Each range profile is processed independently and a detection is placed exactly at its retained beam and range-bin center. Detection time is dwell midpoint; detections and estimated tracks become available at dwell end.

The tracker receives only detections and the schedule. It does not receive target labels, target velocities or generator truth. A coasting state means that a particular dwell did not update the track. The beam may simply have looked elsewhere. Track expiry is governed by elapsed time since the last detection, not by the number of dwells. Full covariance and last update times are retained separately.

The displayed covariance is conditional on the declared constant-velocity filter assumptions and fixed horizontal geometry. It does not represent calibrated hardware accuracy. No elevation, propagation, RF waveform, IFF or weapon model is present.

## Secondary Mode A and Mode C

This packet begins with decoded receiver output, not raw RF pulses. Interrogations and decoded replies are separate source tables. A valid reply may provide range and bearing while its pressure altitude is not recorded. Invalid replies retain their explicit invalid state and blank measurement fields. A missing reply is represented by absence of a reply row, never zero range, zero altitude or an assertion that no aircraft exists.

Each usable report copies one valid decoded reply exactly and records its reply identifier. The example does not fuse Mode A and Mode C rows into an aircraft track. A four-digit octal Mode A code is reported data, not verified identity or authentication. Leading zeros must be preserved.

Mode C pressure altitude uses the 1013.25 hPa reference in 100-foot increments. It is not geometric height. Reports remain in polar slant range and bearing; pressure altitude is never used to calculate horizontal ground position.

The separate truth table includes a source with its transponder disabled. It has no sensor-reported marker or usable report. Truth is a distinct teaching view and is not consumed by report selection.

## Products and lineage

`observation.json` retains source and processing relationships. `acquisition.json` binds the numerical source to its measured product. `source-selection.json` declares exact CSV columns and array axes. `radar-profile.json` declares the profile semantics. `index.json` contains SHA-256 fingerprints and byte lengths for every retained source file. Browser displays must use the actual retained products, preserve missing values and respect declared availability times.

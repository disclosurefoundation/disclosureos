# Rotating radar reference example

This fictional example demonstrates how DisclosureOS can retain a complete, inspectable measurement process: sampled returns, threshold decisions, detections, estimated tracks and separate scenario truth. It is a reduced numerical model, not a simulation of a particular radar or a statement about real hardware performance.

The packet uses the ordinary V2 observation, acquisition and product-source-selection contracts plus the optional radar profile. None of the visualizations need a page-only source format. Every return cell and report row can be selected from its digest-pinned artifact. `index.json` is a generated convenience projection; authoritative reads use the canonical source reader and radar profile reader.

## Reproduce and verify

From the repository root, after building the packages:

```sh
node examples/radar-scanning/build.mjs
node --test examples/radar-scanning/model.test.mjs
node examples/radar-scanning/verify.mjs
```

`build.mjs` accepts an optional output directory. It writes the authored source artifacts and contract documents to `generated/` by default. `verify.mjs` reproduces every byte, runs the canonical contract evaluators, then reads every table row and numerical cell through the canonical source selector. A successful verification confirms consistency and source identity. It does not establish scientific validity, physical calibration or operational performance.

## What the example contains

| Product                     | Retained artifact           | Meaning                                                                                                          |
| --------------------------- | --------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Dwell schedule              | `scan-schedule.csv`         | 16 rotations, 72 azimuth dwells per rotation; one complete rotation takes 4 seconds.                             |
| Received returns            | `returns.f32`               | 16 × 72 × 64 relative-power cells. Values are nonnegative and can exceed 1.                                      |
| Thresholds                  | `thresholds.f32`            | The actual threshold applied to each received cell.                                                              |
| Detections                  | `detections.csv`            | Local peaks above threshold, with retained source-cell indices and a declared neighborhood estimate of position. |
| Estimated tracks            | `tracks.csv`                | Constant-velocity filter states predicted to each completed scan's end, with position covariance.                |
| Associations                | `associations.csv`          | The detection used to update each track in each scan.                                                            |
| Complete filter state       | `track-state.csv`           | All 16 covariance entries plus hit/miss counters for independent numerical verification.                         |
| Scenario truth              | `scenario-truth.csv`        | Separate authored positions at each dwell end; never supplied to detection or tracking.                          |
| Methods and executable code | `methods.json`, `model.mjs` | Seed, equations, parameters, assumptions and implementation.                                                     |

The angular samples are at 0°, 5°, …, 355°, clockwise from local north. Horizontal range-cell centers are at 25, 75, …, 3175 metres. The fixed station is at the origin of a local east/north plane. There is no terrestrial coordinate transform or measured height.

## The experiment

Two objects follow distinct constant-velocity paths. A Gaussian angular/range response places their contributions into sampled cells. Independent exponential noise and a broad stationary clutter component are added with a retained pseudorandom seed.

The first object's return is deliberately attenuated during scans 6–8, and the second during scans 11–12. This is prescribed fading. The example does not infer an obstruction, disappearance or unusual motion from a missed detection. A one-scan transient also produces a tentative track that subsequently expires. Noise may produce further threshold crossings; the filter does not receive a list of which detections are “real.”

The detector computes an empirical threshold from neighboring range cells, excludes guard cells around the selected cell and finds local maxima. This is not a calibrated false-alarm-rate claim. Positions are the Cartesian center of power in a 3 × 3 source neighborhood after subtracting the declared floor.

The tracker receives only detection rows. It applies nearest-neighbor association, a constant-velocity transition, an assumed acceleration process-noise model and a linear Kalman update with Joseph covariance form. New tracks begin at zero velocity with large velocity uncertainty. Three updates establish the filter's `confirmed` state. A missed update produces `coasting`; four consecutive misses retire the track. These are algorithm states, not claims about identity or scientific verification.

## Time and visibility

Return samples are evaluated at the dwell midpoint and become available at the dwell end. A detection's `time_s` is the selected peak cell's measurement time. Because the local-maximum and centroid operations inspect neighboring azimuth dwells, detection output is available only after the entire scan has completed.

The estimator processes detection timestamps in order, then predicts active tracks to the scan end. The UI must not reveal detections or tracks before that availability time. A scan may therefore display acquired return cells while continuing to show the previous completed scan's track estimate. Do not relabel that older track state as a current measurement.

Neighboring azimuth cells were measured at different times. The centroid uses their original values without motion compensation, so its assigned midpoint epoch is an approximation. The assumed filter measurement error does not prove that scan-skew error has been corrected. The scenario speeds and dwell intervals make this a useful reduced example; high-speed or boundary-crossing cases require more complete modeling.

## Uncertainty and truth

`tracks.csv` retains the local east/north covariance. A 95% ellipse uses the two-dimensional Gaussian chi-square threshold 5.991464547. It represents the estimator's assumed uncertainty, not a measured accuracy guarantee, a detection probability, or confidence in a target's identity.

The first missed-return interval increases track uncertainty while the estimate follows its motion model. Reacquisition reduces it. The separate truth overlay makes the discrepancy inspectable. Truth must stay visibly distinct, and it must not be an input to the detector, association algorithm or estimator.

Measurement and process covariances are declared teaching assumptions. No physical calibration, instrument timing traceability, atmosphere, multipath, realistic antenna sidelobes or validated propagation model is claimed. Received power is relative numerical intensity, not watts, radar cross-section or physical reflectivity.

## Validation boundaries

The model tests check byte reproducibility, source sampling, independent threshold calculations, source-cell detection links, sequential measurement epochs, one-to-one associations, prediction/update equations, positive-definite covariance, growing uncertainty on missed updates, reacquisition and tentative-track retirement. Translation-equivariance and empty-input tests prevent the tracker from substituting the authored truth trajectory for measurement-based inference.

The radar profile additionally checks artifact identity, layouts, product roles, source relationships, covariance and processing ancestry. Its scientific-validation result remains `not_checked`.

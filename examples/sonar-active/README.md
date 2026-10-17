# Active sonar echo-envelope example

This is a fictional, reproducible monostatic echo-envelope capture. It teaches how retained ping times, two-way delays, amplitudes and receive availability belong together. It is part of the DisclosureOS example case, not partner data.

Run from the repository root after building the schema package:

```sh
node examples/sonar-active/build.mjs
node examples/sonar-active/verify.mjs
```

`echo-envelope.f32` contains 64 pings by 256 delay bins in row-major, little-endian float32 format. `receive-mask.u8` has identical axes: 1 means the sample is retained; 0 means no amplitude is retained. Unavailable cells contain a zero storage placeholder. It must never be displayed as a measured zero, a negative observation or an acoustic shadow. Use `readSonarSample` or apply the mask explicitly before plotting.

Ping origins are one second apart from the authored UTC origin. Delay bin j is j × 0.001 seconds after transmission. Each selected sample therefore has both a ping-origin time and a receive-time offset. Distance is conditional: 1,500 m/s × two-way delay / 2. The constant sound speed is an assumption, not a measured sound-speed profile. The maximum selected delay is 0.255 seconds and its modeled one-way path length is 191.25 metres. Sample spacing does not establish physical range resolution or accuracy.

The envelope has two converging, overlapping authored components and a brief additional echo. The method retains formulas rather than inferred object identities. Three complete pings and one rectangular delay region are deliberately not retained. The example does not infer their physical cause. The raw label means original retained input to this example; it does not claim a raw electrical or acoustic receiver waveform.

The source packet contains the observation, acquisition, product-source layouts, optional sonar profile, methods and executable model. The public evaluator checks their bindings, hashes, axes, time interval, values and missing-data semantics. No detector, tracking, bathymetry, beam angle, sound-pressure calibration, carrier waveform, bandwidth, propagation, multipath or physical clock model is supplied. Validation does not establish physical accuracy or identify a target.

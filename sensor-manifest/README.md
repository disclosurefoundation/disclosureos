# UAP Sensor Manifest — a per-sensor specification standard for UAP detection

A proposal to **DisclosureOS** (Disclosure Foundation) from **ELDÆON**: a machine-readable standard that catalogs the *instruments* underneath a sighting. DisclosureOS describes a record; the sensor manifest describes the hardware that produced it — so that when any group does a field mission or a data drop, the result is comparable, replicable, and verifiable by everyone else.

## Why

The diagnosis is consistent across the community and the literature:

- The 2026 UAP Detection and Tracking Summit and the International UAP Coalition workshops that followed found **no shared detection standards across the 11+ active civilian groups** — sensor data held in silos, incomparable across organizations, with inconsistent calibration practices and no common taxonomy. The data working groups' conclusion: *data format, metadata schema, provenance record, and quality threshold must be defined first — without shared definitions, integration is impossible regardless of engineering effort.*
- AARO Director Jon Kosloski, in the CTX Spring 2026 UAP special issue (Naval Postgraduate School, in partnership with AARO): *"Far and away, AARO's biggest challenge is a lack of high-quality data"* — and AARO's top research priority is integrating diverse multi-domain sensing into a unified architecture where systems can talk to each other.
- Randy Bostick (former AARO Science Advisor), same issue: *"Any substantive UAP claims must be founded upon vetted, sharable data with a known and described quality."* And on calibration specifically: *"While it is desirable that sensors be calibrated as well as possible, it is more important that the degree of calibration be known."*

This manifest is the instrument layer of that answer. Each organization publishes what it flies, what each sensor measures and in what units, how it is time-synchronized, where its raw data lives, and — honestly — how (or whether) it is calibrated.

## What's here

- **`sensor-manifest.schema.json`** — the standard itself (JSON Schema, org-neutral). Any operator validates against it.
- **`eldaeon-sensors.json`** — ELDÆON's manifest: 28 sensors across 6 modalities on the Dionysus platform, plus declared future hardware upgrades. This is the first published instance and the worked example.
- **`validate.mjs`** — dependency-free validator; checks every `*-sensors.json` in this directory.

## A registry of manifests, not one org's catalog

The standard is designed for many publishers. Each vendor, research group, or institution drops its own `<org>-sensors.json` — same schema, direct apples-to-apples comparison:

- **ELDÆON** — `eldaeon-sensors.json` (this file, the example)
- **Galileo Project**, **UFODAP**, **Sky360**, **UAPx**, **Project Hessdalen**, and every other group building detection hardware — invited to publish theirs

Two design choices make that practical:

1. **Spec-level disclosure without product disclosure.** `manufacturerModel` accepts class descriptors (e.g. "dual GM-tube counter, high + low sensitivity") instead of product names. Groups can share everything science needs — bands, ranges, resolutions, uncertainties — without giving away sourcing they consider proprietary.
2. **Honest calibration state as first-class data.** The `calibration` block separates `currentMethod` (what the operator actually does today) from `traceableReference` + `referenceInUse` (the reference it has identified, and whether it is actually in use). Declaring "none" or "factory only" is valid and *useful* — the degree of calibration is known, which is the scientific requirement.

## The 6 modalities

`audio` · `electro_optical` · `radio_frequency` · `quantum` · `environmental` · `biometric`

## What each sensor entry captures (the DisclosureOS extension)

Each entry carries the fields DisclosureOS's `SensorReading` lacks — the functional hardware context an operator needs to replicate an experiment:

- **Sensor type:** `disclosureosMapping` maps each sensor to a `sensorType`/`detectionMethod`; `proposedSensorType` / `proposedDetectionMethod` flag the values proposed for DisclosureOS's enums (20 sensor types + 3 detection methods) (infrasonic, ultrasonic, passive radar, muon, TRNG, fluxgate, air-quality, …).
- **Timing:** `timing.timeSource` + `timeUncertaintyNs`. Timestamp error of even a few seconds confounds multi-station triangulation; GPS-disciplined or atomic time must be declared, not assumed.
- **Uncertainty:** `measurements[].unit` + GUM uncertainty (`u_c`/`U`/`k`/type), so confidence in derived results can be quantified from error analysis.
- **Raw data:** `rawData.format` + `locatorPattern`. This supports the metadata-first architecture the community converged on: circulate metadata widely, pull raw data on demand.
- **Calibration:** current method, traceable reference, whether the reference is in use, cadence, and uncertainty budget (see above).
- **`futureUpgrades`** — planned hardware declared ahead of deployment, so data consumers can anticipate new streams.

## Passive radar

The ELDÆON manifest includes its passive bistatic radar. The processing stack is public, MIT-licensed open source (forks of `blah2` and `adsb2dd`), and the entry demonstrates the standard's calibration model at its best: every detection is continuously truth-associated against ADS-B aircraft converted into bistatic delay-Doppler coordinates, with match residuals recorded. Instrument description, delay-Doppler maps, and detections are publishable; raw signal data stays out of public data drops pending export-control review.

## Scoring hook

A standardized, *verified* sensor entry should let DisclosureOS scoring weight a record higher than one from an `other`/unverified sensor — a manifest like this turns the catalog into a quality signal, not just documentation. Calibration `status` (`none` → `candidate-identified` → `in-practice` → `documented`) gives the scoring layer a defensible gradient.

## Validation

`node validate.mjs` — validates every `*-sensors.json` manifest in this directory against the schema's core invariants (required fields, modality enum, unique ids, measurement units, calibration statuses, future upgrades).

## References

- *Unidentified Anomalous Phenomena: Science and Analysis*, CTX Special Issue, Spring 2026 — US Naval Postgraduate School, Center on Combating Hybrid Threats, in partnership with AARO.
- Human Institute — 2026 UAP Detection and Tracking Summit and International UAP Coalition workshop outbriefs (May 2026): breakout findings on data standards, calibration, and provenance.
- Watters et al. 2023, *J. Astron. Instrum.* 12, 2340006 — Galileo Project observatory instrumentation (multimodal suite precedent).

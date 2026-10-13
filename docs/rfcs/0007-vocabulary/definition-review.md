# Observable definitions: V2 baseline

Reviewed 13 October 2026. This is a terminology and methodological review, not completed scientific validation or domain-expert approval. The twelve definitions are implemented directly in `@disclosureos/observables`. The structured review record is [`observable-catalog-proposal.json`](observable-catalog-proposal.json); the package exports are the runtime source of truth.

## Scope

These are descriptive terms for an investigation, not sufficient conditions for an anomaly. Ordinary observations may fit a term. Anomaly status requires a stated comparison and an attributed assessment, independent of the label. The revised definitions separate apparent motion from physical acceleration, detection differences from intent, event timing from causation, and material characteristics from biological or non-terrestrial origin.

The `technology` and `biologics` categories remain editorial groups. They do not establish that technology or biology is present. Isotope analysis can describe non-biological material; a reported interaction is not a biosignature.

This directly replaces the V2 baseline. There are no historical aliases, migration rules or assessment crosswalks. New references identify the catalog, its exact revision, its retained bytes and a selected term. Publication fixes those bytes for reproducible future use; the catalog is never resolved through an unversioned latest lookup.

## Current terms

| Code | Identifier | Label |
| --- | --- | --- |
| OC-T01 | `apparent_hover` | Apparent Hover |
| OC-T02 | `abrupt_motion` | Abrupt Motion |
| OC-T03 | `hypersonic_signature_discrepancy` | Hypersonic Motion and Signature Discrepancy |
| OC-T04 | `sensor_detection_discrepancy` | Sensor Detection Discrepancy |
| OC-T05 | `apparent_medium_transition` | Apparent Medium Transition |
| OC-T06 | `event_associated_biological_changes` | Biological Changes Around an Event |
| OC-B01 | `molecular_complexity_pattern` | Molecular Complexity Pattern |
| OC-B02 | `isotope_ratio_departure` | Isotope Ratio Departure |
| OC-B03 | `molecular_composition_difference` | Molecular Composition Difference |
| OC-B04 | `unresolved_sequence_relationship` | Unresolved Sequence Relationship |
| OC-B05 | `unresolved_morphological_characteristics` | Unresolved Morphological Characteristics |
| OC-B06 | `reported_biological_interaction` | Reported Biological Interaction |

## Definition and method boundaries

### OC-T01 — Apparent Hover

An object appears to remain within a limited region above a surface for a stated interval, while the available observations do not identify its means of support. This term records the support question; it does not identify a propulsion mechanism.

**Measurement rationale:** Assess support using position relative to a declared reference frame, duration, environmental conditions and the available observations of possible lift or suspension. Failure to resolve a support mechanism is an observation limit, not a violation of mechanics.

**Qualification:** Not seeing wings, exhaust or downwash does not show that they were absent. Distance, resolution, wind, buoyancy, tethering, viewing geometry and platform motion require consideration. A Doppler radial-velocity measurement alone does not establish three-dimensional station keeping.

**Relevant observations:**

- An account describes an object remaining above a surface without an identified means of support.
- A timed sequence indicates limited displacement in a stated reference frame.
- Recorded views or sensor channels do not resolve particular support features within stated limits.

**Methods and boundaries:**

- Retain the original account, time interval and observer position.
- Estimate position and motion with calibrated geometry; distinguish station keeping from apparent stillness caused by viewing geometry.
- Compare visible, thermal, acoustic or other available observations with the specific support mechanisms being tested, recording coverage and sensitivity.

**Methodological grounding:** [NASA UAP Independent Study Team Final Report (2023)](https://www.nasa.gov/wp-content/uploads/2023/09/uap-independent-study-team-final-report-0.pdf).

### OC-T02 — Abrupt Motion

An apparent or measured rapid change in motion, including a change in direction, speed or angular position. Any claim about physical acceleration must identify the quantity estimated and the observations used.

**Measurement rationale:** Angular motion, radial velocity and three-dimensional motion are different quantities. Physical acceleration estimates depend on geometry, timing, reference-frame motion and the analysis method; uncertainty and a stated comparison are needed to assess whether a result is unusual.

**Qualification:** A discontinuity in a track is not an instantaneous physical maneuver. A nearby platform accelerometer measures that platform, not the distant object. No universal acceleration threshold or biological tolerance is implied by this term.

**Relevant observations:**

- An account describes sudden departure, stopping, reversal or a sharp turn.
- A recorded angular position or other measured motion quantity changes over a short interval.
- An analysis estimates a physical acceleration with declared assumptions and uncertainty.

**Methods and boundaries:**

- Preserve timestamps, exposure duration, frame cadence and any missing intervals.
- Estimate angular motion separately from physical motion and document range information or constraints.
- Account for sensor/platform motion, tracking changes and processing before comparing derived accelerations with a stated reference.

**Methodological grounding:** [NASA UAP Independent Study Team Final Report (2023)](https://www.nasa.gov/wp-content/uploads/2023/09/uap-independent-study-team-final-report-0.pdf).

### OC-T03 — Hypersonic Motion and Signature Discrepancy

A proposed atmospheric trajectory at approximately Mach 5 or higher relative to the surrounding air, for which one or more specified signatures are reported or measured below an expected level. Retain the declared speed threshold and uncertainty; evaluate the speed estimate and each signature comparison separately.

**Measurement rationale:** Mach number depends on speed relative to the surrounding air and the local speed of sound. An expected acoustic, thermal, optical or other signature requires a stated model, environment, geometry and observation opportunity. A discrepancy is conditional on those assumptions.

**Qualification:** No recording, no sensor coverage and a measured non-detection are different states. A ground observer need not detect every atmospheric shock. The term does not require a visible plasma sheath and does not imply unknown physics.

**Relevant observations:**

- A reported or derived speed is described as hypersonic under stated atmospheric conditions.
- An observed signature is below a model prediction or detection threshold for a specified interval and channel.
- A source reports the absence of a named signature, with observation conditions retained where available.

**Methods and boundaries:**

- Record speed, reference frame, uncertainty, the declared hypersonic threshold, atmospheric conditions and the sound-speed model.
- Record the predicted signature at the observing sensor, including propagation and geometric assumptions.
- Compare calibrated observations, background levels and sensitivity with the prediction; retain separate results for each signature.

**Methodological grounding:** [NASA UAP Independent Study Team Final Report (2023)](https://www.nasa.gov/wp-content/uploads/2023/09/uap-independent-study-team-final-report-0.pdf), [NASA Glenn: Mach Number](https://www.grc.nasa.gov/www/BGH/mach.html).

### OC-T04 — Sensor Detection Discrepancy

A difference or interruption in detections of a candidate object across times, sensors or observing modes that calls for comparison of the observations and their limits.

**Measurement rationale:** Detection depends on the signal at the sensor, background, coverage, configuration and processing. Comparing observations requires time alignment and a justified association between candidate detections. A discrepancy alone does not specify its cause.

**Qualification:** An instrument fault, missing file, occlusion or untested association must not become a finding of stealth, jamming or intentional evasion. Do not infer low radar cross-section from missing track data alone.

**Relevant observations:**

- A candidate appears in one channel but has no associated detection in another.
- A retained track contains acquisition, interruption or reacquisition intervals.
- Detection strength or track behavior differs between instruments or processing settings.

**Methods and boundaries:**

- Compare synchronized source data with fields of view, sensitivity, background and sensor settings.
- Retain detection thresholds and raw/processed distinctions, including rejected returns where available.
- Review diagnostics and association methods before interpreting an interruption as loss of the same physical object.

**Methodological grounding:** [NASA UAP Independent Study Team Final Report (2023)](https://www.nasa.gov/wp-content/uploads/2023/09/uap-independent-study-team-final-report-0.pdf).

### OC-T05 — Apparent Medium Transition

An apparent or measured passage of a candidate object between media or across a declared environmental regime boundary, such as an air-water interface or a specified atmospheric-to-space boundary. Identify the conditions on each side, the boundary used and the continuity of the candidate.

**Measurement rationale:** A transition claim depends on positions relative to the boundary and on whether observations before and after it refer to the same object. Motion, shape and interface effects are separate quantities to compare; their absence is not built into this term.

**Qualification:** Appearance behind a horizon, into glare or below a resolved waterline is not sufficient to establish entry into water. Atmospheric-to-space travel has no single material surface: name the altitude or regime criterion when using that context. This term does not assert unchanged speed or absence of a splash.

**Relevant observations:**

- An account describes entry into or exit from a named medium.
- A continuous sequence appears to cross a located interface.
- Separate observing systems report candidates on opposite sides of a boundary within a specified time interval.

**Methods and boundaries:**

- Record the boundary location, observation geometry and any refraction or obscuration model.
- Retain observations through the transition where available; mark gaps and ambiguous associations.
- Compare before/after motion and any disturbance against separate stated expectations and detection limits.

**Methodological grounding:** [NASA UAP Independent Study Team Final Report (2023)](https://www.nasa.gov/wp-content/uploads/2023/09/uap-independent-study-team-final-report-0.pdf).

### OC-T06 — Biological Changes Around an Event

Reported symptoms or measured biological changes in a person, animal, plant or other organism in the context of an investigated event. Timing and any proposed exposure are recorded separately from a claim that the event caused the change.

**Measurement rationale:** Description of a symptom, clinical finding or environmental change is distinct from diagnosis and causal attribution. Assessments of an association require timelines, relevant baselines, potential exposures and consideration of alternative causes.

**Qualification:** An injury description does not identify radiation or another exposure mechanism. A later site reading does not reconstruct a past dose by itself. This category is not a clinical diagnosis or a basis for treatment advice.

**Relevant observations:**

- An account reports symptoms during or after an event.
- A clinical or laboratory record documents a finding and its examination time.
- A survey describes a change in vegetation or other organisms with a stated comparison.

**Methods and boundaries:**

- Retain the original account and distinguish event time, symptom onset, examination time and reporting time.
- Link authorized clinical or laboratory findings to their methods, reference ranges and uncertainty where applicable.
- Record exposure measurements and comparison observations separately; evaluate causal explanations in attributed claims.

**Methodological grounding:** [CDC Field Epidemiology Manual: Analyzing and Interpreting Data](https://www.cdc.gov/field-epi-manual/php/chapters/analyze-interpret-data.html).

### OC-B01 — Molecular Complexity Pattern

A measured or estimated molecular complexity and abundance pattern evaluated against a stated chemical comparison. The metric, estimation method and comparison conditions form part of the result.

**Measurement rationale:** Molecular assembly is one research approach to complexity and potential biosignatures. Its calculated index and experimentally estimated values depend on declared methods and assumptions. Interpretation as life, selection or engineering is a separate claim.

**Qualification:** Assembly-theory biosignature interpretations are contested. A fixed assembly-index threshold is not a universal proof of life or technology. An index does not measure the actual historical synthesis pathway, and a proposed biosignature does not establish non-terrestrial origin.

**Relevant observations:**

- A molecular structure receives a complexity value under a named algorithm.
- Spectral data support a method-specific estimate of molecular complexity.
- The distribution or abundance of identified molecules differs from a stated control or model.

**Methods and boundaries:**

- Retain raw spectra, preprocessing, molecule/ion selection and calibration data.
- Identify the complexity algorithm, software revision, uncertainty or bounds, and whether the value is calculated or inferred from spectra.
- Use blanks, reference compounds and relevant abiotic, biological or synthetic comparisons; report abundance and detection limits separately.

**Methodological grounding:** [Marshall et al. (2021), Identifying molecules as biosignatures with assembly theory and mass spectrometry](https://www.nature.com/articles/s41467-021-23258-x), [On the salient limitations of the methods of assembly theory and their classification of molecular biosignatures (2024)](https://www.nature.com/articles/s41540-024-00403-y), [NASA: Ladder of Life Detection](https://science.nasa.gov/astrobiology/researchers/life-detection-resources/ladder-of-life-detection/).

### OC-B02 — Isotope Ratio Departure

An isotope ratio or pattern that differs from an explicitly identified reference material, population or model under a stated measurement and comparison method.

**Measurement rationale:** Isotope comparisons require a defined ratio or delta scale, calibration, sample preparation, uncertainty and relevant reference values. A departure from a selected reference is a result to explain, not an origin assignment.

**Qualification:** An unusual ratio is not by itself a non-terrestrial, biological or technological signature. Reference selection, fractionation, mixing, contamination and processing can change an interpretation. This material-analysis term does not establish that the sample is biological.

**Relevant observations:**

- A measured isotope ratio differs from a named reference beyond a declared comparison criterion.
- An isotopic pattern varies across portions or phases of a sample.
- Independent measurements reproduce a stated departure within their uncertainty.

**Methods and boundaries:**

- Identify the specimen and preparation history, isotope ratios, units or delta scales, and reference materials.
- Report blanks, correction methods, interference checks, mass-bias treatment and uncertainty.
- Compare replicated results and relevant natural, industrial or laboratory alternatives before evaluating provenance claims.

**Methodological grounding:** [NIST: Value Assignment and Uncertainty Estimation of Selected Light Stable Isotope Reference Materials](https://www.nist.gov/publications/value-assignment-and-uncertainty-estimation-selected-light-stable-isotope-reference), [NASA: Ladder of Life Detection](https://science.nasa.gov/astrobiology/researchers/life-detection-resources/ladder-of-life-detection/).

### OC-B03 — Molecular Composition Difference

A molecular structure, composition or chemical behavior that differs from a specified biochemical reference. The observation can concern a material whose biological status is unresolved.

**Measurement rationale:** Structural and chemical measurements can support comparisons without establishing that a material is living. Alternative molecular systems can also be synthesized, so unfamiliar chemistry alone does not identify a biological or non-terrestrial source.

**Qualification:** Failure of a DNA amplification or sequencing protocol does not establish alternative genetics. Bulk elemental composition does not establish a molecular scaffold. The comparison must allow known biochemical diversity and synthetic chemistry; no four-base or twenty-amino-acid rule is universal proof of origin.

**Relevant observations:**

- Structural analysis identifies a polymer backbone, building block or molecular arrangement outside the stated comparison.
- Measured chirality or composition differs from a specified reference sample or range.
- A reproducible chemical behavior is not explained by the declared reference model.

**Methods and boundaries:**

- Use complementary structural or compositional measurements appropriate to the material and retain identification confidence.
- Record preparation, blanks, reference compounds and contamination controls.
- Test claims of biological function separately from chemical identity; document assay scope and failures without turning them into absence findings.

**Methodological grounding:** [Hoshika et al. (2019), Hachimoji DNA and RNA: A genetic system with eight building blocks](https://pubmed.ncbi.nlm.nih.gov/30792304/), [NASA: Ladder of Life Detection](https://science.nasa.gov/astrobiology/researchers/life-detection-resources/ladder-of-life-detection/).

### OC-B04 — Unresolved Sequence Relationship

A retained nucleic-acid or protein sequence for which a specified search or phylogenetic analysis does not establish a relationship within its declared reference set and acceptance criteria.

**Measurement rationale:** Sequence matching is conditional on data quality, database contents and analysis settings. An unresolved relationship is a bounded search result. It does not establish that a sequence is outside terrestrial biology or has an independent evolutionary origin.

**Qualification:** No BLAST match is not zero homology to all life. Short, damaged, contaminated or misassembled sequences and limited database coverage can leave a result unresolved. Non-DNA/RNA chemistry belongs in a separate molecular-characterization entry unless an applicable sequence representation is defined.

**Relevant observations:**

- A quality-reviewed sequence has no reported match meeting a declared threshold.
- Alternative analyses yield conflicting placements for the same retained sequence.
- Available marker coverage is insufficient for a stated taxonomic or phylogenetic assignment.

**Methods and boundaries:**

- Retain reads, quality measures, assembly provenance, extraction blanks and contamination checks.
- Name the database snapshot, software revision, filters, masking, scoring and acceptance thresholds.
- Report alignment coverage and alternative results; distinguish database similarity searches from phylogenetic inference and repeat against suitable comparison sets.

**Methodological grounding:** [NCBI BLAST Frequently Asked Questions](https://blast.ncbi.nlm.nih.gov/doc/blast-help/FAQ.html), [NCBI BLAST Search Parameters](https://blast.ncbi.nlm.nih.gov/doc/blast-topics/blastsearchparams.html), [Salter et al. (2014), Reagent and laboratory contamination can critically impact sequence-based microbiome analyses](https://link.springer.com/article/10.1186/s12915-014-0087-z).

### OC-B05 — Unresolved Morphological Characteristics

Observed form or internal structure that has not been assigned within a stated anatomical, cellular or other morphological comparison. Record the features and comparison separately from any identification of the specimen.

**Measurement rationale:** Morphological examination characterizes structures at a stated scale and resolution. Classification also depends on specimen condition, preparation, comparison coverage and independent observations. Unfamiliar form alone does not establish biological status or evolutionary origin.

**Qualification:** Appearance alone can be affected by preservation, preparation, deformation, assembly or imaging artifacts. A resemblance to cells, organs or a body plan does not by itself establish those structures or an independent lineage.

**Relevant observations:**

- An examination describes a feature absent from the declared comparison material.
- Imaging methods or examiners produce unresolved differences in structural identification.
- Available specimen condition or image resolution prevents a proposed identification.

**Methods and boundaries:**

- Retain specimen provenance, scale, orientation, preparation and original images.
- Describe visible features before assigning taxonomic or functional labels.
- Compare appropriate reference specimens and complementary imaging or composition analyses; document preservation artifacts and alternative reconstructions.

**Methodological grounding:** [NASA: Ladder of Life Detection](https://science.nasa.gov/astrobiology/researchers/life-detection-resources/ladder-of-life-detection/).

### OC-B06 — Reported Biological Interaction

An attributed account or documented observation of apparent contact, communication or directed action involving a person, animal or other organism during an investigated event. Retain the reported action separately from findings about an agent, intent or cause.

**Measurement rationale:** Testimony can establish what a source reported. Recordings, physical traces and clinical or veterinary findings can address specific parts of that account through their own methods. Similarity between reports or temporal association alone does not establish a shared agent or mechanism.

**Qualification:** This category includes testimony whose external circumstances are unresolved. It does not confirm an abduction, communication, intervention, intelligence or intent. A medical or psychological assessment is not a truth detector; an unexplained injury or animal tissue change does not by itself identify a responsible agent.

**Relevant observations:**

- A source describes apparent contact, communication, restraint or directed behavior.
- A recording documents a specified interaction for later interpretation.
- An examination records a physical finding alleged to be related to an interaction, with the attribution preserved.

**Methods and boundaries:**

- Retain original wording, interview context, chronology and account revisions, including how the account was elicited.
- Link independently collected recordings or physical findings to precise source passages without treating all parts of the account as corroborated.
- Evaluate physical traces with appropriate forensic, clinical or veterinary methods and record alternative explanations; keep any agency assessment separate.

**Methodological grounding:** [CDC Field Epidemiology Manual: Analyzing and Interpreting Data](https://www.cdc.gov/field-epi-manual/php/chapters/analyze-interpret-data.html) supports the association-versus-causation boundary only. The interview and forensic practices proposed above need domain review; this source does not validate an interaction taxonomy.

## Source and review boundaries

1. The sources below support methodological cautions, not this twelve-term taxonomy or any specific UAP claim. Some boundaries are DisclosureOS editorial judgments informed by those methods, rather than findings made by those institutions.
2. The Assembly Theory proposal and critique are retained as research context. Neither a universal assembly threshold nor a claim that the theory has been disproven becomes normative.
3. Biological interactions and specimen characterization still warrant independent domain review. This implementation does not claim that such review has been completed.
4. Freeze exact released catalog bytes and their digest. A package version or a mutable draft label alone is insufficient to identify a definition.
5. This is the DisclosureOS characteristics vocabulary. It is not a reproduction of the original ATIP framework; its terms intentionally describe observations without adopting mechanism or origin claims.

## Sources and support boundaries

- **nasa_uap:** [NASA UAP Independent Study Team Final Report (2023)](https://www.nasa.gov/wp-content/uploads/2023/09/uap-independent-study-team-final-report-0.pdf). Measurement calibration, sensor metadata, distance and comparison with known phenomena. Does not validate any case or the proposed taxonomy.
- **nasa_mach:** [NASA Glenn: Mach Number](https://www.grc.nasa.gov/www/BGH/mach.html). Mach depends on speed relative to local sound speed; atmospheric regime and conditions matter. Does not assert that every hypersonic passage produces a detectable signature at every sensor.
- **nist_isotopes:** [NIST: Value Assignment and Uncertainty Estimation of Selected Light Stable Isotope Reference Materials](https://www.nist.gov/publications/value-assignment-and-uncertainty-estimation-selected-light-stable-isotope-reference). Reference materials, laboratory preparation, intercomparison, cross-contamination and uncertainty in isotope measurement. Not an origin classifier.
- **blast_faq:** [NCBI BLAST Frequently Asked Questions](https://blast.ncbi.nlm.nih.gov/doc/blast-help/FAQ.html). A no-match result is relative to the selected database and search parameters; sequence length and statistical thresholds affect results.
- **blast_parameters:** [NCBI BLAST Search Parameters](https://blast.ncbi.nlm.nih.gov/doc/blast-topics/blastsearchparams.html). Database filters, word size, masking and significance thresholds affect search sensitivity and reported matches.
- **assembly_proposal:** [Marshall et al. (2021), Identifying molecules as biosignatures with assembly theory and mass spectrometry](https://www.nature.com/articles/s41467-021-23258-x). Primary proposal and experimental method linking mass spectral fragmentation to assembly estimates; its biosignature interpretation is a research claim, not a standard-level fact.
- **assembly_critique:** [On the salient limitations of the methods of assembly theory and their classification of molecular biosignatures (2024)](https://www.nature.com/articles/s41540-024-00403-y). Published methodological critique (a Perspective) of assembly measures and classification claims; establishes that the interpretation is disputed, not that every application is invalid.
- **contamination:** [Salter et al. (2014), Reagent and laboratory contamination can critically impact sequence-based microbiome analyses](https://link.springer.com/article/10.1186/s12915-014-0087-z). Primary controlled investigation of reagent contamination, especially for low-biomass sequence analyses.
- **hachimoji:** [Hoshika et al. (2019), Hachimoji DNA and RNA: A genetic system with eight building blocks](https://pubmed.ncbi.nlm.nih.gov/30792304/). Synthetic alternative nucleic-acid systems exist; unusual molecular chemistry does not by itself establish non-terrestrial origin.
- **life_detection:** [NASA: Ladder of Life Detection](https://science.nasa.gov/astrobiology/researchers/life-detection-resources/ladder-of-life-detection/). Potential biosignatures require measurement context and evaluation; the framework is provisional, not endorsement of a definitive biosignature.
- **causation:** [CDC Field Epidemiology Manual: Analyzing and Interpreting Data](https://www.cdc.gov/field-epi-manual/php/chapters/analyze-interpret-data.html). Observed association is distinct from causation; bias, confounding, temporality and alternative explanations need evaluation. No diagnosis or claim about UAP-associated illness.

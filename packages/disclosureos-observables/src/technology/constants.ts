import type { TechnologyObservable, TechnologyObservableId } from './types';

export const TECHNOLOGY_OBSERVABLES: Record<TechnologyObservableId, TechnologyObservable> = {
  "apparent_hover": {
    "id": "apparent_hover",
    "code": "OC-T01",
    "label": "Apparent Hover",
    "description": "An object appears to remain within a limited region above a surface for a stated interval, while the available observations do not identify its means of support. This term records the support question; it does not identify a propulsion mechanism.",
    "scientificBasis": "Assess support using position relative to a declared reference frame, duration, environmental conditions and the available observations of possible lift or suspension. Failure to resolve a support mechanism is an observation limit, not a violation of mechanics.",
    "detectionSignals": [
      "An account describes an object remaining above a surface without an identified means of support.",
      "A timed sequence indicates limited displacement in a stated reference frame.",
      "Recorded views or sensor channels do not resolve particular support features within stated limits."
    ],
    "methods": [
      "Retain the original account, time interval and observer position.",
      "Estimate position and motion with calibrated geometry; distinguish station keeping from apparent stillness caused by viewing geometry.",
      "Compare visible, thermal, acoustic or other available observations with the specific support mechanisms being tested, recording coverage and sensitivity."
    ],
    "caveat": "Not seeing wings, exhaust or downwash does not show that they were absent. Distance, resolution, wind, buoyancy, tethering, viewing geometry and platform motion require consideration. A Doppler radial-velocity measurement alone does not establish three-dimensional station keeping.",
    "caveatLabel": "Unidentified support is not anti-gravity",
    "references": [
      "https://www.nasa.gov/wp-content/uploads/2023/09/uap-independent-study-team-final-report-0.pdf"
    ]
  },
  "abrupt_motion": {
    "id": "abrupt_motion",
    "code": "OC-T02",
    "label": "Abrupt Motion",
    "description": "An apparent or measured rapid change in motion, including a change in direction, speed or angular position. Any claim about physical acceleration must identify the quantity estimated and the observations used.",
    "scientificBasis": "Angular motion, radial velocity and three-dimensional motion are different quantities. Physical acceleration estimates depend on geometry, timing, reference-frame motion and the analysis method; uncertainty and a stated comparison are needed to assess whether a result is unusual.",
    "detectionSignals": [
      "An account describes sudden departure, stopping, reversal or a sharp turn.",
      "A recorded angular position or other measured motion quantity changes over a short interval.",
      "An analysis estimates a physical acceleration with declared assumptions and uncertainty."
    ],
    "methods": [
      "Preserve timestamps, exposure duration, frame cadence and any missing intervals.",
      "Estimate angular motion separately from physical motion and document range information or constraints.",
      "Account for sensor/platform motion, tracking changes and processing before comparing derived accelerations with a stated reference."
    ],
    "caveat": "A discontinuity in a track is not an instantaneous physical maneuver. A nearby platform accelerometer measures that platform, not the distant object. No universal acceleration threshold or biological tolerance is implied by this term.",
    "caveatLabel": "Apparent motion is not physical acceleration",
    "references": [
      "https://www.nasa.gov/wp-content/uploads/2023/09/uap-independent-study-team-final-report-0.pdf"
    ]
  },
  "hypersonic_signature_discrepancy": {
    "id": "hypersonic_signature_discrepancy",
    "code": "OC-T03",
    "label": "Hypersonic Motion and Signature Discrepancy",
    "description": "A proposed atmospheric trajectory at approximately Mach 5 or higher relative to the surrounding air, for which one or more specified signatures are reported or measured below an expected level. Retain the declared speed threshold and uncertainty; evaluate the speed estimate and each signature comparison separately.",
    "scientificBasis": "Mach number depends on speed relative to the surrounding air and the local speed of sound. An expected acoustic, thermal, optical or other signature requires a stated model, environment, geometry and observation opportunity. A discrepancy is conditional on those assumptions.",
    "detectionSignals": [
      "A reported or derived speed is described as hypersonic under stated atmospheric conditions.",
      "An observed signature is below a model prediction or detection threshold for a specified interval and channel.",
      "A source reports the absence of a named signature, with observation conditions retained where available."
    ],
    "methods": [
      "Record speed, reference frame, uncertainty, the declared hypersonic threshold, atmospheric conditions and the sound-speed model.",
      "Record the predicted signature at the observing sensor, including propagation and geometric assumptions.",
      "Compare calibrated observations, background levels and sensitivity with the prediction; retain separate results for each signature."
    ],
    "caveat": "No recording, no sensor coverage and a measured non-detection are different states. A ground observer need not detect every atmospheric shock. The term does not require a visible plasma sheath and does not imply unknown physics.",
    "caveatLabel": "Non-detection needs a defined observation opportunity",
    "references": [
      "https://www.nasa.gov/wp-content/uploads/2023/09/uap-independent-study-team-final-report-0.pdf",
      "https://www.grc.nasa.gov/www/BGH/mach.html"
    ]
  },
  "sensor_detection_discrepancy": {
    "id": "sensor_detection_discrepancy",
    "code": "OC-T04",
    "label": "Sensor Detection Discrepancy",
    "description": "A difference or interruption in detections of a candidate object across times, sensors or observing modes that calls for comparison of the observations and their limits.",
    "scientificBasis": "Detection depends on the signal at the sensor, background, coverage, configuration and processing. Comparing observations requires time alignment and a justified association between candidate detections. A discrepancy alone does not specify its cause.",
    "detectionSignals": [
      "A candidate appears in one channel but has no associated detection in another.",
      "A retained track contains acquisition, interruption or reacquisition intervals.",
      "Detection strength or track behavior differs between instruments or processing settings."
    ],
    "methods": [
      "Compare synchronized source data with fields of view, sensitivity, background and sensor settings.",
      "Retain detection thresholds and raw/processed distinctions, including rejected returns where available.",
      "Review diagnostics and association methods before interpreting an interruption as loss of the same physical object."
    ],
    "caveat": "An instrument fault, missing file, occlusion or untested association must not become a finding of stealth, jamming or intentional evasion. Do not infer low radar cross-section from missing track data alone.",
    "caveatLabel": "Detection differences do not establish evasion",
    "references": [
      "https://www.nasa.gov/wp-content/uploads/2023/09/uap-independent-study-team-final-report-0.pdf"
    ]
  },
  "apparent_medium_transition": {
    "id": "apparent_medium_transition",
    "code": "OC-T05",
    "label": "Apparent Medium Transition",
    "description": "An apparent or measured passage of a candidate object between media or across a declared environmental regime boundary, such as an air-water interface or a specified atmospheric-to-space boundary. Identify the conditions on each side, the boundary used and the continuity of the candidate.",
    "scientificBasis": "A transition claim depends on positions relative to the boundary and on whether observations before and after it refer to the same object. Motion, shape and interface effects are separate quantities to compare; their absence is not built into this term.",
    "detectionSignals": [
      "An account describes entry into or exit from a named medium.",
      "A continuous sequence appears to cross a located interface.",
      "Separate observing systems report candidates on opposite sides of a boundary within a specified time interval."
    ],
    "methods": [
      "Record the boundary location, observation geometry and any refraction or obscuration model.",
      "Retain observations through the transition where available; mark gaps and ambiguous associations.",
      "Compare before/after motion and any disturbance against separate stated expectations and detection limits."
    ],
    "caveat": "Appearance behind a horizon, into glare or below a resolved waterline is not sufficient to establish entry into water. Atmospheric-to-space travel has no single material surface: name the altitude or regime criterion when using that context. This term does not assert unchanged speed or absence of a splash.",
    "caveatLabel": "A transition requires continuity and a located boundary",
    "references": [
      "https://www.nasa.gov/wp-content/uploads/2023/09/uap-independent-study-team-final-report-0.pdf"
    ]
  },
  "event_associated_biological_changes": {
    "id": "event_associated_biological_changes",
    "code": "OC-T06",
    "label": "Biological Changes Around an Event",
    "description": "Reported symptoms or measured biological changes in a person, animal, plant or other organism in the context of an investigated event. Timing and any proposed exposure are recorded separately from a claim that the event caused the change.",
    "scientificBasis": "Description of a symptom, clinical finding or environmental change is distinct from diagnosis and causal attribution. Assessments of an association require timelines, relevant baselines, potential exposures and consideration of alternative causes.",
    "detectionSignals": [
      "An account reports symptoms during or after an event.",
      "A clinical or laboratory record documents a finding and its examination time.",
      "A survey describes a change in vegetation or other organisms with a stated comparison."
    ],
    "methods": [
      "Retain the original account and distinguish event time, symptom onset, examination time and reporting time.",
      "Link authorized clinical or laboratory findings to their methods, reference ranges and uncertainty where applicable.",
      "Record exposure measurements and comparison observations separately; evaluate causal explanations in attributed claims."
    ],
    "caveat": "An injury description does not identify radiation or another exposure mechanism. A later site reading does not reconstruct a past dose by itself. This category is not a clinical diagnosis or a basis for treatment advice.",
    "caveatLabel": "Timing does not establish causation",
    "references": [
      "https://www.cdc.gov/field-epi-manual/php/chapters/analyze-interpret-data.html"
    ]
  }
};

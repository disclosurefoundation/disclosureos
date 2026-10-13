import type { BiologicsObservable, BiologicsObservableId } from './types';

export const BIOLOGICS_OBSERVABLES: Record<BiologicsObservableId, BiologicsObservable> = {
  "molecular_complexity_pattern": {
    "id": "molecular_complexity_pattern",
    "code": "OC-B01",
    "label": "Molecular Complexity Pattern",
    "description": "A measured or estimated molecular complexity and abundance pattern evaluated against a stated chemical comparison. The metric, estimation method and comparison conditions form part of the result.",
    "scientificBasis": "Molecular assembly is one research approach to complexity and potential biosignatures. Its calculated index and experimentally estimated values depend on declared methods and assumptions. Interpretation as life, selection or engineering is a separate claim.",
    "detectionSignals": [
      "A molecular structure receives a complexity value under a named algorithm.",
      "Spectral data support a method-specific estimate of molecular complexity.",
      "The distribution or abundance of identified molecules differs from a stated control or model."
    ],
    "methods": [
      "Retain raw spectra, preprocessing, molecule/ion selection and calibration data.",
      "Identify the complexity algorithm, software revision, uncertainty or bounds, and whether the value is calculated or inferred from spectra.",
      "Use blanks, reference compounds and relevant abiotic, biological or synthetic comparisons; report abundance and detection limits separately."
    ],
    "caveat": "Assembly-theory biosignature interpretations are contested. A fixed assembly-index threshold is not a universal proof of life or technology. An index does not measure the actual historical synthesis pathway, and a proposed biosignature does not establish non-terrestrial origin.",
    "caveatLabel": "Research metric; origin and life not established",
    "references": [
      "https://www.nature.com/articles/s41467-021-23258-x",
      "https://www.nature.com/articles/s41540-024-00403-y",
      "https://science.nasa.gov/astrobiology/researchers/life-detection-resources/ladder-of-life-detection/"
    ]
  },
  "isotope_ratio_departure": {
    "id": "isotope_ratio_departure",
    "code": "OC-B02",
    "label": "Isotope Ratio Departure",
    "description": "An isotope ratio or pattern that differs from an explicitly identified reference material, population or model under a stated measurement and comparison method.",
    "scientificBasis": "Isotope comparisons require a defined ratio or delta scale, calibration, sample preparation, uncertainty and relevant reference values. A departure from a selected reference is a result to explain, not an origin assignment.",
    "detectionSignals": [
      "A measured isotope ratio differs from a named reference beyond a declared comparison criterion.",
      "An isotopic pattern varies across portions or phases of a sample.",
      "Independent measurements reproduce a stated departure within their uncertainty."
    ],
    "methods": [
      "Identify the specimen and preparation history, isotope ratios, units or delta scales, and reference materials.",
      "Report blanks, correction methods, interference checks, mass-bias treatment and uncertainty.",
      "Compare replicated results and relevant natural, industrial or laboratory alternatives before evaluating provenance claims."
    ],
    "caveat": "An unusual ratio is not by itself a non-terrestrial, biological or technological signature. Reference selection, fractionation, mixing, contamination and processing can change an interpretation. This material-analysis term does not establish that the sample is biological.",
    "caveatLabel": "A reference departure is not an origin",
    "references": [
      "https://www.nist.gov/publications/value-assignment-and-uncertainty-estimation-selected-light-stable-isotope-reference",
      "https://science.nasa.gov/astrobiology/researchers/life-detection-resources/ladder-of-life-detection/"
    ]
  },
  "molecular_composition_difference": {
    "id": "molecular_composition_difference",
    "code": "OC-B03",
    "label": "Molecular Composition Difference",
    "description": "A molecular structure, composition or chemical behavior that differs from a specified biochemical reference. The observation can concern a material whose biological status is unresolved.",
    "scientificBasis": "Structural and chemical measurements can support comparisons without establishing that a material is living. Alternative molecular systems can also be synthesized, so unfamiliar chemistry alone does not identify a biological or non-terrestrial source.",
    "detectionSignals": [
      "Structural analysis identifies a polymer backbone, building block or molecular arrangement outside the stated comparison.",
      "Measured chirality or composition differs from a specified reference sample or range.",
      "A reproducible chemical behavior is not explained by the declared reference model."
    ],
    "methods": [
      "Use complementary structural or compositional measurements appropriate to the material and retain identification confidence.",
      "Record preparation, blanks, reference compounds and contamination controls.",
      "Test claims of biological function separately from chemical identity; document assay scope and failures without turning them into absence findings."
    ],
    "caveat": "Failure of a DNA amplification or sequencing protocol does not establish alternative genetics. Bulk elemental composition does not establish a molecular scaffold. The comparison must allow known biochemical diversity and synthetic chemistry; no four-base or twenty-amino-acid rule is universal proof of origin.",
    "caveatLabel": "Unfamiliar chemistry does not establish biology",
    "references": [
      "https://pubmed.ncbi.nlm.nih.gov/30792304/",
      "https://science.nasa.gov/astrobiology/researchers/life-detection-resources/ladder-of-life-detection/"
    ]
  },
  "unresolved_sequence_relationship": {
    "id": "unresolved_sequence_relationship",
    "code": "OC-B04",
    "label": "Unresolved Sequence Relationship",
    "description": "A retained nucleic-acid or protein sequence for which a specified search or phylogenetic analysis does not establish a relationship within its declared reference set and acceptance criteria.",
    "scientificBasis": "Sequence matching is conditional on data quality, database contents and analysis settings. An unresolved relationship is a bounded search result. It does not establish that a sequence is outside terrestrial biology or has an independent evolutionary origin.",
    "detectionSignals": [
      "A quality-reviewed sequence has no reported match meeting a declared threshold.",
      "Alternative analyses yield conflicting placements for the same retained sequence.",
      "Available marker coverage is insufficient for a stated taxonomic or phylogenetic assignment."
    ],
    "methods": [
      "Retain reads, quality measures, assembly provenance, extraction blanks and contamination checks.",
      "Name the database snapshot, software revision, filters, masking, scoring and acceptance thresholds.",
      "Report alignment coverage and alternative results; distinguish database similarity searches from phylogenetic inference and repeat against suitable comparison sets."
    ],
    "caveat": "No BLAST match is not zero homology to all life. Short, damaged, contaminated or misassembled sequences and limited database coverage can leave a result unresolved. Non-DNA/RNA chemistry belongs in a separate molecular-characterization entry unless an applicable sequence representation is defined.",
    "caveatLabel": "A limited search is not exclusion from the tree of life",
    "references": [
      "https://blast.ncbi.nlm.nih.gov/doc/blast-help/FAQ.html",
      "https://blast.ncbi.nlm.nih.gov/doc/blast-topics/blastsearchparams.html",
      "https://link.springer.com/article/10.1186/s12915-014-0087-z"
    ]
  },
  "unresolved_morphological_characteristics": {
    "id": "unresolved_morphological_characteristics",
    "code": "OC-B05",
    "label": "Unresolved Morphological Characteristics",
    "description": "Observed form or internal structure that has not been assigned within a stated anatomical, cellular or other morphological comparison. Record the features and comparison separately from any identification of the specimen.",
    "scientificBasis": "Morphological examination characterizes structures at a stated scale and resolution. Classification also depends on specimen condition, preparation, comparison coverage and independent observations. Unfamiliar form alone does not establish biological status or evolutionary origin.",
    "detectionSignals": [
      "An examination describes a feature absent from the declared comparison material.",
      "Imaging methods or examiners produce unresolved differences in structural identification.",
      "Available specimen condition or image resolution prevents a proposed identification."
    ],
    "methods": [
      "Retain specimen provenance, scale, orientation, preparation and original images.",
      "Describe visible features before assigning taxonomic or functional labels.",
      "Compare appropriate reference specimens and complementary imaging or composition analyses; document preservation artifacts and alternative reconstructions."
    ],
    "caveat": "Appearance alone can be affected by preservation, preparation, deformation, assembly or imaging artifacts. A resemblance to cells, organs or a body plan does not by itself establish those structures or an independent lineage.",
    "caveatLabel": "An unresolved form is not a new lineage",
    "references": [
      "https://science.nasa.gov/astrobiology/researchers/life-detection-resources/ladder-of-life-detection/"
    ]
  },
  "reported_biological_interaction": {
    "id": "reported_biological_interaction",
    "code": "OC-B06",
    "label": "Reported Biological Interaction",
    "description": "An attributed account or documented observation of apparent contact, communication or directed action involving a person, animal or other organism during an investigated event. Retain the reported action separately from findings about an agent, intent or cause.",
    "scientificBasis": "Testimony can establish what a source reported. Recordings, physical traces and clinical or veterinary findings can address specific parts of that account through their own methods. Similarity between reports or temporal association alone does not establish a shared agent or mechanism.",
    "detectionSignals": [
      "A source describes apparent contact, communication, restraint or directed behavior.",
      "A recording documents a specified interaction for later interpretation.",
      "An examination records a physical finding alleged to be related to an interaction, with the attribution preserved."
    ],
    "methods": [
      "Retain original wording, interview context, chronology and account revisions, including how the account was elicited.",
      "Link independently collected recordings or physical findings to precise source passages without treating all parts of the account as corroborated.",
      "Evaluate physical traces with appropriate forensic, clinical or veterinary methods and record alternative explanations; keep any agency assessment separate."
    ],
    "caveat": "This category includes testimony whose external circumstances are unresolved. It does not confirm an abduction, communication, intervention, intelligence or intent. A medical or psychological assessment is not a truth detector; an unexplained injury or animal tissue change does not by itself identify a responsible agent.",
    "caveatLabel": "Reported interaction; agency not established",
    "references": [
      "https://www.cdc.gov/field-epi-manual/php/chapters/analyze-interpret-data.html"
    ]
  }
};

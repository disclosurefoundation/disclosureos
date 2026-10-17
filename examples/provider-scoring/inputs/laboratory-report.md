# Meridian laboratory report · M-014 series

Fictional report, 16 August 2026. Method `meridian-extractable-metals`, version 2. No laboratory work occurred. Every value, threshold, specimen and review in this report is authored for the example.

<a id="results"></a>
## Results and exact specimens

The analytical portion M-014-A1, the nearby field control M-014-C and the liquid blank M-014-BLK have distinct result identities. The parent, the retained portion B and the retained remainder of A have no direct analytical results. A viewer may navigate between these relatives, but must not copy a result to an untested material.

| Specimen | Quantity | Result | Interpretation |
| --- | --- | --- | --- |
| M-014-A1 | Extractable copper | 1.25 ± 0.08 mg/kg | Declared standard uncertainty; as received |
| M-014-A1 | Extractable lead | Below 0.10 mg/kg | detection limit, not zero |
| M-014-A1 | Appearance | Gray-brown granular soil with scattered pale mineral grains. | Qualitative description |
| M-014-C | Extractable copper | 1.18 ± 0.09 mg/kg | Declared standard uncertainty; as received |
| M-014-BLK | Copper in liquid blank | Below 0.02 mg/L | detection limit, not zero |

The copper values for the two soil specimens use an as-received mass basis. The analytical portion's assigned copper value is an arithmetic mean of the three values in [laboratory-replicates.csv](laboratory-replicates.csv). The report also supplies a qualitative appearance description. It does not infer composition from that description or from an illustration of the sample.

## Uncertainty and analytical thresholds

The reported ± values are declared standard uncertainties for the synthetic result examples. They are not expanded uncertainties and have no silently assumed coverage probability. The three repeated values reproduce a mean but do not, by themselves, establish the uncertainty budget. The final instrument/analysis implementation must retain this distinction in both the numerical record and the UI explanation.

Lead in A1 is below the declared detection limit. No numerical lead concentration was assigned, and the result must not be plotted at zero or halfway to the threshold. A threshold can be shown as a bound with its stated basis. Copper's quantification threshold is a separate declaration. Neither threshold is interchangeable with a measurement uncertainty.

The blank is reported in mg/L, while the soil uses mg/kg. Its below-limit result is useful within the declared workflow, but does not establish the absence of contamination under every preparation condition. No undocumented density, extraction volume, recovery factor or mass conversion is applied. The controls are informative because their roles and limitations are visible, not because the word “blank” proves the method was adequate.

## Comparison and interpretation

The assigned copper values differ by 0.07 mg/kg. The sourcebook reports that arithmetic difference without asserting statistical significance, uncertainty independence or an unusual composition. One control specimen does not characterize spatial variation across the basin. The record contains no independent reference material, certified recovery study or real laboratory accreditation.

The collection is associated with Meridian 014 for documentation. The report supplies no mechanism connecting the surface mark or soil to the recorded light. The material review should state this boundary alongside the measured-quantity examples. A specimen can have a rich collection and analytical record without supporting an extraordinary origin claim.

## Images and method artifacts

The specimen and microscopy-style images are specified as synthetic illustrations. The latter may illustrate grain boundaries or preparation concepts, but it cannot supply quantitative composition. A future spectrum fixture will contain its own numerical bins and method metadata; annotated peak identities will be attributed interpretations. Neither an attractive image nor an arbitrary peak curve may substitute for the source of a result in this table.

The [preparation protocol](preparation-protocol.md), [collection sheet](collection-sheet.md), [handling log](handling-log.md) and [material inventory](materials.csv) provide the history needed to read this report. They are separate sources with their own identities and later canonical mappings.

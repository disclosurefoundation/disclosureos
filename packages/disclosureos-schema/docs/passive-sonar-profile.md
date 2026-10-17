# Single-hydrophone pressure and spectral-density profile

This optional experimental profile binds one retained pressure channel to an acquisition and to a reproducible spectral-density product. It is additive to Observation, AcquisitionContext and ProductSourceSelection. It is a source candidate in the current V2 PR, not an npm release. Existing active-sonar and radar declarations remain unchanged.

## Public contract

The `@disclosureos/schema/experimental/v2` entry exports `PassiveSonarProfileSchema`, `passiveSonarProfileJsonSchema`, `evaluatePassiveSonarProfile`, `readPassiveSonarProducts`, `computePassiveSonarSpectrum`, `passiveSonarDimensions`, `passiveSonarSample`, `passiveSonarBin`, `readPassiveSonarSample`, `readPassiveSonarBin` and `passiveSonarDensityDb`. The portable schema is exported at `/experimental/v2/passive-sonar-profile/schema/0.1.0`.

A profile selects an observation, acquisition context, source selection, pinned pressure channel, two original acquisition artifacts, one processing activity and four source products. `dataOrigin` distinguishes synthetic examples from instrument captures; it is not a certification of physical calibration.

| Product | Layout | Quantity | Unit |
| --- | --- | --- | --- |
| `pressure` | float32, sample time | `sound_pressure` | `Pa` |
| `sampleMask` | uint8, identical sample time | `sample_availability` | `1` |
| `powerSpectralDensity` | float32, window-start time then frequency | `sound_pressure_power_spectral_density` | `Pa^2/Hz` |
| `frameMask` | uint8, identical window-start time | `window_availability` | `1` |

All are little-endian, row-major arrays with no byte offset. The original pressure and its retention mask bind to distinct raw products of the selected acquisition. The density and frame mask are derived outputs of one processing activity whose exact inputs are those two original products. The processing method and method version must agree.

`sampling` declares an integer sample rate and sample count. `transform` declares a power-of-two window size and a hop between one sample and one window. The reader bounds allocation and total FFT work. Full windows only are allowed; leftover samples remain retained pressure but produce no padded trailing window. The window count is floor((samples−N)/hop)+1 and frequency-bin count is N/2+1.

## Numerical meaning

For each fully retained window x of length N:

1. Subtract the arithmetic mean of all N pressure samples.
2. Apply the periodic Hann window w[n]=0.5−0.5cos(2πn/N), n=0…N−1.
3. Compute the N-point DFT without zero padding.
4. Divide squared magnitude by sampleRate×sum(w²).
5. Double interior bins only. Neither DC nor Nyquist is doubled.
6. Store float32 linear density in Pa²/Hz.

This is a sequence of windowed periodograms, not a Welch average. It follows the documented density scaling of [SciPy's periodogram](https://docs.scipy.org/doc/scipy/reference/generated/scipy.signal.periodogram.html). No processing produces a bearing, range, track or source identity.

The fixed display reference is 10⁻¹² Pa²/Hz, equivalent to 1 µPa²/Hz. The helper returns 10log10(density/reference). A legitimate retained zero density returns negative infinity; unavailable data returns null from the selected-bin reader. Viewers may clip a color scale but must not rewrite numerical source values or label spectral density as broadband sound-pressure level.

## Missing data and exact source selection

Mask 1 means retained; mask 0 means unavailable. Missing pressure values and density cells use zero **storage placeholders**, which must not be shown as measured silence. Any missing input sample makes the entire derived window unavailable, including an omitted sample at a Hann endpoint whose numerical window weight is zero. The profile permits no interpolation, zero filling or bridging of gaps.

Sample i occurs at origin+i/fs. Spectral frame f starts at sample f×hop. Its bin k is at k×fs/N Hz. Source layout axes must encode those same values exactly, with rational time steps. `passiveSonarBin` exposes the full contributing pressure and mask byte ranges as well as the selected output-cell offset. `readProductSourceSelection` can inspect each contributing input sample through the existing source contract.

The helper's `centerOffsetSeconds` uses start+N/(2fs), the conventional full-window center. `lastSampleOffsetSeconds` is start+(N−1)/fs and `endOffsetSeconds` is the exclusive support boundary. The acquisition and observation intervals must contain every actual sample timestamp; they are not required to extend to the exclusive support boundary. The evaluator compares rational offsets without truncating fractional UTC timestamps.

Bin spacing, hop duration and nominal sample spacing are not claims about hydrophone response, physical timing uncertainty or resolving power.

## Verification boundaries

The evaluator checks structural contracts, exact document and channel binding, raw/derived lineage, acquisition and observation time coverage, SHA-256 and extents of all four products, axis semantics, finite values, binary masks, missing-window semantics and numerical PSD reproduction against retained pressure. PSD agreement allows relative error 1e−5 or absolute error 1e−25 Pa²/Hz, whichever is larger, to accommodate float32 storage and cross-platform numerical rounding. This tolerance is not a physical uncertainty bound.

The dependency-free reader checks layouts and content and reproduces the PSD. It does **not** verify hashes or document lineage; applications must authenticate bytes separately or use the evaluator. A passed result reports `scientific`, `physicalCalibration` and `localization` as `not_checked`. Real instrument captures need their actual acquisition, calibration and method documentation.

The [reproducible example](../../../examples/sonar-passive/README.md) provides an eight-second synthetic pressure capture, its spectra, masks, metadata, executable generator and independent direct-DFT/Parseval tests. A single-channel pressure display is not an array-processing demonstration. NOAA describes [passive sonar](https://oceanexplorer.noaa.gov/technology/sonar/) and [hydrophone sensing](https://oceanservice.noaa.gov/facts/hydrophone.html); capabilities of larger arrays are outside this profile.

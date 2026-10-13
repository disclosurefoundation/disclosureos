# Passive sonar pressure example

A single fictional hydrophone channel contains eight seconds of authored pressure in pascals. A periodic-Hann, one-sided power spectral density (PSD) is reproduced from the retained float32 pressure bytes. This is DisclosureOS example-case material, not partner data or a calibrated field recording.

Run `node examples/sonar-passive/build.mjs` and `node examples/sonar-passive/verify.mjs` after building the schema package.

`pressure.f32` holds 32,768 little-endian float32 samples at 4,096 Hz. `sample-mask.u8` marks retained samples 1 and missing samples 0. Missing values contain a zero storage placeholder, never a measured zero. The authored signal combines a 224 Hz tone, its 448 Hz harmonic, a 480–1,120 Hz chirp, a brief 1,450 Hz transient and deterministic broadband-like background. These are numerical components, not detections or source identities. Two pressure intervals are omitted with no inferred cause.

`power-spectral-density.f32` contains 253 windows by 257 frequency bins, in row-major little-endian float32 format. Each 512-sample window advances 128 samples. For each complete window, subtract its arithmetic mean, apply w[n]=0.5−0.5cos(2πn/512), compute the unpadded DFT, and divide squared magnitude by sampleRate×sum(w²). Double only interior bins; DC and Nyquist are not doubled. Store float32 Pa²/Hz. Every window containing a missing input sample is unavailable, even when that input has zero Hann weight. `frame-mask.u8` records this validity; unavailable density cells are zero placeholders. No interpolation bridges missing samples.

Frame timestamps mark the first input sample. Source selection exposes all 512 contributing samples and their exact byte ranges. Frame center is start+N/(2fs), the usual full-window center; the final contributing timestamp is start+(N−1)/fs. The final recording sample is 7.999755859375 s, while nominal duration is 8 s. 8 Hz bin spacing and 31.25 ms window spacing do not establish physical frequency or time resolution.

Display density as 10log10(PSD/10⁻¹²) dB re 1 µPa²/Hz. A legitimate zero density is negative infinity, separate from unavailable data. Display clipping is a viewer choice and must not replace source values. These spectral-density values are not broadband sound-pressure level. No bearing, range, beamforming, source identity, hydrophone response, measured calibration or propagation model is supplied. The optional profile verifies mathematical reproduction and provenance, not physical validity.

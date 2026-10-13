/** A deterministic normalized envelope example, not acoustic propagation or a carrier waveform. */
export const config = Object.freeze({
  pings: 64,
  delayBins: 256,
  delayStartSeconds: 0,
  delayStepSeconds: 0.001,
  pingStepSeconds: 1,
  timeOrigin: "2026-07-28T22:10:00Z",
  soundSpeedMps: 1500,
});
const gaussian = (x, width) => Math.exp(-0.5 * (x / width) ** 2);
export function retained(ping, bin) {
  if (
    !Number.isInteger(ping) ||
    ping < 0 ||
    ping >= config.pings ||
    !Number.isInteger(bin) ||
    bin < 0 ||
    bin >= config.delayBins
  )
    throw new Error("Invalid sonar cell.");
  return (
    !(ping >= 28 && ping <= 30) &&
    !(ping >= 44 && ping <= 49 && bin >= 120 && bin <= 151)
  );
}
export function envelope(ping, bin) {
  retained(ping, bin); // Validate indices before evaluating an authored component.
  const first =
    0.46 *
    (0.85 + 0.15 * Math.cos(0.15 * ping)) *
    gaussian(bin - (42 + 1.6 * ping), 3.5);
  const second =
    0.34 *
    (0.85 + 0.15 * Math.sin(0.22 * ping)) *
    gaussian(bin - (189 - 1.25 * ping), 5);
  const transient = 0.28 * gaussian(ping - 15, 1.7) * gaussian(bin - 222, 3);
  const background =
    0.018 +
    0.007 * Math.sin(1.3 * bin + 0.33 * ping) +
    0.005 * Math.cos(0.18 * bin - 0.4 * ping);
  return Math.fround(
    Math.max(0, Math.min(1, first + second + transient + background))
  );
}
export function simulate() {
  const amplitudes = [],
    receiveMask = [];
  for (let ping = 0; ping < config.pings; ping++)
    for (let bin = 0; bin < config.delayBins; bin++) {
      const available = retained(ping, bin);
      receiveMask.push(available ? 1 : 0);
      amplitudes.push(available ? envelope(ping, bin) : 0);
    }
  return { amplitudes, receiveMask };
}

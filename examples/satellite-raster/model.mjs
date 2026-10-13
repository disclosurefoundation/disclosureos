/** Deterministic fictional reflectance grid. It is not a radiative-transfer or orbital model. */
export const config = {
  rows: 72,
  columns: 96,
  crs: {
    kind: "wgs84_utm",
    epsg: "EPSG:32611",
    zone: 11,
    hemisphere: "north",
    unit: "m",
  },
  transform: [500000, 30, 0, 4102160, 0, -30],
  bands: [
    ["blue", "Blue", 482],
    ["green", "Green", 561],
    ["red", "Red", 655],
    ["nir", "Near infrared", 865],
    ["swir1", "Shortwave infrared 1", 1610],
    ["swir2", "Shortwave infrared 2", 2200],
  ].map(([id, label, centerWavelengthNm]) => ({
    id,
    label,
    centerWavelengthNm,
    wavelengthMeaning: "nominal_center_not_response_function",
    scale: 0.0001,
    offset: 0,
    nodata: 65535,
    validRange: [0, 1],
  })),
  defaultPixel: 50 * 96 + 45,
};
export function simulate() {
  const dn = new Uint16Array(
      config.rows * config.columns * config.bands.length
    ),
    quality = new Uint8Array(config.rows * config.columns),
    classes = [];
  const spectra = {
    water: [0.06, 0.085, 0.035, 0.018, 0.008, 0.006],
    vegetation: [0.045, 0.1, 0.05, 0.49, 0.23, 0.12],
    soil: [0.14, 0.19, 0.25, 0.31, 0.37, 0.32],
    developed: [0.21, 0.23, 0.26, 0.28, 0.33, 0.31],
    road: [0.09, 0.095, 0.1, 0.11, 0.13, 0.12],
    cloud: [0.78, 0.81, 0.8, 0.76, 0.61, 0.44],
  };
  for (let row = 0; row < config.rows; row++)
    for (let col = 0; col < config.columns; col++) {
      const index = row * config.columns + col;
      const river = col - (24 + 9 * Math.sin(row / 17));
      const land =
        Math.abs(river) < 5 ||
        ((col - 20) / 14) ** 2 + ((row - 49) / 12) ** 2 < 1
          ? "water"
          : Math.abs(col - (72 - row * 0.32)) < 1.5
          ? "road"
          : col > 61 && row > 13 && row < 40
          ? "developed"
          : col < 60 && row > 30
          ? "vegetation"
          : "soil";
      let code =
        ((col - 70) / 13) ** 2 + ((row - 51) / 10) ** 2 < 1
          ? 1
          : ((col - 59) / 13) ** 2 + ((row - 43) / 10) ** 2 < 1
          ? 2
          : 0;
      if (col > 90 || (row < 3 && col > 40 && col < 53)) code = 3;
      quality[index] = code;
      classes.push(land);
      for (let b = 0; b < config.bands.length; b++) {
        const texture =
          1 +
          0.065 * Math.sin(col * 0.53 + row * 0.27) +
          0.025 * Math.cos(row * 0.81 - col * 0.13 + b * 0.17);
        const base = code === 1 ? spectra.cloud[b] : spectra[land][b];
        const value = Math.min(
          1,
          Math.max(0, base * texture * (code === 2 ? 0.22 : 1))
        );
        dn[b * config.rows * config.columns + index] =
          code === 3 ? 65535 : Math.round(value * 10000);
      }
    }
  // Two deliberately retained edge cases: valid zero signal and one missing band.
  for (let b = 0; b < config.bands.length; b++)
    dn[b * config.rows * config.columns + 6 * 96 + 6] = 0;
  dn[3 * config.rows * config.columns + 6 * 96 + 7] = 65535;
  return { dn, quality, classes };
}

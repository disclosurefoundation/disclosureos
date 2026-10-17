import {
  readProductSourceSelection,
  type ProductSourceLayout,
} from "./product-source-reader";
export interface SatelliteRasterBand {
  id: string;
  label: string;
  centerWavelengthNm: number;
  wavelengthMeaning: "nominal_center_not_response_function";
  scale: number;
  offset: number;
  nodata: number;
  validRange: [number, number];
}
export interface SatelliteRasterDeclaration {
  mode: "north_up_multispectral_reflectance";
  grid: {
    rows: number;
    columns: number;
    crs: {
      kind: "wgs84_utm";
      epsg: string;
      zone: number;
      hemisphere: "north" | "south";
      unit: "m";
    };
    transform: [number, number, 0, number, 0, number];
    pixelInterpretation: "area";
    registration: "authored_grid_not_surveyed" | "source_declared_not_verified";
  };
  bands: SatelliteRasterBand[];
  radiometry: {
    quantity: "surface_reflectance";
    unit: "1";
    formula: "dn_times_scale_plus_offset";
    calibration: "not_verified";
  };
  quality: {
    authority: "authored_annotations" | "source_annotations";
    method: string;
    codes: { clear: 0; cloud: 1; shadow: 2; nodata: 3 };
    scope: "whole_pixel";
    interpretation: "source_annotation_not_accuracy_certification";
  };
  vegetationIndex: {
    redBandId: string;
    nearInfraredBandId: string;
    method: "scaled_nir_minus_red_over_sum";
    qualityPolicy: "clear_nonnegative_nonzero_sum_only";
    interpretation: "spectral_index_not_land_cover_classification";
  };
  products: { reflectance: string; quality: string };
}
export type SatelliteRasterQuality = "clear" | "cloud" | "shadow" | "nodata";
export interface SatelliteRasterCell {
  index: number;
  row: number;
  column: number;
  easting: number;
  northing: number;
  qualityCode: number;
  quality: SatelliteRasterQuality;
  dn: number[];
  reflectance: (number | null)[];
  byteOffsets: number[];
  qualityByteOffset: number;
  ndvi: number | null;
  ndviReason:
    | "valid"
    | "quality_excluded"
    | "nodata"
    | "zero_denominator"
    | "negative_reflectance";
}
export interface SatelliteRasterDecodedProducts {
  cells: SatelliteRasterCell[];
}
const integer = (v: number, min: number, max: number) =>
  Number.isSafeInteger(v) && v >= min && v <= max;
const bounded = (v: number, min: number, max: number) =>
  Number.isFinite(v) && v >= min && v <= max;
export function validateSatelliteRasterDeclaration(
  p: SatelliteRasterDeclaration
): void {
  const g = p.grid,
    b = p.bands,
    q = p.quality,
    r = p.radiometry,
    n = p.vegetationIndex;
  if (
    p.mode !== "north_up_multispectral_reflectance" ||
    !integer(g.rows, 1, 4096) ||
    !integer(g.columns, 1, 4096) ||
    g.rows * g.columns > 262144 ||
    g.crs.kind !== "wgs84_utm" ||
    !integer(g.crs.zone, 1, 60) ||
    !["north", "south"].includes(g.crs.hemisphere) ||
    g.crs.unit !== "m" ||
    g.crs.epsg !==
      `EPSG:${(g.crs.hemisphere === "north" ? 32600 : 32700) + g.crs.zone}` ||
    g.transform.length !== 6 ||
    !g.transform.every((v) => bounded(v, -1e9, 1e9)) ||
    g.transform[1] <= 0 ||
    g.transform[1] > 1e5 ||
    g.transform[5] >= 0 ||
    g.transform[5] < -1e5 ||
    g.transform[2] !== 0 ||
    g.transform[4] !== 0 ||
    g.pixelInterpretation !== "area" ||
    !["authored_grid_not_surveyed", "source_declared_not_verified"].includes(
      g.registration
    ) ||
    b.length < 2 ||
    b.length > 16 ||
    new Set(b.map((v) => v.id)).size !== b.length ||
    b.some(
      (v) =>
        !v.id.trim() ||
        !v.label.trim() ||
        !bounded(v.centerWavelengthNm, Number.MIN_VALUE, 1e6) ||
        v.wavelengthMeaning !== "nominal_center_not_response_function" ||
        !bounded(v.scale, Number.MIN_VALUE, 100) ||
        !bounded(v.offset, -100, 100) ||
        !integer(v.nodata, 0, 65535) ||
        v.validRange.length !== 2 ||
        !v.validRange.every((x) => bounded(x, -100, 100)) ||
        v.validRange[0] >= v.validRange[1]
    ) ||
    r.quantity !== "surface_reflectance" ||
    r.unit !== "1" ||
    r.formula !== "dn_times_scale_plus_offset" ||
    r.calibration !== "not_verified" ||
    !["authored_annotations", "source_annotations"].includes(q.authority) ||
    !q.method.trim() ||
    q.codes.clear !== 0 ||
    q.codes.cloud !== 1 ||
    q.codes.shadow !== 2 ||
    q.codes.nodata !== 3 ||
    q.scope !== "whole_pixel" ||
    q.interpretation !== "source_annotation_not_accuracy_certification" ||
    n.method !== "scaled_nir_minus_red_over_sum" ||
    n.qualityPolicy !== "clear_nonnegative_nonzero_sum_only" ||
    n.interpretation !== "spectral_index_not_land_cover_classification" ||
    n.redBandId === n.nearInfraredBandId ||
    !b.some((v) => v.id === n.redBandId) ||
    !b.some((v) => v.id === n.nearInfraredBandId) ||
    p.products.reflectance === p.products.quality
  )
    throw new Error("Invalid satellite raster declaration.");
  const red = b.find((v) => v.id === n.redBandId)!,
    nir = b.find((v) => v.id === n.nearInfraredBandId)!;
  if (
    red.centerWavelengthNm < 600 ||
    red.centerWavelengthNm > 750 ||
    nir.centerWavelengthNm < 750 ||
    nir.centerWavelengthNm > 1400 ||
    red.centerWavelengthNm >= nir.centerWavelengthNm
  )
    throw new Error(
      "NDVI bands must identify red and near-infrared wavelengths."
    );
}
/** Projected cell footprint; these are grid coordinates, not a surveyed accuracy claim. */
export function satelliteCellBounds(
  p: SatelliteRasterDeclaration,
  row: number,
  column: number
): { west: number; east: number; south: number; north: number } {
  if (
    !integer(row, 0, p.grid.rows - 1) ||
    !integer(column, 0, p.grid.columns - 1)
  )
    throw new Error("Satellite pixel is outside the grid.");
  const [x, w, , y, , h] = p.grid.transform;
  return {
    west: x + column * w,
    east: x + (column + 1) * w,
    north: y + row * h,
    south: y + (row + 1) * h,
  };
}
function array(
  p: SatelliteRasterDeclaration,
  layouts: readonly ProductSourceLayout[],
  assets: ReadonlyMap<string, Uint8Array>,
  role: "reflectance" | "quality"
) {
  const matches = layouts.filter((v) => v.productRef === p.products[role]),
    layout = matches[0],
    bytes = assets.get(p.products[role]);
  const cube = role === "reflectance",
    lengths = cube
      ? [p.bands.length, p.grid.rows, p.grid.columns]
      : [p.grid.rows, p.grid.columns],
    names = cube ? ["band", "row", "column"] : ["row", "column"];
  if (
    matches.length !== 1 ||
    !layout ||
    layout.kind !== "binary_array" ||
    layout.elementType !== (cube ? "uint16" : "uint8") ||
    layout.byteOrder !== "little" ||
    layout.order !== "row_major" ||
    layout.byteOffset !== 0 ||
    layout.mediaType !== "application/octet-stream" ||
    layout.quantity !==
      (cube ? "surface_reflectance_dn" : "pixel_quality_code") ||
    layout.unit !== (cube ? "DN" : "code") ||
    layout.axes.length !== lengths.length ||
    layout.axes.some(
      (a, i) =>
        a.kind !== "index" ||
        a.name !== names[i] ||
        a.length !== lengths[i] ||
        a.firstIndex !== 0
    ) ||
    layout.byteLength !== lengths.reduce((a, b) => a * b, 1) * (cube ? 2 : 1) ||
    !bytes ||
    bytes.byteLength !== layout.byteLength
  )
    throw new Error(`Invalid or absent satellite ${role} array.`);
  return { layout, bytes };
}
/** Parses all retained pixels. Source integrity and document bindings belong to the evaluator. */
export function readSatelliteRasterProducts(
  p: SatelliteRasterDeclaration,
  layouts: readonly ProductSourceLayout[],
  assets: ReadonlyMap<string, Uint8Array>
): SatelliteRasterDecodedProducts {
  validateSatelliteRasterDeclaration(p);
  const cube = array(p, layouts, assets, "reflectance"),
    quality = array(p, layouts, assets, "quality"),
    cells: SatelliteRasterCell[] = [],
    names: SatelliteRasterQuality[] = ["clear", "cloud", "shadow", "nodata"];
  const red = p.bands.findIndex((v) => v.id === p.vegetationIndex.redBandId),
    nir = p.bands.findIndex(
      (v) => v.id === p.vegetationIndex.nearInfraredBandId
    );
  for (let row = 0; row < p.grid.rows; row++)
    for (let column = 0; column < p.grid.columns; column++) {
      const q = readProductSourceSelection(
          quality.layout,
          { kind: "array_element", indices: [row, column] },
          quality.bytes
        ),
        code = q.value!;
      if (!integer(code, 0, 3))
        throw new Error("Unknown satellite quality code.");
      const dn: number[] = [],
        reflectance: (number | null)[] = [],
        byteOffsets: number[] = [];
      for (let band = 0; band < p.bands.length; band++) {
        const b = p.bands[band]!,
          s = readProductSourceSelection(
            cube.layout,
            { kind: "array_element", indices: [band, row, column] },
            cube.bytes
          ),
          raw = s.value!,
          value = raw === b.nodata ? null : raw * b.scale + b.offset;
        if (
          value !== null &&
          (!Number.isFinite(value) ||
            value < b.validRange[0] - 1e-12 ||
            value > b.validRange[1] + 1e-12)
        )
          throw new Error(
            "Satellite reflectance exceeds its declared decoded range."
          );
        dn.push(raw);
        reflectance.push(value);
        byteOffsets.push(s.byteOffset!);
      }
      // Whole-pixel missingness and band missingness are independent: clear pixels may lack a band.
      if (code === 3 && reflectance.some((v) => v !== null))
        throw new Error(
          "No-data quality must use every band's declared no-data code."
        );
      const r = reflectance[red] ?? null,
        n = reflectance[nir] ?? null;
      let ndvi: number | null = null,
        ndviReason: SatelliteRasterCell["ndviReason"];
      if (r === null || n === null) ndviReason = "nodata";
      else if (code !== 0) ndviReason = "quality_excluded";
      else if (r < 0 || n < 0) ndviReason = "negative_reflectance";
      else if (r + n === 0) ndviReason = "zero_denominator";
      else {
        ndvi = (n - r) / (n + r);
        ndviReason = "valid";
      }
      const bounds = satelliteCellBounds(p, row, column);
      cells.push({
        index: row * p.grid.columns + column,
        row,
        column,
        easting: (bounds.west + bounds.east) / 2,
        northing: (bounds.north + bounds.south) / 2,
        qualityCode: code,
        quality: names[code]!,
        dn,
        reflectance,
        byteOffsets,
        qualityByteOffset: q.byteOffset!,
        ndvi,
        ndviReason,
      });
    }
  return { cells };
}

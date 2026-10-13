import {
  readSourceCsv,
  type ProductSourceLayout,
} from "./product-source-reader";
export interface LidarDeclaration {
  mode: "static_discrete_return_raster";
  coordinateFrame: {
    kind: "local_cartesian";
    axes: ["east", "north", "up"];
    unit: "m";
    handedness: "right_handed";
    originDescription: string;
    sensorOrigin: [number, number, number];
    georeferencing: "not_provided";
  };
  scan: {
    rows: number;
    columns: number;
    pulses: number;
    points: number;
    order: "row_major_index_not_time";
    aim: "direction_reference_not_surface_hit";
  };
  geometry: {
    nearRangeM: number;
    farRangeM: number;
    rayToleranceM: number;
    toleranceMeaning: "encoding_consistency_not_measurement_uncertainty";
    bounds: { min: [number, number, number]; max: [number, number, number] };
  };
  intensity: {
    kind: "normalized_return_amplitude";
    min: 0;
    max: 1;
    calibration: "not_calibrated_to_reflectance";
  };
  classifications: {
    authority: "authored_annotations" | "source_annotations";
    method: string;
    classes: { code: number; label: string }[];
  };
  availability: {
    retained: "complete_return_group";
    noReturn: "zero_detected_returns_not_clear_space";
    unavailable: "unknown_return_count_empty_cell";
    noTiming: "no_per_pulse_timestamps";
  };
  products: { pulses: string; points: string };
}
export interface LidarSourceRow {
  byteOffset: number;
  byteLength: number;
}
export interface LidarPulse {
  index: number;
  id: string;
  scanRow: number;
  scanColumn: number;
  aim: [number, number, number];
  status: "retained" | "no_return" | "unavailable";
  returnCount: number | null;
  pointIndices: number[];
  row: LidarSourceRow;
}
export interface LidarPoint {
  index: number;
  pulseIndex: number;
  pulseId: string;
  returnNumber: number;
  returnCount: number;
  x: number;
  y: number;
  z: number;
  intensity: number;
  classCode: number;
  rangeM: number;
  row: LidarSourceRow;
}
export interface LidarDecodedProducts {
  pulses: LidarPulse[];
  points: LidarPoint[];
}
export const LIDAR_PULSE_COLUMNS = [
  "pulse_id",
  "scan_row",
  "scan_column",
  "aim_x_m",
  "aim_y_m",
  "aim_z_m",
  "status",
  "return_count",
] as const;
export const LIDAR_POINT_COLUMNS = [
  "pulse_id",
  "return_number",
  "return_count",
  "x_m",
  "y_m",
  "z_m",
  "intensity",
  "class_code",
] as const;
const integer = (v: number, min: number, max: number) =>
  Number.isSafeInteger(v) && v >= min && v <= max;
const finite = (v: number) => Number.isFinite(v) && Math.abs(v) <= 1e7;
export function validateLidarDeclaration(p: LidarDeclaration): void {
  const s = p.scan,
    g = p.geometry,
    f = p.coordinateFrame,
    c = p.classifications;
  if (
    p.mode !== "static_discrete_return_raster" ||
    f.kind !== "local_cartesian" ||
    f.unit !== "m" ||
    f.handedness !== "right_handed" ||
    f.georeferencing !== "not_provided" ||
    f.axes.join(",") !== "east,north,up" ||
    !f.originDescription.trim() ||
    f.sensorOrigin.length !== 3 ||
    !f.sensorOrigin.every(finite) ||
    !integer(s.rows, 1, 4096) ||
    !integer(s.columns, 1, 4096) ||
    !integer(s.pulses, 1, 65536) ||
    s.rows * s.columns !== s.pulses ||
    !integer(s.points, 0, 983040) ||
    s.points > s.pulses * 15 ||
    s.order !== "row_major_index_not_time" ||
    s.aim !== "direction_reference_not_surface_hit" ||
    !finite(g.nearRangeM) ||
    !finite(g.farRangeM) ||
    g.nearRangeM <= 0 ||
    g.farRangeM <= g.nearRangeM ||
    !Number.isFinite(g.rayToleranceM) ||
    g.rayToleranceM <= 0 ||
    g.rayToleranceM > 0.1 ||
    g.toleranceMeaning !== "encoding_consistency_not_measurement_uncertainty" ||
    g.bounds.min.length !== 3 ||
    g.bounds.max.length !== 3 ||
    !g.bounds.min.every(finite) ||
    !g.bounds.max.every(finite) ||
    g.bounds.min.some((v, i) => v >= g.bounds.max[i]!) ||
    p.intensity.kind !== "normalized_return_amplitude" ||
    p.intensity.min !== 0 ||
    p.intensity.max !== 1 ||
    p.intensity.calibration !== "not_calibrated_to_reflectance" ||
    !["authored_annotations", "source_annotations"].includes(c.authority) ||
    !c.method.trim() ||
    !c.classes.length ||
    c.classes.length > 256 ||
    new Set(c.classes.map((v) => v.code)).size !== c.classes.length ||
    c.classes.some((v) => !integer(v.code, 0, 255) || !v.label.trim()) ||
    p.availability.retained !== "complete_return_group" ||
    p.availability.noReturn !== "zero_detected_returns_not_clear_space" ||
    p.availability.unavailable !== "unknown_return_count_empty_cell" ||
    p.availability.noTiming !== "no_per_pulse_timestamps" ||
    new Set(Object.values(p.products)).size !== 2
  )
    throw new Error("Invalid static lidar declaration.");
}
// Offsets include CSV quoting but exclude the row terminator. ReadSourceCsv validates syntax.
function rowSpans(bytes: Uint8Array): LidarSourceRow[] {
  const spans: LidarSourceRow[] = [];
  let start = 0,
    quoted = false;
  for (let i = 0; i < bytes.length; i++) {
    if (bytes[i] === 34) {
      if (quoted && bytes[i + 1] === 34) i++;
      else quoted = !quoted;
    } else if (!quoted && (bytes[i] === 10 || bytes[i] === 13)) {
      spans.push({ byteOffset: start, byteLength: i - start });
      if (bytes[i] === 13 && bytes[i + 1] === 10) i++;
      start = i + 1;
    }
  }
  if (start < bytes.length)
    spans.push({ byteOffset: start, byteLength: bytes.length - start });
  return spans.slice(1);
}
function table(
  layouts: readonly ProductSourceLayout[],
  assets: ReadonlyMap<string, Uint8Array>,
  ref: string,
  columns: readonly string[],
  count: number
) {
  const matches = layouts.filter((l) => l.productRef === ref);
  const layout = matches[0],
    bytes = assets.get(ref);
  if (
    matches.length !== 1 ||
    !layout ||
    layout.kind !== "csv_table" ||
    layout.mediaType !== "text/csv" ||
    layout.encoding !== "utf-8" ||
    layout.delimiter !== "," ||
    layout.header !== true ||
    layout.partition ||
    layout.sample ||
    layout.rowCount !== count ||
    layout.columns.join(",") !== columns.join(",") ||
    !bytes ||
    bytes.byteLength !== layout.byteLength
  )
    throw new Error(`Invalid or absent lidar table ${ref}.`);
  const rows = readSourceCsv(bytes),
    header = rows.shift();
  if (
    header?.join(",") !== columns.join(",") ||
    rows.length !== count ||
    rows.some((r) => r.length !== columns.length)
  )
    throw new Error(`Unexpected lidar table rows or header ${ref}.`);
  const spans = rowSpans(bytes);
  if (spans.length !== count)
    throw new Error("CSV source row offsets are inconsistent.");
  return { rows, spans };
}
const number = (text: string) => {
  if (!/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?(?![\s\S])/.test(text))
    throw new Error("Lidar numeric cell is empty or malformed.");
  const value = Number(text);
  if (!finite(value))
    throw new Error("Lidar numeric value is not finite or exceeds bounds.");
  return value;
};
/** Reads retained bytes, complete return groups and ray geometry. Hash and document linkage
 * checks belong to evaluateLidarProfile; classifications are never inferred here. */
export function readLidarProducts(
  p: LidarDeclaration,
  layouts: readonly ProductSourceLayout[],
  assets: ReadonlyMap<string, Uint8Array>
): LidarDecodedProducts {
  validateLidarDeclaration(p);
  const a = table(
      layouts,
      assets,
      p.products.pulses,
      LIDAR_PULSE_COLUMNS,
      p.scan.pulses
    ),
    b = table(
      layouts,
      assets,
      p.products.points,
      LIDAR_POINT_COLUMNS,
      p.scan.points
    );
  const pulseMap = new Map<string, number>(),
    origin = p.coordinateFrame.sensorOrigin;
  const inside = (v: number, i: number) =>
    v >= p.geometry.bounds.min[i]! && v <= p.geometry.bounds.max[i]!;
  const pulses: LidarPulse[] = a.rows.map((cells, index) => {
    const [id, row, column, x, y, z, status, count] = cells as [
      string,
      string,
      string,
      string,
      string,
      string,
      string,
      string
    ];
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]*(?![\s\S])/.test(id) || pulseMap.has(id))
      throw new Error("Duplicate or invalid pulse identifier.");
    const scanRow = number(row),
      scanColumn = number(column),
      aim: [number, number, number] = [number(x), number(y), number(z)];
    const returnCount = count === "" ? null : number(count);
    if (
      scanRow !== Math.floor(index / p.scan.columns) ||
      scanColumn !== index % p.scan.columns ||
      !aim.every(inside) ||
      Math.hypot(...aim.map((v, i) => v - origin[i]!)) < p.geometry.nearRangeM
    )
      throw new Error("Pulse grid or aim reference is inconsistent.");
    if (
      !["retained", "no_return", "unavailable"].includes(status) ||
      (status === "retained" &&
        (returnCount === null || !integer(returnCount, 1, 15))) ||
      (status === "no_return" && returnCount !== 0) ||
      (status === "unavailable" && returnCount !== null)
    )
      throw new Error("Pulse status and return count are inconsistent.");
    pulseMap.set(id, index);
    return {
      index,
      id,
      scanRow,
      scanColumn,
      aim,
      status: status as LidarPulse["status"],
      returnCount,
      pointIndices: [],
      row: a.spans[index]!,
    };
  });
  const classes = new Set(p.classifications.classes.map((c) => c.code));
  const points: LidarPoint[] = b.rows.map((cells, index) => {
    const [pulseId, n, count, xs, ys, zs, amplitude, classification] =
      cells as [string, string, string, string, string, string, string, string];
    const pulseIndex = pulseMap.get(pulseId),
      pulse = pulseIndex === undefined ? undefined : pulses[pulseIndex];
    if (pulseIndex === undefined || !pulse || pulse.status !== "retained")
      throw new Error("Point does not belong to a retained pulse.");
    const returnNumber = number(n),
      returnCount = number(count),
      x = number(xs),
      y = number(ys),
      z = number(zs),
      intensity = number(amplitude),
      classCode = number(classification);
    if (
      !integer(returnNumber, 1, 15) ||
      returnCount !== pulse.returnCount ||
      returnNumber !== pulse.pointIndices.length + 1 ||
      intensity < 0 ||
      intensity > 1 ||
      !classes.has(classCode) ||
      ![x, y, z].every(inside)
    )
      throw new Error(
        "Invalid lidar return group, class, intensity or coordinate."
      );
    const d = [x - origin[0], y - origin[1], z - origin[2]],
      direction = pulse.aim.map((v, i) => v - origin[i]!),
      norm = Math.hypot(...direction),
      rangeM = Math.hypot(...d),
      along = d.reduce((sum, v, i) => sum + (v * direction[i]!) / norm, 0),
      residual = Math.hypot(
        ...d.map((v, i) => v - (along * direction[i]!) / norm)
      );
    if (
      rangeM < p.geometry.nearRangeM ||
      rangeM > p.geometry.farRangeM ||
      along <= 0 ||
      residual > p.geometry.rayToleranceM
    )
      throw new Error("Point lies outside the declared range or pulse ray.");
    pulse.pointIndices.push(index);
    return {
      index,
      pulseIndex,
      pulseId,
      returnNumber,
      returnCount,
      x,
      y,
      z,
      intensity,
      classCode,
      rangeM,
      row: b.spans[index]!,
    };
  });
  for (const pulse of pulses) {
    if (pulse.pointIndices.length !== (pulse.returnCount ?? 0))
      throw new Error("Incomplete lidar return group.");
    for (let i = 1; i < pulse.pointIndices.length; i++)
      if (
        points[pulse.pointIndices[i]!]!.rangeM <=
        points[pulse.pointIndices[i - 1]!]!.rangeM
      )
        throw new Error("Lidar returns are not in increasing slant range.");
  }
  return { pulses, points };
}

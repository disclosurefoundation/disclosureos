import {
  readSourceCsv,
  type ProductSourceLayout,
} from "./product-source-reader";

export const RADAR_TABLE_COLUMNS = Object.freeze({
  scanSchedule: [
    "scan_index",
    "azimuth_index",
    "start_s",
    "end_s",
    "beam_azimuth_deg",
    "beam_width_deg",
  ],
  detections: [
    "detection_id",
    "scan_index",
    "azimuth_index",
    "range_index",
    "time_s",
    "east_m",
    "north_m",
    "power",
  ],
  tracks: [
    "track_id",
    "scan_index",
    "time_s",
    "state",
    "east_m",
    "north_m",
    "velocity_east_m_s",
    "velocity_north_m_s",
    "cov_ee_m2",
    "cov_en_m2",
    "cov_nn_m2",
  ],
  associations: ["track_id", "scan_index", "detection_id"],
  truth: ["target_id", "scan_index", "time_s", "east_m", "north_m"],
} as const);
export interface RadarDwell {
  scan_index: number;
  azimuth_index: number;
  start_s: number;
  end_s: number;
  beam_azimuth_deg: number;
  beam_width_deg: number;
}
export interface RadarDetection {
  detection_id: string;
  scan_index: number;
  azimuth_index: number;
  range_index: number;
  time_s: number;
  east_m: number;
  north_m: number;
  power: number;
}
export interface RadarTrack {
  track_id: string;
  scan_index: number;
  time_s: number;
  state: "tentative" | "confirmed" | "coasting";
  east_m: number;
  north_m: number;
  velocity_east_m_s: number;
  velocity_north_m_s: number;
  cov_ee_m2: number;
  cov_en_m2: number;
  cov_nn_m2: number;
}
export interface RadarAssociation {
  track_id: string;
  scan_index: number;
  detection_id: string;
}
export interface RadarTruth {
  target_id: string;
  scan_index: number;
  time_s: number;
  east_m: number;
  north_m: number;
}
export interface RadarDecodedProducts {
  scanSchedule: RadarDwell[];
  detections: RadarDetection[];
  tracks: RadarTrack[];
  associations: RadarAssociation[];
  truth: RadarTruth[];
  returns: number[];
  thresholds: number[];
}
export type RadarProductRoles = Record<
  | "scanSchedule"
  | "returns"
  | "thresholds"
  | "detections"
  | "tracks"
  | "associations",
  string
> & { truth?: string | undefined };

const finite = (cell: string): number => {
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(cell))
    throw new Error("Radar table contains a non-numeric cell.");
  const n = Number(cell);
  if (!Number.isFinite(n))
    throw new Error("Radar table contains a non-finite value.");
  return n;
};

/** Byte decoder only. Call the profile evaluator first or verify the same pinned bytes externally.
 * This function does not hash assets, certify calibration, validate associations or fit tracks. */
export function readRadarProducts(
  layouts: readonly ProductSourceLayout[],
  products: RadarProductRoles,
  assets: ReadonlyMap<string, Uint8Array>
): RadarDecodedProducts {
  const layoutMap = new Map(
    layouts.map((layout) => [layout.productRef, layout])
  );
  const table = (role: keyof typeof RADAR_TABLE_COLUMNS) => {
    const product = products[role];
    if (!product) return [];
    const layout = layoutMap.get(product),
      bytes = assets.get(product);
    if (
      !layout ||
      layout.kind !== "csv_table" ||
      !bytes ||
      bytes.byteLength !== layout.byteLength
    )
      throw new Error(`Missing or mismatched ${role} table.`);
    if (layout.partition || layout.sample)
      throw new Error(
        `Radar ${role} tables must declare the complete table without a partition or scalar sample mapping.`
      );
    const columns = RADAR_TABLE_COLUMNS[role],
      records = readSourceCsv(bytes),
      header = records.shift();
    if (
      JSON.stringify(header) !== JSON.stringify(columns) ||
      JSON.stringify(layout.columns) !== JSON.stringify(columns) ||
      records.length !== layout.rowCount
    )
      throw new Error(`Invalid ${role} columns or row count.`);
    return records.map((row) => {
      if (row.length !== columns.length)
        throw new Error(`Invalid ${role} row width.`);
      return Object.fromEntries(
        columns.map((column, i) => {
          const cell = row[i]!;
          if (column.endsWith("_id")) {
            if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(cell))
              throw new Error(`Invalid ${role} identifier.`);
            return [column, cell];
          }
          if (column === "state") {
            if (!["tentative", "confirmed", "coasting"].includes(cell))
              throw new Error("Invalid track state.");
            return [column, cell];
          }
          return [column, finite(cell)];
        })
      );
    });
  };
  const array = (role: "returns" | "thresholds") => {
    const layout = layoutMap.get(products[role]),
      bytes = assets.get(products[role]);
    if (
      !layout ||
      layout.kind !== "binary_array" ||
      layout.elementType !== "float32" ||
      layout.byteOrder !== "little" ||
      !bytes ||
      bytes.byteLength !== layout.byteLength ||
      layout.byteOffset < 0 ||
      !Number.isSafeInteger(layout.byteOffset)
    )
      throw new Error(`Invalid ${role} array.`);
    const count = layout.axes.reduce((n, axis) => n * axis.length, 1);
    if (
      !Number.isSafeInteger(count) ||
      layout.byteOffset + count * 4 !== bytes.byteLength
    )
      throw new Error(`Invalid ${role} extent.`);
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength),
      values: number[] = [];
    for (let i = 0; i < count; i++) {
      const n = view.getFloat32(layout.byteOffset + i * 4, true);
      if (!Number.isFinite(n)) throw new Error(`Non-finite ${role} sample.`);
      values.push(n);
    }
    return values;
  };
  return {
    scanSchedule: table("scanSchedule") as unknown as RadarDwell[],
    detections: table("detections") as unknown as RadarDetection[],
    tracks: table("tracks") as unknown as RadarTrack[],
    associations: table("associations") as unknown as RadarAssociation[],
    truth: table("truth") as unknown as RadarTruth[],
    returns: array("returns"),
    thresholds: array("thresholds"),
  };
}

/** 2-D Gaussian probability contour multiplier. This is not a calibrated error bound. */
export function radarCovarianceScaleSquared(probability: number): number {
  if (!Number.isFinite(probability) || probability <= 0 || probability >= 1)
    throw new Error("Probability must be strictly between zero and one.");
  return -2 * Math.log1p(-probability);
}

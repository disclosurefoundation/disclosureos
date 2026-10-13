import {
  readSourceCsv,
  type ProductSourceLayout,
} from "./product-source-reader";
export const STEERED_RADAR_TABLE_COLUMNS = Object.freeze({
  beamSchedule: [
    "dwell_index",
    "cycle_index",
    "start_s",
    "end_s",
    "beam_azimuth_deg",
    "beam_width_deg",
    "purpose",
  ],
  detections: [
    "detection_id",
    "dwell_index",
    "range_index",
    "time_s",
    "east_m",
    "north_m",
    "power",
  ],
  tracks: [
    "track_id",
    "dwell_index",
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
  associations: ["track_id", "dwell_index", "detection_id"],
  truth: ["target_id", "dwell_index", "time_s", "east_m", "north_m"],
} as const);
const replyColumns = [
  "reply_id",
  "interrogation_id",
  "time_s",
  "available_s",
  "slant_range_m",
  "bearing_deg",
  "validity",
  "mode_a_code",
  "pressure_altitude_ft",
] as const;
export const SECONDARY_RADAR_TABLE_COLUMNS = Object.freeze({
  interrogations: [
    "interrogation_id",
    "start_s",
    "end_s",
    "beam_azimuth_deg",
    "beam_width_deg",
    "mode",
  ],
  decodedReplies: replyColumns,
  reports: ["report_id", ...replyColumns],
  truth: [
    "target_id",
    "interrogation_id",
    "time_s",
    "east_m",
    "north_m",
    "up_m",
    "transponder",
  ],
} as const);
export interface SteeredRadarDwell {
  dwell_index: number;
  cycle_index: number;
  start_s: number;
  end_s: number;
  beam_azimuth_deg: number;
  beam_width_deg: number;
  purpose: "search" | "revisit";
}
export interface SteeredRadarDetection {
  detection_id: string;
  dwell_index: number;
  range_index: number;
  time_s: number;
  east_m: number;
  north_m: number;
  power: number;
}
export interface SteeredRadarTrack {
  track_id: string;
  dwell_index: number;
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
export interface SteeredRadarAssociation {
  track_id: string;
  dwell_index: number;
  detection_id: string;
}
export interface SteeredRadarTruth {
  target_id: string;
  dwell_index: number;
  time_s: number;
  east_m: number;
  north_m: number;
}
export interface SteeredRadarDecodedProducts {
  beamSchedule: SteeredRadarDwell[];
  detections: SteeredRadarDetection[];
  tracks: SteeredRadarTrack[];
  associations: SteeredRadarAssociation[];
  truth: SteeredRadarTruth[];
  returns: number[];
  thresholds: number[];
}
export type SteeredRadarProductRoles = Record<
  | "beamSchedule"
  | "returns"
  | "thresholds"
  | "detections"
  | "tracks"
  | "associations",
  string
> & { truth?: string | undefined };
export interface SecondaryRadarInterrogation {
  interrogation_id: string;
  start_s: number;
  end_s: number;
  beam_azimuth_deg: number;
  beam_width_deg: number;
  mode: "mode_a" | "mode_c";
}
export interface SecondaryRadarReply {
  reply_id: string;
  interrogation_id: string;
  time_s: number;
  available_s: number;
  slant_range_m: number | null;
  bearing_deg: number | null;
  validity: "valid" | "invalid";
  mode_a_code: string | null;
  pressure_altitude_ft: number | null;
}
export interface SecondaryRadarReport extends SecondaryRadarReply {
  report_id: string;
}
export interface SecondaryRadarTruth {
  target_id: string;
  interrogation_id: string;
  time_s: number;
  east_m: number;
  north_m: number;
  up_m: number;
  transponder: "enabled" | "disabled";
}
export interface SecondaryRadarDecodedProducts {
  interrogations: SecondaryRadarInterrogation[];
  decodedReplies: SecondaryRadarReply[];
  reports: SecondaryRadarReport[];
  truth: SecondaryRadarTruth[];
}
export type SecondaryRadarProductRoles = Record<
  "interrogations" | "decodedReplies" | "reports",
  string
> & { truth?: string | undefined };
const finite = (value: string) => {
  if (
    !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(value) ||
    !Number.isFinite(Number(value))
  )
    throw new Error("Invalid finite radar table number.");
  return Number(value);
};
const enumColumns: Record<string, readonly string[]> = {
  state: ["tentative", "confirmed", "coasting"],
  purpose: ["search", "revisit"],
  mode: ["mode_a", "mode_c"],
  validity: ["valid", "invalid"],
  transponder: ["enabled", "disabled"],
};
function sourceReader(
  layouts: readonly ProductSourceLayout[],
  assets: ReadonlyMap<string, Uint8Array>
) {
  if (new Set(layouts.map((l) => l.productRef)).size !== layouts.length)
    throw new Error("Duplicate radar source layout.");
  const map = new Map(layouts.map((l) => [l.productRef, l]));
  return {
    table(
      ref: string | undefined,
      columns: readonly string[],
      nullable = false
    ) {
      if (!ref) return [];
      const layout = map.get(ref),
        bytes = assets.get(ref);
      if (
        !layout ||
        layout.kind !== "csv_table" ||
        layout.partition ||
        layout.sample ||
        !bytes ||
        bytes.byteLength !== layout.byteLength
      )
        throw new Error("Missing or mismatched radar table.");
      const rows = readSourceCsv(bytes),
        header = rows.shift();
      if (
        JSON.stringify(header) !== JSON.stringify(columns) ||
        JSON.stringify(layout.columns) !== JSON.stringify(columns) ||
        rows.length !== layout.rowCount
      )
        throw new Error("Invalid radar table columns or extent.");
      return rows.map((row) => {
        if (row.length !== columns.length)
          throw new Error("Invalid radar table width.");
        return Object.fromEntries(
          columns.map((column, i) => {
            const value = row[i]!;
            if (
              nullable &&
              [
                "slant_range_m",
                "bearing_deg",
                "pressure_altitude_ft",
                "mode_a_code",
              ].includes(column) &&
              value === ""
            )
              return [column, null];
            if (column === "mode_a_code") {
              if (!/^[0-7]{4}$/.test(value))
                throw new Error("Mode A code must retain four octal digits.");
              return [column, value];
            }
            if (column.endsWith("_id")) {
              if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(value))
                throw new Error("Invalid radar identifier.");
              return [column, value];
            }
            if (enumColumns[column]) {
              if (!enumColumns[column]!.includes(value))
                throw new Error(`Invalid radar ${column}.`);
              return [column, value];
            }
            return [column, finite(value)];
          })
        );
      });
    },
    array(ref: string) {
      const layout = map.get(ref),
        bytes = assets.get(ref);
      if (
        !layout ||
        layout.kind !== "binary_array" ||
        layout.elementType !== "float32" ||
        layout.byteOrder !== "little" ||
        !bytes ||
        bytes.byteLength !== layout.byteLength ||
        !Number.isSafeInteger(layout.byteOffset) ||
        layout.byteOffset < 0
      )
        throw new Error("Invalid radar array.");
      const count = layout.axes.reduce((n, axis) => n * axis.length, 1);
      if (
        !Number.isSafeInteger(count) ||
        layout.byteOffset + count * 4 !== bytes.byteLength
      )
        throw new Error("Invalid radar array extent.");
      const view = new DataView(
          bytes.buffer,
          bytes.byteOffset,
          bytes.byteLength
        ),
        values: number[] = [];
      for (let i = 0; i < count; i++) {
        const value = view.getFloat32(layout.byteOffset + i * 4, true);
        if (!Number.isFinite(value))
          throw new Error("Nonfinite radar array value.");
        values.push(value);
      }
      return values;
    },
  };
}
/** Decoder only. Verify pinned source bytes with evaluateSteeredRadarProfile before scientific use. */
export function readSteeredRadarProducts(
  layouts: readonly ProductSourceLayout[],
  products: SteeredRadarProductRoles,
  assets: ReadonlyMap<string, Uint8Array>
): SteeredRadarDecodedProducts {
  const reader = sourceReader(layouts, assets);
  return {
    ...Object.fromEntries(
      Object.entries(STEERED_RADAR_TABLE_COLUMNS).map(([role, columns]) => [
        role,
        reader.table(
          products[role as keyof typeof STEERED_RADAR_TABLE_COLUMNS],
          columns
        ),
      ])
    ),
    returns: reader.array(products.returns),
    thresholds: reader.array(products.thresholds),
  } as unknown as SteeredRadarDecodedProducts;
}
/** Decoder only. Empty optional fields stay null; Mode A codes retain leading zeros. */
export function readSecondaryRadarProducts(
  layouts: readonly ProductSourceLayout[],
  products: SecondaryRadarProductRoles,
  assets: ReadonlyMap<string, Uint8Array>
): SecondaryRadarDecodedProducts {
  const reader = sourceReader(layouts, assets);
  return Object.fromEntries(
    Object.entries(SECONDARY_RADAR_TABLE_COLUMNS).map(([role, columns]) => [
      role,
      reader.table(
        products[role as keyof typeof SECONDARY_RADAR_TABLE_COLUMNS],
        columns,
        role === "decodedReplies" || role === "reports"
      ),
    ])
  ) as unknown as SecondaryRadarDecodedProducts;
}

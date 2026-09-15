/** Dependency-free reference reader. Validate declarations with the canonical
 * evaluator before relying on them. No rendering, network or media decoder. */
export type Rational = { numerator: number; denominator: number };
export type SourceAxis =
  | { kind: "index"; name: string; length: number; firstIndex: number }
  | {
      kind: "regular";
      name: string;
      length: number;
      origin: number;
      step: number;
      unit: string;
    }
  | {
      kind: "time";
      name: string;
      length: number;
      start: string;
      stepSeconds: Rational;
    };
type CommonLayout = {
  id: string;
  productRef: string;
  digest: { algorithm: "sha256"; value: string };
  byteLength: number;
  mediaType: string;
};
export type ProductSourceLayout = CommonLayout &
  (
    | {
        kind: "binary_array";
        elementType: "float32" | "float64" | "int16" | "uint16" | "uint8";
        byteOrder: "little" | "big";
        order: "row_major";
        byteOffset: number;
        axes: SourceAxis[];
        quantity: string;
        unit: string;
      }
    | {
        kind: "csv_table";
        encoding: "utf-8";
        delimiter: ",";
        header: true;
        rowCount: number;
        columns: string[];
        partition?: { column: string; equals: string } | undefined;
        sample?:
          | {
              valueColumn: string;
              unitColumn: string;
              quantityColumn: string;
              timeColumn: string;
            }
          | undefined;
      }
    | {
        kind: "video";
        frameCount: number;
        framesPerSecond: Rational;
        start: string;
      }
  );
export type ProductSourceSelector =
  | { kind: "array_element"; indices: number[] }
  | { kind: "table_row"; row: number }
  | { kind: "video_frame"; frame: number };
export type RelativeSourceTime = {
  start: string;
  offsetSeconds: Rational;
  durationSeconds?: Rational;
};
export type ProductSourceRead = {
  byteOffset?: number;
  byteLength?: number;
  coordinates?: Record<
    string,
    number | { value: number; unit: string } | RelativeSourceTime
  >;
  time?: RelativeSourceTime | string;
  value?: number;
  unit?: string;
  quantity?: string;
  cells?: Record<string, string>;
  frame?: number;
  mediaDecoding: "not_applicable" | "not_checked";
};
export const sourceElementBytes = {
  float32: 4,
  float64: 8,
  int16: 2,
  uint16: 2,
  uint8: 1,
} as const;
const integer = (value: number) => Number.isSafeInteger(value) && value >= 0;
const safe = (value: number) => {
  if (!integer(value)) throw new Error("Unsafe integer arithmetic");
  return value;
};

/** RFC 4180-style comma records, UTF-8, with LF or CRLF; row indices exclude the
 * header and count logical records, not physical lines. No whitespace coercion. */
export function readSourceCsv(bytes: Uint8Array): string[][] {
  const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  const rows: string[][] = [];
  let row: string[] = [],
    cell = "",
    quoted = false,
    closed = false;
  const field = () => {
    row.push(cell);
    cell = "";
    closed = false;
  };
  const record = () => {
    field();
    rows.push(row);
    row = [];
  };
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          quoted = false;
          closed = true;
        }
      } else cell += c;
    } else if (c === ",") field();
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[++i] !== "\n") throw new Error("Bare CR in CSV");
      record();
    } else if (c === '"' && cell === "" && !closed) quoted = true;
    else {
      if (closed || c === '"') throw new Error("Malformed CSV quoting");
      cell += c;
    }
  }
  if (quoted) throw new Error("Unterminated CSV quote");
  if (cell !== "" || row.length || closed) record();
  return rows;
}

/** Locate a selected source sample and, when bytes are provided, read it.
 * Video output is only a declared frame interval; it never claims decoding. */
export function readProductSourceSelection(
  layout: ProductSourceLayout,
  selector: ProductSourceSelector,
  bytes?: Uint8Array
): ProductSourceRead {
  if (bytes && bytes.byteLength !== layout.byteLength)
    throw new Error("Source byte length mismatch");
  if (layout.kind === "binary_array" && selector.kind === "array_element") {
    if (selector.indices.length !== layout.axes.length)
      throw new Error("Array rank mismatch");
    let element = 0;
    const coordinates: NonNullable<ProductSourceRead["coordinates"]> = {};
    for (const [i, axis] of layout.axes.entries()) {
      const index = selector.indices[i]!;
      if (!integer(index) || index >= axis.length)
        throw new Error("Array index outside extent");
      element = safe(safe(element * axis.length) + index);
      coordinates[axis.name] =
        axis.kind === "index"
          ? safe(axis.firstIndex + index)
          : axis.kind === "regular"
          ? { value: axis.origin + index * axis.step, unit: axis.unit }
          : {
              start: axis.start,
              offsetSeconds: {
                numerator: safe(index * axis.stepSeconds.numerator),
                denominator: axis.stepSeconds.denominator,
              },
            };
    }
    const byteLength = sourceElementBytes[layout.elementType];
    const byteOffset = safe(layout.byteOffset + safe(element * byteLength));
    if (safe(byteOffset + byteLength) > layout.byteLength)
      throw new Error("Array element outside artifact");
    const result: ProductSourceRead = {
      byteOffset,
      byteLength,
      coordinates,
      quantity: layout.quantity,
      unit: layout.unit,
      mediaDecoding: "not_applicable",
    };
    const timeAxis = layout.axes.find((axis) => axis.kind === "time");
    if (timeAxis)
      result.time = coordinates[timeAxis.name] as RelativeSourceTime;
    if (bytes) {
      const view = new DataView(
          bytes.buffer,
          bytes.byteOffset,
          bytes.byteLength
        ),
        little = layout.byteOrder === "little";
      result.value =
        layout.elementType === "float32"
          ? view.getFloat32(byteOffset, little)
          : layout.elementType === "float64"
          ? view.getFloat64(byteOffset, little)
          : layout.elementType === "int16"
          ? view.getInt16(byteOffset, little)
          : layout.elementType === "uint16"
          ? view.getUint16(byteOffset, little)
          : view.getUint8(byteOffset);
      if (!Number.isFinite(result.value))
        throw new Error(
          "Selected sample is nonfinite; missing-value encodings are not supported by this profile"
        );
    }
    return result;
  }
  if (layout.kind === "csv_table" && selector.kind === "table_row") {
    if (!integer(selector.row) || selector.row >= layout.rowCount)
      throw new Error("CSV row outside extent");
    if (!bytes) return { mediaDecoding: "not_applicable" };
    const rows = readSourceCsv(bytes),
      header = rows.shift();
    if (
      !header ||
      header.length !== layout.columns.length ||
      header.some((value, i) => value !== layout.columns[i])
    )
      throw new Error("CSV header mismatch");
    if (
      rows.length !== layout.rowCount ||
      rows.some((row) => row.length !== layout.columns.length)
    )
      throw new Error("CSV row shape mismatch");
    const cells = Object.fromEntries(
      layout.columns.map((name, i) => [name, rows[selector.row]![i]!])
    ) as Record<string, string>;
    if (
      layout.partition &&
      cells[layout.partition.column] !== layout.partition.equals
    )
      throw new Error("Selected row belongs to a different product partition");
    const result: ProductSourceRead = {
      cells,
      mediaDecoding: "not_applicable",
    };
    if (layout.sample) {
      const sample = layout.sample,
        raw = cells[sample.valueColumn]!;
      if (
        !/^[+-]?(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)(?:[eE][+-]?[0-9]+)?$/.test(
          raw
        ) ||
        !Number.isFinite(Number(raw))
      )
        throw new Error("CSV sample is not a finite decimal number");
      result.value = Number(raw);
      result.unit = cells[sample.unitColumn]!;
      result.quantity = cells[sample.quantityColumn]!;
      result.time = cells[sample.timeColumn]!;
    }
    return result;
  }
  if (layout.kind === "video" && selector.kind === "video_frame") {
    if (!integer(selector.frame) || selector.frame >= layout.frameCount)
      throw new Error("Video frame outside extent");
    return {
      frame: selector.frame,
      time: {
        start: layout.start,
        offsetSeconds: {
          numerator: safe(selector.frame * layout.framesPerSecond.denominator),
          denominator: layout.framesPerSecond.numerator,
        },
        durationSeconds: {
          numerator: layout.framesPerSecond.denominator,
          denominator: layout.framesPerSecond.numerator,
        },
      },
      mediaDecoding: "not_checked",
    };
  }
  throw new Error("Selector does not match source layout");
}

import { createHash } from "node:crypto";
export const digest = (bytes) => ({
  algorithm: "sha256",
  value: createHash("sha256").update(bytes).digest("hex"),
});
export function fixture() {
  const array = Buffer.alloc(32);
  [18, 19, 20, 21, 22, 23, 24, 25].forEach((value, i) =>
    array.writeFloatLE(value, i * 4)
  );
  const csv = Buffer.from(
    "instrument,quantity,value,unit,time\r\nmeter-a,humidity,54,%,2026-08-14T21:00:00Z\r\nmeter-b,humidity,55,%,2026-08-14T21:00:00Z\r\n"
  );
  // Opaque bytes deliberately do not represent a decodable video. This profile
  // checks declared frame intervals and byte identity, never codec validity.
  const video = Buffer.from(
    "opaque video artifact for metadata-only conformance"
  );
  const observation = {
    kind: "observation",
    schemaVersion: "0.1.0",
    id: "source-demo",
    status: "draft",
    createdAt: "2026-08-14T21:04:00Z",
    updatedAt: "2026-08-14T21:04:00Z",
    eventTime: { state: "unknown", reason: "not_recorded" },
    position: { state: "unknown", reason: "not_collected" },
    sources: [{ id: "synthetic", kind: "other", access: "public" }],
    products: [
      ["thermal", array, "application/octet-stream"],
      ["weather-a", csv, "text/csv"],
      ["weather-b", csv, "text/csv"],
      ["video", video, "video/mp4"],
    ].map(([id, value, format]) => ({
      id,
      kind: "raw",
      sourceRefs: ["source:synthetic"],
      access: "public",
      format,
      digest: digest(value),
    })),
    methods: [],
    frames: [],
    assertions: [],
    processing: [],
    measurements: [
      {
        id: "humidity-a",
        quantity: "humidity",
        value: {
          value: 54,
          unit: "%",
          uncertainty: { kind: "unknown", reason: "not_characterized" },
        },
        sourceRefs: ["product:weather-a"],
      },
    ],
  };
  const common = (id, value, mediaType) => ({
    id,
    productRef: `product:${id}`,
    digest: digest(value),
    byteLength: value.length,
    mediaType,
  });
  const selection = {
    kind: "product_source_selection",
    schemaVersion: "0.1.0",
    id: "demo-selections",
    observationId: observation.id,
    layouts: [
      {
        ...common("thermal", array, "application/octet-stream"),
        kind: "binary_array",
        elementType: "float32",
        byteOrder: "little",
        order: "row_major",
        byteOffset: 0,
        quantity: "apparent_temperature",
        unit: "Cel",
        axes: [
          {
            kind: "time",
            name: "time",
            length: 2,
            start: "2026-08-14T21:00:00Z",
            stepSeconds: { numerator: 2, denominator: 1 },
          },
          { kind: "index", name: "row", length: 2, firstIndex: 0 },
          { kind: "index", name: "column", length: 2, firstIndex: 0 },
        ],
      },
      ...["a", "b"].map((meter) => ({
        ...common(`weather-${meter}`, csv, "text/csv"),
        kind: "csv_table",
        encoding: "utf-8",
        delimiter: ",",
        header: true,
        rowCount: 2,
        columns: ["instrument", "quantity", "value", "unit", "time"],
        partition: { column: "instrument", equals: `meter-${meter}` },
        sample: {
          valueColumn: "value",
          unitColumn: "unit",
          quantityColumn: "quantity",
          timeColumn: "time",
        },
      })),
      {
        ...common("video", video, "video/mp4"),
        kind: "video",
        frameCount: 2880,
        framesPerSecond: { numerator: 12, denominator: 1 },
        start: "2026-08-14T21:00:00Z",
      },
    ],
    selections: [
      {
        id: "pixel",
        layoutRef: "layout:thermal",
        selector: { kind: "array_element", indices: [1, 0, 1] },
      },
      {
        id: "meter-a",
        layoutRef: "layout:weather-a",
        selector: { kind: "table_row", row: 0 },
        measurementRef: "measurement:humidity-a",
      },
      {
        id: "meter-b",
        layoutRef: "layout:weather-b",
        selector: { kind: "table_row", row: 1 },
      },
      {
        id: "last-frame",
        layoutRef: "layout:video",
        selector: { kind: "video_frame", frame: 2879 },
      },
    ],
  };
  const assets = new Map([
    ["product:thermal", array],
    ["product:weather-a", csv],
    ["product:weather-b", csv],
    ["product:video", video],
  ]);
  return { observation, selection, assets };
}

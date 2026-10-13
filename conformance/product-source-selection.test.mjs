import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Ajv2020 from "ajv/dist/2020.js";
import {
  fixture,
  digest,
} from "../examples/v2/product-source-demo/fixture.mjs";
import {
  evaluateProductSourceSelection,
  ProductSourceSelectionSchema,
  productSourceSelectionJsonSchema,
  readSourceCsv,
  readProductSourceSelection,
} from "../packages/disclosureos-schema/dist/experimental/v2/index.js";
const run = (f) =>
  evaluateProductSourceSelection(f.observation, f.selection, {
    assets: f.assets,
  });

test("three-dimensional pixels, separate meter rows and exact final frame timing", async () => {
  const result = await run(fixture());
  assert.equal(result.success, true, JSON.stringify(result.issues));
  assert.deepEqual(result.checks, {
    structural: "passed",
    semantic: "passed",
    external: "passed",
    content: "passed",
  });
  assert.equal(result.selections[0].content.byteOffset, 20);
  assert.equal(result.selections[0].content.value, 23);
  assert.deepEqual(result.selections[0].content.time, {
    start: "2026-08-14T21:00:00Z",
    offsetSeconds: { numerator: 2, denominator: 1 },
  });
  assert.equal(result.selections[1].content.cells.instrument, "meter-a");
  assert.equal(result.selections[2].content.value, 55);
  assert.deepEqual(result.selections[3].content.time.offsetSeconds, {
    numerator: 2879,
    denominator: 12,
  });
  assert.equal(result.selections[3].content.mediaDecoding, "not_checked");
  assert.equal(result.calibration, "not_checked");
});
for (const [name, mutate, code] of [
  [
    "wrong observation",
    (f) => (f.selection.observationId = "other"),
    "SELECTION.OBSERVATION",
  ],
  [
    "different product digest",
    (f) => (f.selection.layouts[0].digest.value = "0".repeat(64)),
    "SELECTION.PRODUCT",
  ],
  [
    "different media type",
    (f) => (f.selection.layouts[0].mediaType = "text/csv"),
    "SELECTION.PRODUCT",
  ],
  [
    "wrong rank",
    (f) => (f.selection.selections[0].selector.indices = [0, 0]),
    "SELECTION.LOCATOR",
  ],
  [
    "exclusive array boundary",
    (f) => (f.selection.selections[0].selector.indices = [2, 0, 0]),
    "SELECTION.LOCATOR",
  ],
  [
    "unsafe extent",
    (f) => (f.selection.layouts[0].axes[0].length = Number.MAX_SAFE_INTEGER),
    "SELECTION.AXIS",
  ],
  [
    "duplicate axis",
    (f) => (f.selection.layouts[0].axes[1].name = "time"),
    "SELECTION.AXIS",
  ],
  [
    "invalid UTC",
    (f) => (f.selection.layouts[0].axes[0].start = "2026-02-30T00:00:00Z"),
    "SELECTION.TIME",
  ],
  [
    "wrong file extent",
    (f) => (f.selection.layouts[0].byteOffset = 4),
    "SELECTION.EXTENT",
  ],
  [
    "wrong selector family",
    (f) => (f.selection.selections[0].selector = { kind: "table_row", row: 0 }),
    "SELECTION.LOCATOR",
  ],
  [
    "duplicate layout",
    (f) => f.selection.layouts.push(f.selection.layouts[0]),
    "SELECTION.UNIQUE",
  ],
  [
    "duplicate selection",
    (f) => f.selection.selections.push(f.selection.selections[0]),
    "SELECTION.UNIQUE",
  ],
  [
    "wrong meter partition",
    (f) => (f.selection.selections[1].selector.row = 1),
    "SELECTION.CONTENT",
  ],
  [
    "wrong measurement value",
    (f) => (f.observation.measurements[0].value.value = 55),
    "SELECTION.CONTENT",
  ],
  [
    "wrong measurement units",
    (f) => (f.observation.measurements[0].value.unit = "ppm"),
    "SELECTION.CONTENT",
  ],
  [
    "unrelated measurement source",
    (f) => (f.observation.measurements[0].sourceRefs = ["product:thermal"]),
    "SELECTION.MEASUREMENT",
  ],
  [
    "last frame plus one",
    (f) => (f.selection.selections[3].selector.frame = 2880),
    "SELECTION.LOCATOR",
  ],
  [
    "CSV duplicate header",
    (f) => (f.selection.layouts[1].columns[1] = "instrument"),
    "SELECTION.COLUMNS",
  ],
  [
    "truncated artifact",
    (f) => f.assets.set("product:thermal", Buffer.alloc(4)),
    "EXTERNAL.SIZE",
  ],
  [
    "same-size altered artifact",
    (f) => (f.assets.get("product:thermal")[0] ^= 1),
    "EXTERNAL.DIGEST",
  ],
])
  test(`rejects ${name}`, async () => {
    const f = fixture();
    mutate(f);
    const result = await run(f);
    assert.equal(result.success, false);
    assert.ok(
      result.issues.some((i) => i.code === code),
      JSON.stringify(result.issues)
    );
  });
test("missing bytes remain not checked; no invented values", async () => {
  const f = fixture();
  f.assets.delete("product:thermal");
  const result = await run(f);
  assert.equal(result.success, false);
  assert.equal(result.checks.external, "not_checked");
  assert.equal(result.selections[0].content, undefined);
});
test("caller mutations after invocation cannot change bytes or selection", async () => {
  const f = fixture(),
    pending = run(f);
  f.assets.get("product:thermal").fill(0);
  f.selection.selections[0].selector.indices[0] = 100;
  assert.equal((await pending).selections[0].content.value, 23);
});
test("byte order, nonzero byte views, integer types and frequency axes", () => {
  const f = fixture(),
    layout = f.selection.layouts[0],
    buffer = Buffer.alloc(36);
  buffer.writeFloatBE(12.5, 24);
  layout.byteOrder = "big";
  layout.axes[2] = {
    kind: "regular",
    name: "frequency",
    length: 2,
    origin: 430,
    step: 0.5,
    unit: "MHz",
  };
  const read = readProductSourceSelection(
    layout,
    { kind: "array_element", indices: [1, 0, 1] },
    buffer.subarray(4)
  );
  assert.equal(read.value, 12.5);
  assert.deepEqual(read.coordinates.frequency, { value: 430.5, unit: "MHz" });
  for (const [elementType, width, setter, value] of [
    ["float64", 8, "writeDoubleLE", 1.125],
    ["int16", 2, "writeInt16LE", -4],
    ["uint16", 2, "writeUInt16LE", 65000],
    ["uint8", 1, "writeUInt8", 255],
  ]) {
    const bytes = Buffer.alloc(width);
    bytes[setter](value, 0);
    const one = {
      ...layout,
      elementType,
      byteOrder: "little",
      byteLength: width,
      axes: [{ kind: "index", name: "sample", firstIndex: 0, length: 1 }],
    };
    assert.equal(
      readProductSourceSelection(
        one,
        { kind: "array_element", indices: [0] },
        bytes
      ).value,
      value
    );
  }
});
test("nonfinite selected samples are explicit failures even with matching digest", async () => {
  const f = fixture();
  f.assets.get("product:thermal").writeFloatLE(NaN, 20);
  f.selection.layouts[0].digest = f.observation.products[0].digest = digest(
    f.assets.get("product:thermal")
  );
  assert.equal((await run(f)).checks.content, "failed");
});
test("CSV quoted commas, escaped quotes and multiline records retain logical row indices", () => {
  assert.deepEqual(
    readSourceCsv(Buffer.from('a,b\r\n"x,y","z""q\nnext"\r\n')),
    [
      ["a", "b"],
      ["x,y", 'z"q\nnext'],
    ]
  );
  for (const input of [
    'a,b\nx,"bad',
    'a,b\nx,"bad"tail\n',
    "a,b\rx,y",
    'a,b\nx,b"ad',
  ])
    assert.throws(() => readSourceCsv(Buffer.from(input)));
  assert.throws(() => readSourceCsv(Uint8Array.of(255)));
});
test("JSON Schema parity and checked-in artifact match exported contract", () => {
  const schema = productSourceSelectionJsonSchema(),
    ajv = new Ajv2020({ strict: true });
  const validate = ajv.compile(schema),
    f = fixture();
  assert.deepEqual(
    JSON.parse(
      readFileSync(
        new URL(
          "../packages/disclosureos-schema/schema/experimental/product-source-selection-0.1.0.schema.json",
          import.meta.url
        )
      )
    ),
    schema
  );
  for (const value of [
    f.selection,
    { ...f.selection, schemaVersion: "0.2.0" },
    { ...f.selection, unknown: true },
  ])
    assert.equal(
      Boolean(validate(value)),
      ProductSourceSelectionSchema.safeParse(value).success
    );
  assert.equal(validate(f.selection), true);
});

function emptyTableFixture() {
  const f = fixture(),
    layout = f.selection.layouts[1],
    bytes = Buffer.from(layout.columns.join(",") + "\n");
  delete layout.sample;
  delete layout.partition;
  Object.assign(layout, {
    rowCount: 0,
    byteLength: bytes.length,
    digest: digest(bytes),
  });
  f.observation.products[1].digest = layout.digest;
  f.assets.set(layout.productRef, bytes);
  f.selection.selections = f.selection.selections.filter(
    (s) => s.layoutRef !== `layout:${layout.id}`
  );
  return f;
}
test("a pinned header-only CSV is retained empty content, not a missing artifact", async () => {
  const f = emptyTableFixture(),
    result = await run(f);
  assert.equal(result.success, true, JSON.stringify(result.issues));
  assert.equal(result.checks.content, "passed");
  assert.throws(
    () =>
      readProductSourceSelection(f.selection.layouts[1], {
        kind: "table_row",
        row: 0,
      }),
    /outside extent/
  );
});
test("empty CSV cannot declare a partition, scalar sample mapping or row selector", async () => {
  const schema = productSourceSelectionJsonSchema(),
    ajv = new Ajv2020({ strict: true }),
    validate = ajv.compile(schema);
  for (const mutate of [
    (l) => {
      l.partition = { column: "instrument", equals: "meter-a" };
    },
    (l) => {
      l.sample = {
        valueColumn: "value",
        unitColumn: "unit",
        quantityColumn: "quantity",
        timeColumn: "time",
      };
    },
  ]) {
    const f = emptyTableFixture();
    mutate(f.selection.layouts[1]);
    assert.equal(validate(f.selection), false);
    assert.equal(
      ProductSourceSelectionSchema.safeParse(f.selection).success,
      false
    );
    assert.equal((await run(f)).success, false);
  }
  const f = emptyTableFixture();
  f.selection.selections.push({
    id: "nonexistent-row",
    layoutRef: "layout:weather-a",
    selector: { kind: "table_row", row: 0 },
  });
  const r = await run(f);
  assert.equal(r.success, false);
  assert.ok(r.issues.some((i) => i.code === "SELECTION.LOCATOR"));
});
test("empty CSV bytes must still match the declared header even without a row selection", async () => {
  for (const content of [
    "wrong,header\n",
    "instrument,quantity,value,unit,time\nmeter-a,humidity,0,%,2026-08-14T21:00:00Z\n",
    "\n",
  ]) {
    const f = emptyTableFixture(),
      layout = f.selection.layouts[1],
      bytes = Buffer.from(content);
    Object.assign(layout, { byteLength: bytes.length, digest: digest(bytes) });
    f.observation.products[1].digest = layout.digest;
    f.assets.set(layout.productRef, bytes);
    const r = await run(f);
    assert.equal(r.success, false);
    assert.equal(r.checks.external, "passed");
    assert.equal(r.checks.content, "failed");
    assert.ok(r.issues.some((i) => i.code === "SELECTION.CONTENT"));
  }
});
test("portable CSV contract accepts zero rows only in the header-only branch", () => {
  const f = emptyTableFixture(),
    ajv = new Ajv2020({ strict: true }),
    validate = ajv.compile(productSourceSelectionJsonSchema());
  assert.equal(validate(f.selection), true);
  assert.equal(
    ProductSourceSelectionSchema.safeParse(f.selection).success,
    true
  );
  f.selection.layouts[1].rowCount = -1;
  assert.equal(validate(f.selection), false);
  assert.equal(
    ProductSourceSelectionSchema.safeParse(f.selection).success,
    false
  );
});

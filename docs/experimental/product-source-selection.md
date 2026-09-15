# Product source selection, experimental 0.1.0

This source-candidate contract connects a product's exact bytes to a selected
array element, CSV record or declared video frame interval. It addresses the
portable source-reading layer exposed by Meridian's mixed-instrument showcase.
It is independent of a screen, chart palette or playback implementation.

Import `ProductSourceSelectionSchema`, `evaluateProductSourceSelection` and
`readProductSourceSelection` from `@disclosureos/schema/experimental/v2`.
The JSON Schema is exported at `experimental/v2/product-source-selection/schema/0.1.0`.
This addition is not published to npm yet.

## Input and identity

The evaluator accepts an observation, a `product_source_selection` document and
an optional local `assets` map keyed by `product:ID`. Each layout selects one
observation product, pins its SHA-256 digest, exact media type and full artifact
byte length. Layout IDs and product mappings are unique within the document.
Derived products remain derived: selection never relabels them as raw acquisition
products. Source bytes are copied before the first asynchronous operation.

Each selection has an ID, layout reference, typed selector and optional
measurement reference. A measurement must include the selected product in its
primary lineage, and its value, quantity and unit must exactly match the decoded
scalar. No conversion, rounding, uncertainty substitution or interpolation occurs.
Measurement references may be omitted for exploratory selections. The document
need not select every product or every measurement in an observation.

## Layouts and coordinates

| Layout | Convention | Selection |
| --- | --- | --- |
| `binary_array` | Contiguous row-major float32, float64, int16, uint16 or uint8; explicit byte order, leading offset and 1–8 axes | Zero-based local `indices`, one per axis |
| `csv_table` | UTF-8 comma-separated logical records with required header; quoted commas/newlines and doubled quotes; LF or CRLF | Zero-based `row`, excluding the header |
| `video` | Declared constant frame rate, frame count and UTC origin | Zero-based `frame` |

An array's last axis varies fastest. Extent plus leading offset must equal the
artifact length; trailing padding, strides, compression, arbitrary missing-value
sentinels and tiled containers are outside this first profile. Selected NaN or
infinite values fail instead of becoming zero. Individual chunks use separate
products and layouts with their own time origins. Only selected sample contents
are decoded, not all array elements.

Index axes declare their first coordinate. Regular numerical axes declare origin,
positive step and unit, allowing frequency-bin centers without embedding a chart.
A time axis declares a UTC origin and positive rational seconds per sample. There
is at most one time axis. Times are returned as origin plus rational offset so
12 fps does not become falsely exact rounded milliseconds. Array samples are
instants; video frames have half-open declared intervals. This does not establish
clock synchronization, exposure duration or physical timing uncertainty.

CSV columns are matched exactly and must be unique. A layout can declare a
partition by exact equality on a named column. Multiple products may pin the
same container bytes while selecting different meter rows. The selected row must
satisfy its product's partition; row numbering is in the entire original table.
Optional sample columns identify value, quantity, unit and UTC time. Numeric
values must be finite decimal/scientific notation, without implicit empty-cell,
hexadecimal or whitespace conversion. CSV timestamps are validated Gregorian UTC
instants. Acquisition containment and channel identity remain the responsibility
of the existing acquisition/measurement-binding contracts.

## Evaluation and limits

The result separately reports structure, semantics, external byte checks and
selected content. Missing assets remain `not_checked`. `success` requires both
external and selected-content checks to pass. Corrupt assets never yield a value.
The reference reader performs no I/O and assumes a validated declaration and
verified bytes; use the evaluator at a trust boundary.

Video evaluation verifies file identity and the bounds of the declared frame
selection. It does not decode the media or confirm the declared codec, frame count
or frame rate. `mediaDecoding` remains `not_checked`, including on successful
results. Variable-frame-rate media needs a future timestamp-table profile.

Physical authenticity, calibration, science, complete data coverage, video
decoding, thermal/visible registration and common-object association remain
outside this profile. An array/source-selection pass can coexist with incomplete
physical acquisition context. This is a separate, narrowly scoped result, not an
override of another profile's failure.

## Reproduce

`examples/v2/product-source-demo/fixture.mjs` authors a tiny three-dimensional
thermal array, two meter partitions and an intentionally opaque video payload.
The latter proves that metadata checks cannot be represented as codec validation.
Run `pnpm build`, `pnpm emit:v2-product-source-selection`, then
`pnpm test:v2-product-source-selection`. Conformance covers boundaries, exact
offsets, rational timing, both byte orders, altered and missing files, unrelated
measurements, partitions, quoted CSV, nonfinite values, mutation isolation and
JSON Schema parity. Npm publication remains part of the coordinated V2 release.

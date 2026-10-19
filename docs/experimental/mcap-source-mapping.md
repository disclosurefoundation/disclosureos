# MCAP source mapping, experimental 0.1.0

This proposed addition connects a DisclosureOS measurement to a field in an
original MCAP recording. It does not replace MCAP, its message schemas, or the
existing acquisition and measurement bindings. It is **not included in published
Beta 4**. Package publication remains a separate release decision.

Use `McapSourceMappingSchema`, `mcapSourceMappingJsonSchema`, and
`evaluateMcapSourceMapping` from `@disclosureos/schema/experimental/v2` in this
source revision. The JSON Schema export is
`experimental/v2/mcap-source-mapping/schema/0.1.0`.

## Reference structure

| Part | Identifies |
| --- | --- |
| Recording | An observation product, exact SHA-256, media type and byte length |
| Channel | Recording-local MCAP channel ID, topic, message encoding, and schema identity |
| Schema | MCAP schema ID, name, encoding, and SHA-256 of the exact schema data bytes; `{ "id": 0 }` explicitly means no schema |
| Decoder | Observation method reference and exact version defining how the message payload becomes a logical JSON value |
| Message | Record location, sequence, recorder timestamp and publisher timestamp |
| Selection | Measurement reference and RFC 6901 pointer into the decoder's logical output |

One channel may contain many fields and samples. It is not a DisclosureOS
measurement channel. The existing measurement-binding document continues to
identify quantity, unit, acquisition and acquisition time. The decoder method
must document its output and any transformations. A JSON pointer addresses that
output, not arbitrary JSON presumed to be present inside every MCAP message.

Each document has unique recording IDs/product mappings, channel IDs and
recording/channel pairs, and one selection per mapped measurement. It can map a
subset of an observation; full coverage is an adapter/export requirement.
Measurements may trace to the MCAP directly or through assertions and declared
processing inputs. The original product remains raw; decoded products remain
separately declared derivatives.

## Exact location and clocks

All offsets, byte lengths and MCAP timestamps are unsigned decimal uint64 strings.
Do not round-trip them through a JavaScript number. Sequence is uint32 and channel
and schema identifiers are uint16.

- `{"kind":"file","offset":"..."}` locates the Message record header in the
  original file.
- `{"kind":"chunk","chunkOffset":"...","recordOffset":"..."}` locates a
  Chunk record header in the file and a Message record header within its
  **uncompressed** records. The inner offset is not an absolute file offset.

These conventions match the [MCAP specification](https://mcap.dev/spec). They
support indexed or sequential readers. Timestamps and sequence numbers are
identity cross-checks, not unique message locators. Repeated timestamps and zero
sequence numbers are valid. Recompressing or rewriting a file requires a new
recording digest and new byte locations.

`logTimeNs` and `publishTimeNs` retain MCAP recorder/publisher values. They do not
supply an acquisition timestamp, independently qualify a clock, or establish
cross-device synchronization. Acquisition timing remains in measurement bindings.

## Reading and verification

Pass an observation, mapping, and optional local assets map keyed by `product:ID`
to `evaluateMcapSourceMapping`. Structure and lineage are checked before byte
length and SHA-256. Missing assets remain `not_checked`. A source identity check
alone never reports selected-content success.

For content verification, provide a trusted `resolveMessage` adapter backed by
an official MCAP reader and the declared payload decoder. It receives verified
recording bytes, channel and message declarations. It must locate the message by
byte position and return the **actual** channel/schema/message metadata plus the
decoded logical value. Never copy the requested identity into the result without
checking it. The evaluator cross-checks identities and extracts a finite numeric
value with the pointer, then compares it to the measurement. No unit conversion
or interpolation occurs. Unit meaning, scientific validity and calibration are
not checked by this profile.

The resolver must not mutate supplied bytes. Documents and assets are snapshotted
before asynchronous work; messages are cached by recording, channel and byte
location rather than time. The evaluator does no I/O, decompression or MCAP
parsing. Supported compression and payload encodings are explicit capabilities of
the supplied reader/decoder. An unsupported codec must fail, not skip messages.

A source record can therefore remain in MCAP and be opened with other MCAP tools.
DisclosureOS adds research context and traceable measurements without requiring
its viewer or re-encoding the original recording.

## Speculor implementation

The paired portal adapter uses the official Python `mcap==1.6.0` reader for
Speculor's `speculor_table/1` payload. Its `mcap-table` method version `1` returns
`{ "samples": [[...]] }`: original row order and original schema-field order,
with unchanged scalar values. `/samples/ROW/COLUMN` selects a reading. Recorder
and publisher timestamps remain separate from the payload capture timestamp.

The export retains the original file, decoded streams, existing Beta 4 documents
and this proposed mapping. An independent standard-library Python reader scans
the original recording again and verifies every mapped measurement and all
retained samples. That pilot currently supports uncompressed MCAP only. The
reference format can describe compressed chunks, but compression support is not
implied by that pilot or by schema validation.

## Reproduce

Run `pnpm --filter '@disclosureos/schema...' build`,
`pnpm emit:v2-mcap-source-mapping`, and `pnpm test:v2-mcap-source-mapping`.
The contract fixture uses a controlled resolver to test identity and evaluation
boundaries; it is not a container decoder test. The paired Speculor adapter tests
and real-session replay exercise official MCAP decoding and independent recovery.

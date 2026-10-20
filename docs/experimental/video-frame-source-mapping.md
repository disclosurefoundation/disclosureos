# Relative video-frame source mapping, experimental 0.1.0

A Beta 5 source candidate, not yet published to npm. This optional companion
connects a retained video product to exact presentation-order frames without
requiring a UTC capture time. Existing Beta 4 `product_source_selection` schemas
and their UTC-based constant-rate video layout remain unchanged.

Import `VideoFrameSourceMappingSchema`, `evaluateVideoFrameSourceMapping` and
`readVideoFrameReference` from `@disclosureos/schema/experimental/v2` after building
this source revision. Portable schema export:
`experimental/v2/video-frame-source-mapping/schema/0.1.0`.

## Why this exists

The Sky360 public-clip pilot retained six original MP4 files and verified all
6,719 frame presentation timestamps. It did not establish UTC capture time,
physical capture cadence, location or calibration. A frame can still be addressed
precisely in those original bytes. The mapping makes that address portable without
reencoding the source or adopting the DisclosureOS viewer.

This is a source index, not an instrument, detection, tracking or camera-calibration
profile. It does not replace MP4, a codec, or a media decoder. A recording can be
raw or derived in its Observation; mapping it preserves that status.

## Identity and coordinates

Each mapping pins one Observation product's reference, SHA-256 digest, full byte
length and exact video media type. The `indexer` names an Observation method and
its version, describing the demuxer/decoder and stream-order convention used.

Each `streams` entry contains:

- `streamIndex`: the zero-based global container stream index, counting audio and
  other streams as well as video, in the declared indexer's demux order. It is not
  a video-only ordinal or container-specific track ID.
- `timeBase`: positive integer numerator and denominator, in seconds per tick.
- `presentationTicks`: the complete decoded frame sequence for that stream, in
  presentation order. Every value is a canonical signed decimal string. Negative
  and nonzero starts, variable spacing and duplicate timestamps are supported.
  Missing PTS must be reported by the adapter; do not synthesize it from frame rate.

A selection names its own ID, stream index and zero-based `frameIndex` into that
sequence. Frame index disambiguates duplicate PTS and is not a packet number or
byte offset. B-frame decode order is not presentation order. Adapters must use
unfiltered decoded frames, not browser seek approximations or keyframes alone.
Streams not included in the mapping are outside its coverage.

`readVideoFrameReference(mapping, streamIndex, frameIndex)` returns the product
identity, frame identity, retained tick and time base. It also returns exact
rational `presentationSeconds` and `offsetFromFirstFrameSeconds`, whose integer
numerators and denominators are strings. Arithmetic uses BigInt; the original
clock is never silently rebased through floating point. Tick strings are bounded
to 100 characters for resource safety. File lengths, indexes and time-base terms
are limited to JavaScript safe integers.

No frame duration is inferred from the next timestamp. Neither PTS nor frame-rate
metadata establishes exposure time, capture cadence or a UTC instant. A visible
clock overlay remains attributed source text unless its clock basis is established.

## Evaluation

```js
const result = await evaluateVideoFrameSourceMapping(observation, mapping, {
  assets: new Map([[mapping.productRef, originalBytes]]),
  resolveFrameIndex: async ({ bytes, streamIndexes, indexer }) => {
    // Use a trusted decoder selected by the declared indexer method/version.
    // Decode these exact bytes and return the complete requested stream indexes:
    return decodeFrameTiming(bytes, streamIndexes, indexer);
  },
});
```

The evaluator performs no network access or codec work. Its external resolver is
trusted adapter code; the standard is responsible for comparing its decoded
result with the declared reference. Snapshotting protects against caller mutation
while hashing. The resolver must not modify its byte buffer.

Results separate structure, semantic references, external file identity and
`frameTiming`. Exact bytes are checked before calling the resolver. The resolver
must return precisely the requested streams, their time bases and all decoded
frame timestamps. Changed hashes, wrong streams, missing or extra frames and
changed PTS fail. No asset or no decoder remains `not_checked`; `success` requires
both byte verification and decoded timing verification. Returned selections carry
verified references only after those checks pass. Pixel interpretation, capture
time, calibration and scientific assessment remain separate.

The pure reference reader is for already validated mappings. At an untrusted
input boundary use the evaluator. Reading a declared address alone does not check
its source file.

## Reproduce

Run `pnpm --filter '@disclosureos/schema...' build`,
`pnpm emit:v2-video-frame-source-mapping`, and
`pnpm test:v2-video-frame-source-mapping`.

The authored fixture uses an explicitly labeled test-double indexer and opaque
bytes; it does not pretend to demonstrate media decoding. The Sky360 portal
adapter supplies the real-file integration check: original hashes plus complete
FFprobe frame timing, independently checked by the portable Python verifier.
No partner video is distributed inside standard packages.

The decoder convention follows [FFprobe stream indexes and frame output](https://ffmpeg.org/ffprobe.html)
and [AVFrame presentation timestamps](https://ffmpeg.org/doxygen/trunk/structAVFrame.html).
The public source collection is pinned to
[Sky360 mldata 41bcec9](https://github.com/Sky360-Repository/mldata/tree/41bcec973725dc427be58b4091b3effeebaa8413).

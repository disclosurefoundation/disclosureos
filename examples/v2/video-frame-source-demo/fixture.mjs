import {
  fixture as sourceFixture,
  digest,
} from "../product-source-demo/fixture.mjs";
export function fixture() {
  const source = sourceFixture(),
    bytes = source.assets.get("product:video");
  const observation = source.observation;
  observation.methods.push({
    id: "frame-indexer",
    version: "fixture-1",
    description: "Authored test double, not an actual media decoder.",
  });
  const streams = [
    {
      streamIndex: 2,
      timeBase: { numerator: 1, denominator: 90000 },
      presentationTicks: [
        "9007199254740993",
        "9007199254744593",
        "9007199254744593",
        "9007199254751793",
      ],
    },
  ];
  const mapping = {
    kind: "video_frame_source_mapping",
    schemaVersion: "0.1.0",
    id: "video-demo",
    observationId: observation.id,
    productRef: "product:video",
    digest: digest(bytes),
    byteLength: bytes.length,
    mediaType: "video/mp4",
    indexer: { methodRef: "method:frame-indexer", methodVersion: "fixture-1" },
    streams: structuredClone(streams),
    selections: [{ id: "third-frame", streamIndex: 2, frameIndex: 2 }],
  };
  return {
    observation,
    mapping,
    assets: new Map([["product:video", bytes]]),
    streams,
    resolveFrameIndex: () => streams,
  };
}

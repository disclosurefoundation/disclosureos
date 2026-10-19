import { digest } from "../product-source-demo/fixture.mjs";
// Contract fixture with a controlled resolver, not a claim that these bytes are
// a valid MCAP. Real container reading belongs to an official MCAP implementation.
export function fixture() {
  const bytes = Buffer.alloc(64, 7),
    fingerprint = digest(bytes);
  const observation = {
    kind: "observation",
    schemaVersion: "0.1.0",
    id: "demo",
    status: "draft",
    createdAt: "2026-10-19T00:00:00Z",
    updatedAt: "2026-10-19T00:00:00Z",
    eventTime: { state: "unknown", reason: "not_recorded" },
    position: { state: "unknown", reason: "not_recorded" },
    sources: [{ id: "sensor", kind: "instrument_data", access: "public" }],
    products: [
      {
        id: "mcap",
        kind: "raw",
        format: "application/mcap",
        access: "public",
        digest: fingerprint,
        sourceRefs: ["source:sensor"],
      },
    ],
    methods: [
      {
        id: "payload",
        version: "1",
        description: "Decode a JSON message with a samples matrix.",
      },
    ],
    frames: [],
    assertions: [],
    processing: [],
    measurements: [
      {
        id: "x",
        quantity: "acceleration",
        value: {
          value: 1.25,
          unit: "m/s2",
          uncertainty: { kind: "unknown", reason: "not_characterized" },
        },
        sourceRefs: ["product:mcap"],
      },
    ],
  };
  const mapping = {
    kind: "mcap_source_mapping",
    schemaVersion: "0.1.0",
    id: "mapping",
    observationId: "demo",
    recordings: [
      {
        id: "capture",
        productRef: "product:mcap",
        digest: fingerprint,
        byteLength: String(bytes.length),
        mediaType: "application/mcap",
      },
    ],
    channels: [
      {
        id: "imu",
        recordingRef: "recording:capture",
        channelId: 1,
        topic: "/imu",
        messageEncoding: "json",
        schema: {
          id: 1,
          name: "imu",
          encoding: "jsonschema",
          digest: digest(Buffer.from("{}")),
        },
        decoder: { methodRef: "method:payload", methodVersion: "1" },
      },
    ],
    selections: [
      {
        id: "x",
        measurementRef: "measurement:x",
        channelRef: "channel:imu",
        message: {
          location: { kind: "file", offset: "16" },
          sequence: 0,
          logTimeNs: "9007199254740993",
          publishTimeNs: "9007199254740992",
        },
        payloadPointer: "/samples/0/0",
      },
    ],
  };
  const resolved = {
    channelId: 1,
    topic: "/imu",
    messageEncoding: "json",
    schema: structuredClone(mapping.channels[0].schema),
    message: structuredClone(mapping.selections[0].message),
    decoded: { samples: [[1.25, 2]] },
  };
  return {
    observation,
    mapping,
    assets: new Map([["product:mcap", bytes]]),
    resolved,
    resolveMessage: () => resolved,
  };
}

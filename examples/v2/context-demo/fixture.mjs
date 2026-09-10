import { createHash } from "node:crypto";
export const bytes = (value) =>
  Buffer.from(JSON.stringify(value, null, 2) + "\n");
export const digest = (data) => createHash("sha256").update(data).digest("hex");
export const snapshot = (value, schemaId) => ({
  documentId: value.id,
  schemaId,
  sha256: digest(bytes(value)),
});
export const observationSchema =
  "urn:disclosureos:experimental:observation:0.1.0";
export const contextSchema =
  "urn:disclosureos:experimental:observation-context:0.1.0";
export const acquisitionSchema =
  "urn:disclosureos:experimental:acquisition-context:0.1.0";
const time = "2026-07-28T02:10:00Z";
const sourced = (id, value, sourceRef = "source:log") => [
  {
    id,
    content: {
      state: "known",
      value,
      provenance: { sourceRef, attributedTo: "Synthetic station recorder" },
    },
  },
];
/** All inputs are invented controls, not ELDÆON data or validated scientific outcomes. */
export function fixture() {
  const unknown = { state: "unknown", reason: "not_recorded" };
  const artifacts = new Map([
    [
      "log.txt",
      Buffer.from(
        "SYNTHETIC: ambient temperature 18.2 Cel; station A; no target temperature.\n",
      ),
    ],
    ["account-a.txt", Buffer.from("SYNTHETIC: a triangular light.\n")],
    ["account-b.txt", Buffer.from("SYNTHETIC: an oval light.\n")],
    [
      "optical.txt",
      Buffer.from("SYNTHETIC optical control samples; no event detection.\n"),
    ],
    [
      "radio.txt",
      Buffer.from("SYNTHETIC radio control samples; no event detection.\n"),
    ],
  ]);
  const channels = [
    {
      id: "optical",
      quantity: "radiance",
      unit: "W/sr/m2",
      sampling: { state: "unknown", reason: "not_recorded" },
    },
    {
      id: "radio",
      quantity: "power",
      unit: "W",
      sampling: { state: "unknown", reason: "not_recorded" },
    },
  ];
  const manifestBytes = bytes({ synthetic: true, channels });
  artifacts.set("manifest.json", manifestBytes);
  const artifact = (name) => ({
    mediaType: "text/plain",
    byteLength: artifacts.get(name).length,
    digest: { algorithm: "sha256", value: digest(artifacts.get(name)) },
  });
  const acquisition = {
    kind: "acquisition_context",
    schemaVersion: "0.1.0",
    id: "acquisition-A",
    instruments: [
      {
        id: "station-A",
        identity: {
          state: "known",
          manufacturer: "Synthetic",
          model: "Control station",
        },
      },
    ],
    manifests: [
      {
        id: "manifest-A",
        instrumentRef: "instrument:station-A",
        version: "1",
        publishedAt: "2026-07-01T00:00:00Z",
        artifact: {
          ...artifact("manifest.json"),
          mediaType: "application/json",
        },
        configuration: { hardware: unknown, firmware: unknown },
        channels,
      },
    ],
    deployments: [
      {
        id: "deployment-A",
        instrumentRef: "instrument:station-A",
        manifest: { state: "pinned", ref: "manifest:manifest-A" },
        period: unknown,
        site: { state: "known", value: "Synthetic station A" },
      },
    ],
    calibrations: [],
    acquisitions: channels.map((c) => ({
      id: c.id,
      instrumentRef: "instrument:station-A",
      manifest: { state: "pinned", ref: "manifest:manifest-A" },
      deployment: { state: "pinned", ref: "deployment:deployment-A" },
      time: { state: "known", kind: "instant", value: time, timeScale: "UTC" },
      classification: "known_control",
      clock: {
        source: unknown,
        synchronization: unknown,
        resolution: unknown,
        uncertainty: unknown,
      },
      channels: [
        {
          channelId: c.id,
          calibration: { state: "unresolved", reason: "not_recorded" },
        },
      ],
    })),
    products: channels.map((c) => ({
      id: c.id,
      acquisitionRef: `acquisition:${c.id}`,
      kind: "raw",
      artifact: artifact(`${c.id}.txt`),
    })),
  };
  const observation = {
    kind: "observation",
    schemaVersion: "0.1.0",
    id: "capture-A",
    status: "draft",
    createdAt: time,
    updatedAt: time,
    summary: "Fictional C1 context control; not partner data.",
    eventTime: {
      state: "known",
      value: { kind: "instant", value: time, timeScale: "UTC" },
      sourceRefs: ["source:log"],
    },
    position: unknown,
    sources: [
      ["log", "log.txt"],
      ["account-a", "account-a.txt"],
      ["account-b", "account-b.txt"],
      ["optical", "optical.txt"],
      ["radio", "radio.txt"],
    ].map(([id, name]) => ({
      id,
      kind:
        id === "log"
          ? "document"
          : id.startsWith("account")
            ? "testimony"
            : "instrument_data",
      access: "public",
      digest: artifact(name).digest,
    })),
    products: channels.map((c) => ({
      id: c.id,
      kind: "raw",
      format: "text/plain",
      access: "public",
      sourceRefs: [`source:${c.id}`],
      digest: artifact(`${c.id}.txt`).digest,
    })),
    methods: [
      {
        id: "review",
        version: "1",
        description: "Synthetic comparison of source descriptions.",
      },
    ],
    frames: [],
    assertions: [],
    measurements: [
      {
        id: "ambient-A",
        quantity: "ambient_temperature",
        value: {
          value: 18.2,
          unit: "Cel",
          uncertainty: { kind: "unknown", reason: "not_reported" },
        },
        sourceRefs: ["source:log"],
      },
    ],
    processing: [],
  };
  const context = {
    kind: "observation_context",
    schemaVersion: "0.1.0",
    id: "context-A",
    observationRef: snapshot(observation, observationSchema),
    acquisitionRef: snapshot(acquisition, acquisitionSchema),
    recordedAt: time,
    recordedBy: "Synthetic curator",
    entities: [
      {
        kind: "event",
        id: "event-A",
        fields: {
          eventType: sourced("type", "synthetic multi-sensor control"),
          placeIds: sourced("places", ["place-A"]),
        },
      },
      {
        kind: "place",
        id: "place-A",
        fields: { name: sourced("name", "Synthetic station A") },
      },
      {
        kind: "platform",
        id: "station-A",
        fields: {
          role: sourced("role", "station"),
          placeId: sourced("site", "place-A"),
        },
      },
      {
        kind: "temporal",
        id: "time-A",
        fields: {
          eventTime: sourced("time", {
            kind: "instant",
            value: time,
            timeScale: "UTC",
          }),
        },
      },
      {
        kind: "environment",
        id: "weather-A",
        fields: {
          placeId: sourced("place", "place-A"),
          platformId: sourced("station", "station-A"),
          temporalId: sourced("time", "time-A"),
          weather: [{ id: "weather", content: unknown }],
        },
        measurements: [
          {
            id: "ambient-link",
            role: "ambient_temperature",
            measurementId: "ambient-A",
          },
        ],
      },
      {
        kind: "reported_object",
        id: "object-A",
        fields: {
          shape: [
            ...sourced("shape-1", "triangle", "source:account-a"),
            ...sourced("shape-2", "oval", "source:account-b"),
          ],
          sizeDescription: [{ id: "size", content: unknown }],
        },
      },
      {
        kind: "collection",
        id: "collection-A",
        fields: {
          productRefs: sourced("products", [
            "product:optical",
            "product:radio",
          ]),
          acquisitionIds: sourced("acquisitions", ["optical", "radio"]),
          alignmentDescription: [
            {
              id: "alignment",
              content: { state: "unknown", reason: "unavailable" },
            },
          ],
        },
      },
    ],
  };
  const contextRef = snapshot(context, contextSchema);
  const reference = {
    document: contextRef,
    target: { kind: "reported_object", id: "object-A", field: "shape" },
  };
  const history = {
    kind: "claim_history",
    schemaVersion: "0.2.0",
    id: "history-A",
    observation,
    contextRefs: [contextRef],
    claims: [
      {
        id: "shape-review",
        recordedAt: time,
        kind: "assessment",
        status: "assessed",
        topic: "reported shape",
        subject: { kind: "context", reference },
        inputRefs: ["source:account-a", "source:account-b"],
        contextInputRefs: ["shape-1", "shape-2"].map((assertionId) => ({
          ...reference,
          assertionId,
        })),
        outcome: "inconclusive",
        evaluatedBy: "Synthetic reviewer",
        evaluatedAt: time,
        methodRef: "method:review",
        methodVersion: "1",
        rationale: "The fictional accounts disagree. No shape is selected.",
      },
    ],
  };
  return { observation, context, acquisition, history, artifacts };
}
/** Rebuild snapshot references after intentional test mutations, without altering their targets. */
export function bundle(f) {
  f.context.observationRef = snapshot(f.observation, observationSchema);
  if (f.context.acquisitionRef)
    f.context.acquisitionRef = snapshot(f.acquisition, acquisitionSchema);
  const ref = snapshot(f.context, contextSchema);
  f.history.contextRefs = [ref];
  f.history.observation = f.observation;
  for (const c of f.history.claims) {
    if (c.subject.kind === "context") c.subject.reference.document = ref;
    for (const r of c.contextInputRefs ?? []) r.document = ref;
  }
  return {
    history: f.history,
    options: {
      documents: new Map(
        [f.observation, f.context, f.acquisition].map((value) => [
          digest(bytes(value)),
          bytes(value),
        ]),
      ),
    },
  };
}

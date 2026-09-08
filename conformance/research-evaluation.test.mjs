import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Ajv2020 from "ajv/dist/2020.js";
import {
  evaluateResearchEvaluation as evaluate,
  ResearchEvaluationSchema,
  researchEvaluationJsonSchema,
  evaluateReproductionPacket,
  evaluateInstrumentResearchCompletion,
} from "../packages/disclosureos-schema/dist/experimental/v2/index.js";
import {
  researchEvaluationExample as example,
  pin,
} from "../examples/v2/evaluation-provenance-demo.mjs";
const run = (v = example()) => evaluate(v.manifest, v.options);
const updatePacket = (v, change) => {
  const p = JSON.parse(new TextDecoder().decode(v.options.packetBytes));
  change(p);
  v.options.packetBytes = new TextEncoder().encode(JSON.stringify(p));
  v.manifest.packet = pin(v.options.packetBytes);
};
const updateDocument = (v, name, change) =>
  updatePacket(v, (p) => {
    const ref = p.documents[name];
    const d = JSON.parse(new TextDecoder().decode(v.options.files.get(ref)));
    change(d);
    const bytes = new TextEncoder().encode(JSON.stringify(d));
    v.options.files.set(ref, bytes);
    Object.assign(
      p.files.find((f) => f.id === ref),
      pin(bytes)
    );
  });
test("complete built-in evaluation preserves both validators and hashes exact receipt strings", async () => {
  const v = example(),
    r = await run(v);
  assert.equal(r.success, true, JSON.stringify(r.issues));
  assert.equal(r.checks.receipt, "passed");
  assert.equal(r.output.completion.counts.satisfied, 6);
  const packet = JSON.parse(new TextDecoder().decode(v.options.packetBytes));
  assert.deepEqual(
    r.packetValidation,
    await evaluateReproductionPacket(packet, { files: v.options.files })
  );
  assert.deepEqual(r.output.packet, r.packetValidation);
  const doc = Object.fromEntries(
    Object.entries(packet.documents).map(([k, ref]) => [
      k,
      JSON.parse(new TextDecoder().decode(v.options.files.get(ref))),
    ])
  );
  const maps = Object.fromEntries(
    Object.entries(packet.assets).map(([k, entries]) => [
      k,
      new Map(entries.map((e) => [e.ref, v.options.files.get(e.fileRef)])),
    ])
  );
  assert.deepEqual(
    r.output.completion,
    await evaluateInstrumentResearchCompletion(
      doc.history,
      doc.context,
      doc.acquisitionBindings,
      doc.measurementBindings,
      doc.review,
      {
        observationAssets: maps.observation,
        contextAssets: maps.context,
        reviewAssets: maps.review,
      }
    )
  );
  assert.deepEqual(
    pin(new TextEncoder().encode(r.receipt.requestJson)),
    r.receipt.request
  );
  assert.deepEqual(
    pin(new TextEncoder().encode(r.receipt.outputJson)),
    r.receipt.output
  );
  assert.deepEqual(JSON.parse(r.receipt.outputJson), r.output);
  const request = JSON.parse(r.receipt.requestJson);
  assert.deepEqual(request.manifest, v.manifest);
  assert.equal(Object.keys(request.rules).length, 7);
  assert.equal(r.implementationExecution, "not_attested");
  assert.equal(r.environmentExecution, "not_attested");
  assert.equal(r.vocabularyMembership, "not_checked");
  assert.equal(r.scientificEligibility, "not_checked");
});
test("repeat evaluation and input object key reordering preserve receipt", async () => {
  const v = example(),
    a = await run(v);
  v.manifest = Object.fromEntries(Object.entries(v.manifest).reverse());
  const b = await run(v);
  assert.deepEqual(a.receipt, b.receipt);
});
for (const role of ["vocabularies", "implementation", "environment"])
  test(`declared version changes request identity: ${role}`, async () => {
    const v = example(),
      a = await run(v);
    const d =
      role === "vocabularies"
        ? v.manifest.dependencies[role][0]
        : v.manifest.dependencies[role];
    d.version = "changed";
    const b = await run(v);
    assert.equal(b.success, true);
    assert.notEqual(a.receipt.request.sha256, b.receipt.request.sha256);
    assert.equal(a.receipt.output.sha256, b.receipt.output.sha256);
  });
test("repinned changed source changes request and output identity", async () => {
  const v = example(),
    a = await run(v);
  updateDocument(
    v,
    "history",
    (d) => (d.claims[0].text = "Changed synthetic assertion")
  );
  const b = await run(v);
  assert.equal(b.success, true);
  assert.notEqual(a.receipt.request.sha256, b.receipt.request.sha256);
  assert.notEqual(a.receipt.output.sha256, b.receipt.output.sha256);
});
test("failed reviewed prerequisite remains failed with a byte-verified receipt", async () => {
  const v = example();
  updateDocument(
    v,
    "review",
    (d) => (d.measurements[0].calibrationUse.outcome = "rejected")
  );
  const r = await run(v);
  assert.equal(r.success, false);
  assert.equal(r.checks.evaluation, "failed");
  assert.equal(r.checks.receipt, "passed");
  assert.equal(
    r.output.completion.requirements.find((r) => r.id === "reviewed_context")
      .status,
    "failed"
  );
  assert.equal(JSON.parse(r.receipt.outputJson).packet.success, false);
});
for (const target of [
  "packet",
  "vocabulary",
  "implementation",
  "environment",
  "source",
])
  for (const mode of ["missing", "corrupt", "size"])
    test(`${mode} ${target} prevents receipt`, async () => {
      const v = example();
      let map, key;
      if (target === "packet") {
        if (mode === "missing") delete v.options.packetBytes;
        else if (mode === "size") v.options.packetBytes = new Uint8Array();
        else v.options.packetBytes[0] ^= 1;
      } else {
        map = target === "source" ? v.options.files : v.options.dependencyFiles;
        key =
          target === "source"
            ? "observation-source-report"
            : target === "vocabulary"
            ? "synthetic-vocabulary"
            : target === "implementation"
            ? "schema-implementation"
            : "local-environment";
        if (mode === "missing") map.delete(key);
        else if (mode === "size") map.set(key, new Uint8Array());
        else map.get(key)[0] ^= 1;
      }
      const r = await run(v);
      assert.equal(r.success, false);
      assert.equal(r.receipt, null);
      assert.ok(r.issues.length);
      assert.equal(
        r.checks.external,
        mode === "missing" ? "not_checked" : "failed"
      );
    });
for (const [label, change] of [
  ["custom callback", (v) => (v.manifest.callback = () => true)],
  ["cached success", (v) => (v.manifest.output = { success: true })],
  ["unknown workflow", (v) => (v.manifest.workflow = "custom")],
  ["empty vocabulary", (v) => (v.manifest.dependencies.vocabularies = [])],
  [
    "missing policy version",
    (v) => delete v.manifest.dependencies.implementation.version,
  ],
  [
    "duplicate refs",
    (v) =>
      (v.manifest.dependencies.environment.ref =
        v.manifest.dependencies.implementation.ref),
  ],
  [
    "conflicting vocabulary versions",
    (v) =>
      v.manifest.dependencies.vocabularies.push({
        ...v.manifest.dependencies.vocabularies[0],
        ref: "second",
        version: "2",
      }),
  ],
])
  test(`refuses ${label}`, async () => {
    const v = example();
    change(v);
    const r = await run(v);
    assert.equal(r.success, false);
    assert.equal(r.receipt, null);
    assert.ok(r.issues.length);
  });
test("malformed packet, nested invalid document and dangling refs retain diagnostics", async () => {
  for (const mutate of [
    (v) => {
      v.options.packetBytes = new TextEncoder().encode("{}");
      v.manifest.packet = pin(v.options.packetBytes);
    },
    (v) => updateDocument(v, "history", (d) => delete d.observation),
    (v) => updatePacket(v, (p) => (p.documents.history = "missing")),
  ]) {
    const v = example();
    mutate(v);
    const r = await run(v);
    assert.equal(r.success, false);
    assert.ok(r.packetValidation);
    if (r.receipt)
      assert.equal(JSON.parse(r.receipt.outputJson).packet.success, false);
    else assert.ok(r.issues.length);
  }
});
test("malformed UTF-8 or BOM in pinned packet prevents execution", async () => {
  for (const bytes of [
    new Uint8Array([255]),
    new TextEncoder().encode("\uFEFF{}"),
  ]) {
    const v = example();
    v.options.packetBytes = bytes;
    v.manifest.packet = pin(bytes);
    const r = await run(v);
    assert.equal(r.receipt, null);
    assert.ok(r.issues.some((i) => i.code === "EVALUATION.JSON"));
  }
});
test("documents and all bytes are snapshotted before asynchronous hashing", async () => {
  const v = example(),
    a = await run(v),
    pending = run(v);
  v.manifest.dependencies.vocabularies = [];
  v.options.packetBytes.fill(0);
  for (const map of [v.options.files, v.options.dependencyFiles])
    for (const b of map.values()) b.fill(0);
  assert.deepEqual((await pending).receipt, a.receipt);
});
test("caller inputs remain unchanged and URLs are never fetched", async () => {
  const v = example(),
    before = structuredClone(v),
    old = globalThis.fetch;
  try {
    globalThis.fetch = () => {
      throw Error("Unexpected fetch");
    };
    assert.equal((await run(v)).success, true);
    assert.deepEqual(v, before);
  } finally {
    globalThis.fetch = old;
  }
});
test("hash unavailable never issues receipt", async () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "crypto");
  try {
    Object.defineProperty(globalThis, "crypto", {
      value: undefined,
      configurable: true,
    });
    const r = await run();
    assert.equal(r.receipt, null);
    assert.equal(r.checks.external, "not_checked");
    assert.ok(r.issues.some((i) => i.code === "EVALUATION.HASH_UNAVAILABLE"));
  } finally {
    Object.defineProperty(globalThis, "crypto", descriptor);
  }
});
test("versioned artifact matches runtime schema and independent validator", () => {
  const schema = JSON.parse(
    readFileSync(
      new URL(
        "../packages/disclosureos-schema/schema/experimental/research-evaluation-0.1.0.schema.json",
        import.meta.url
      )
    )
  );
  assert.deepEqual(schema, researchEvaluationJsonSchema());
  const validate = new Ajv2020({ strict: false }).compile(schema);
  for (const change of [
    (v) => {},
    (v) => (v.workflow = "wrong"),
    (v) => (v.packet.sha256 = "a"),
    (v) => (v.dependencies.vocabularies = []),
    (v) => (v.dependencies.implementation.byteLength = 0),
    (v) => (v.extra = true),
  ]) {
    const v = example().manifest;
    change(v);
    assert.equal(validate(v), ResearchEvaluationSchema.safeParse(v).success);
  }
});

test("repinned dependency bytes change request identity even with the same version", async () => {
  const v = example(),
    a = await run(v);
  const ref = v.manifest.dependencies.vocabularies[0].ref;
  const b = new TextEncoder().encode("Changed synthetic vocabulary");
  v.options.dependencyFiles.set(ref, b);
  Object.assign(v.manifest.dependencies.vocabularies[0], pin(b));
  const r = await run(v);
  assert.equal(r.success, true);
  assert.notEqual(r.receipt.request.sha256, a.receipt.request.sha256);
  assert.equal(r.vocabularyMembership, "not_checked");
});
test("mutating returned output cannot silently match the recorded digest", async () => {
  const r = await run();
  r.output.packet.success = false;
  assert.notDeepEqual(JSON.parse(r.receipt.outputJson), r.output);
  assert.deepEqual(
    pin(new TextEncoder().encode(r.receipt.outputJson)),
    r.receipt.output
  );
});
test("dependency missing-file diagnostic points to its manifest entry", async () => {
  const v = example();
  v.options.dependencyFiles.delete("schema-implementation");
  const r = await run(v);
  assert.ok(
    r.issues.some(
      (i) =>
        i.code === "EVALUATION.MISSING_FILE" &&
        i.pointer === "/dependencies/implementation"
    )
  );
});

test("verified file bytes remain verified when nested JSON cannot decode", async () => {
  const v = example();
  updatePacket(v, (p) => {
    const ref = p.documents.history;
    const bytes = new TextEncoder().encode("not JSON");
    v.options.files.set(ref, bytes);
    Object.assign(
      p.files.find((f) => f.id === ref),
      pin(bytes)
    );
  });
  const r = await run(v);
  assert.equal(r.checks.external, "passed");
  assert.equal(r.receipt, null);
  assert.ok(r.packetValidation.issues.some((i) => i.code === "PACKET.JSON"));
});
test("final receipt hashing failure keeps computed output without a partial receipt", async () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "crypto"),
    original = globalThis.crypto;
  try {
    Object.defineProperty(globalThis, "crypto", {
      configurable: true,
      value: {
        subtle: {
          digest: (algorithm, bytes) =>
            new TextDecoder().decode(bytes).startsWith('{"limits":')
              ? Promise.reject(Error("receipt hashing unavailable"))
              : original.subtle.digest(algorithm, bytes),
        },
      },
    });
    const r = await run();
    assert.equal(r.checks.evaluation, "passed");
    assert.equal(r.receipt, null);
    assert.ok(r.output);
    assert.equal(r.success, false);
    assert.ok(r.issues.some((i) => i.pointer === "/receipt"));
  } finally {
    Object.defineProperty(globalThis, "crypto", descriptor);
  }
});

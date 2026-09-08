import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, mkdtempSync, mkdirSync, cpSync, writeFileSync, rmSync } from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import Ajv2020 from "ajv/dist/2020.js";
import {
  evaluateReproductionPacket,
  ReproductionPacketSchema,
  reproductionPacketJsonSchema,
} from "../packages/disclosureos-schema/dist/experimental/v2/index.js";
const folder = new URL("../examples/v2/reproduction-demo/", import.meta.url);
const base = JSON.parse(readFileSync(new URL("packet.json", folder)));
const files = () =>
  new Map(
    base.files.map((f) => [
      f.id,
      new Uint8Array(readFileSync(new URL(`files/${f.id}`, folder))),
    ])
  );
const run = (packet = structuredClone(base), bytes = files()) =>
  evaluateReproductionPacket(packet, { files: bytes });
const schema = JSON.parse(
  readFileSync(
    new URL(
      "../packages/disclosureos-schema/schema/experimental/reproduction-packet-0.1.0.schema.json",
      import.meta.url
    )
  )
);
const validate = new Ajv2020({ strict: false }).compile(schema);
test("complete exact-byte packet", async () => {
  const r = await run();
  assert.equal(r.success, true, JSON.stringify(r.issues));
  assert.equal(r.research.success, true);
  for (const field of [
    "methodExecution",
    "environmentExecution",
    "scientificEligibility",
  ])
    assert.equal(r[field], "not_checked");
});
test("versioned schema agrees", () => {
  assert.deepEqual(schema, reproductionPacketJsonSchema());
  for (const change of [
    () => {},
    (p) => (p.kind = "wrong"),
    (p) => (p.method.absoluteTolerance = -1),
    (p) => (p.files[0].id = "../escape"),
    (p) => (p.files[0].sha256 += "\n"),
    (p) => (p.method.implementations = []),
    (p) => (p.researchProfile = "latest"),
    (p) => (p.extra = true),
  ]) {
    const p = structuredClone(base);
    change(p);
    assert.equal(validate(p), ReproductionPacketSchema.safeParse(p).success);
  }
});
for (const entry of base.files) {
  test(`missing ${entry.id}`, async () => {
    const f = files();
    f.delete(entry.id);
    const r = await run(undefined, f);
    assert.equal(r.checks.profile, "not_checked");
    assert.equal(r.research, null);
  });
  test(`corrupt ${entry.id}`, async () => {
    const f = files();
    f.get(entry.id)[0] ^= 1;
    const r = await run(undefined, f);
    assert.equal(r.checks.profile, "failed");
    assert.equal(r.research, null);
    assert.ok(r.issues.some((i) => i.code === "PACKET.DIGEST"));
  });
}
for (const [name, change, code] of [
  ["duplicate file", (p) => p.files.push(p.files[0]), "PACKET.DUPLICATE"],
  [
    "missing reference",
    (p) => (p.documents.history = "missing"),
    "PACKET.REFERENCE",
  ],
  [
    "duplicate alias",
    (p) => p.assets.context.push(p.assets.context[0]),
    "PACKET.DUPLICATE",
  ],
  [
    "duplicate implementation",
    (p) => p.method.implementations.push(p.method.implementations[0]),
    "PACKET.DUPLICATE",
  ],
  [
    "unreferenced file",
    (p) => p.files.push({ ...p.files[0], id: "unused" }),
    "PACKET.UNUSED_FILE",
  ],
])
  test(name, async () => {
    const p = structuredClone(base);
    change(p);
    const r = await run(p);
    assert.equal(r.checks.semantic, "failed");
    assert.equal(r.checks.profile, "not_checked");
    assert.ok(r.issues.some((i) => i.code === code));
  });
function repin(p, f, id, bytes) {
  f.set(id, bytes);
  const item = p.files.find((v) => v.id === id);
  item.byteLength = bytes.byteLength;
  item.sha256 = createHash("sha256").update(bytes).digest("hex");
}
for (const [name, bytes] of [
  ["malformed JSON", new TextEncoder().encode("{")],
  ["invalid UTF8", new Uint8Array([255])],
  ["BOM", new TextEncoder().encode("\ufeff{}")],
])
  test(name, async () => {
    const p = structuredClone(base),
      f = files();
    repin(p, f, p.documents.history, bytes);
    const r = await run(p, f);
    assert.equal(r.checks.semantic, "failed");
    assert.ok(r.issues.some((i) => i.code === "PACKET.JSON"));
  });
test("same IDs with changed input bytes cannot reuse pins", async () => {
  const f = files();
  const data = JSON.parse(new TextDecoder().decode(f.get("review")));
  data.purpose.description = "Changed purpose";
  f.set("review", new TextEncoder().encode(JSON.stringify(data)));
  assert.equal((await run(undefined, f)).checks.profile, "failed");
});
test("valid repinned but inconsistent document still fails research checks", async () => {
  const p = structuredClone(base),
    f = files();
  const data = JSON.parse(new TextDecoder().decode(f.get("review")));
  data.contextId = "other";
  repin(p, f, "review", new TextEncoder().encode(JSON.stringify(data)));
  assert.equal((await run(p, f)).success, false);
});
test("reformatted JSON changes exact-byte identity", async () => {
  const f = files();
  f.set(
    "history",
    new TextEncoder().encode(
      JSON.stringify(JSON.parse(new TextDecoder().decode(f.get("history"))))
    )
  );
  assert.equal((await run(undefined, f)).checks.profile, "failed");
});
test("snapshots before await and does not mutate inputs", async () => {
  const p = structuredClone(base),
    f = files();
  const pending = run(p, f);
  p.documents.history = "wrong";
  for (const b of f.values()) b.fill(0);
  assert.equal((await pending).success, true);
  const original = structuredClone(base);
  await run(original);
  assert.deepEqual(original, base);
});
test("offline verifier never executes bundled methods", async () => {
  const p = structuredClone(base),
    f = files();
  repin(
    p,
    f,
    "typescript-source",
    new TextEncoder().encode('throw new Error("Do not execute packet code")')
  );
  const previous = globalThis.fetch;
  try {
    globalThis.fetch = () => {
      throw Error("Unexpected fetch");
    };
    const r = await run(p, f);
    assert.equal(r.success, true);
    assert.equal(r.methodExecution, "not_checked");
  } finally {
    globalThis.fetch = previous;
  }
});
test("independent TypeScript and Python agree on synthetic result", () => {
  const cwd = new URL("../", import.meta.url);
  const ts = JSON.parse(
    execFileSync(
      "pnpm",
      ["exec", "tsx", "scripts/reproduce-synthetic-control.mts"],
      { cwd, encoding: "utf8" }
    )
  );
  const py = JSON.parse(
    execFileSync("python3", ["scripts/reproduce-synthetic-control.py"], {
      cwd,
      encoding: "utf8",
    })
  );
  for (const key of [
    "packetId",
    "packetSha256",
    "method",
    "version",
    "value",
    "unit",
    "absoluteTolerance",
  ])
    assert.deepEqual(ts[key], py[key]);
  assert.equal(ts.value, -3);
  assert.equal(ts.researchPrerequisites, true);
  assert.equal(py.researchPrerequisites, "not_checked");
});

test('method target must resolve and preserve output units',async()=>{for(const change of [p=>p.method.measurementRef='measurement:missing',p=>p.method.unit='km/h']){const p=structuredClone(base);change(p);const r=await run(p);assert.equal(r.success,false);assert.ok(r.issues.some(i=>i.code==='PACKET.MEASUREMENT'));}});

for(const [name,id,text,error] of [
 ['incorrect expected value','observation-product-summary','{"velocity":-4}\n','Reproduction differs from expected output'],
 ['wrong runtime','python-environment','{"runtime":"python","major":99,"arithmetic":"binary64-ordered-sum"}\n','Runtime differs'],
])test(`independent consumer rejects ${name}`,()=>{
 const temp=mkdtempSync(join(tmpdir(),'disclosureos-reproduction-'));
 try {
  mkdirSync(join(temp,'scripts'),{recursive:true});
  cpSync(new URL('../scripts/reproduce-synthetic-control.py',import.meta.url),join(temp,'scripts/reproduce-synthetic-control.py'));
  const dest=join(temp,'examples/v2/reproduction-demo');mkdirSync(dest,{recursive:true});cpSync(folder,dest,{recursive:true});
  const packet=structuredClone(base),f=files();repin(packet,f,id,new TextEncoder().encode(text));
  writeFileSync(join(dest,'files',id),f.get(id));writeFileSync(join(dest,'packet.json'),JSON.stringify(packet));
  assert.throws(()=>execFileSync('python3',[join(temp,'scripts/reproduce-synthetic-control.py')],{stdio:'pipe'}),e=>e.status!==0&&e.stderr.toString().includes(error));
 } finally {rmSync(temp,{recursive:true,force:true});}
});

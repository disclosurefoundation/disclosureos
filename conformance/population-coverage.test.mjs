import { test } from "node:test";
import assert from "node:assert/strict";
import {
  readFileSync,
  writeFileSync,
  mkdtempSync,
  mkdirSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import {
  getPopulationCoverage,
  getCompleteness,
} from "../packages/disclosureos-scoring/dist/index.js";
import {
  getPopulationCoverage as subpath,
  deriveFieldPaths,
} from "../packages/disclosureos-scoring/dist/population-coverage/index.js";
const fixtures = JSON.parse(
  readFileSync(new URL("./observation-fixtures.json", import.meta.url))
);
for (const f of fixtures.filter((f) => f.kind === "observation"))
  test(`coverage preserves legacy counts: ${f.id}`, () => {
    const before = structuredClone(f.input);
    assert.deepEqual(getPopulationCoverage(f.input), getCompleteness(f.input));
    assert.deepEqual(subpath(f.input), getCompleteness(f.input));
    assert.deepEqual(f.input, before);
  });
const paths = (...names) => names.map((path) => ({ path, required: true }));
test("presence is not validity or analytical readiness", () => {
  const v = {
    zero: 0,
    no: false,
    space: " ",
    unknown: { state: "unknown" },
    invalid: NaN,
    items: [null],
  };
  const r = getPopulationCoverage(v, { paths: paths(...Object.keys(v)) });
  assert.equal(r.percentage, 100);
  assert.equal(r.requiredPercentage, 100);
  assert.deepEqual(
    Object.keys(r).sort(),
    [
      "total",
      "present",
      "percentage",
      "missing",
      "requiredTotal",
      "requiredPresent",
      "requiredPercentage",
    ].sort()
  );
});
test("empty values count as absent; numeric zero stays present", () => {
  const r = subpath(
    { a: null, b: undefined, c: "", d: [], e: {}, f: 0 },
    { paths: paths("a", "b", "c", "d", "e", "f") }
  );
  assert.equal(r.present, 1);
  assert.deepEqual(r.missing, ["a", "b", "c", "d", "e"]);
  assert.equal(r.percentage, 17);
});
test("custom denominator is honored without implied applicability", () => {
  const options = {
    paths: [
      { path: "unknownDomain", required: false },
      { path: "value", required: true },
    ],
  };
  const before = structuredClone(options);
  const r = subpath({ value: 0 }, options);
  assert.equal(r.percentage, 50);
  assert.equal(r.requiredPercentage, 100);
  assert.deepEqual(options, before);
  assert.equal(subpath({}, { paths: [] }).percentage, 0);
});
test("arrays remain leaves rather than per-sample coverage", () => {
  const options = { paths: paths("readings") };
  assert.deepEqual(
    subpath({ readings: [null] }, options),
    subpath({ readings: [1, 2, 3] }, options)
  );
});
test("default denominator remains the legacy schema field list", () => {
  assert.equal(subpath({}).total, deriveFieldPaths().length);
  assert.deepEqual(
    subpath({}).missing,
    deriveFieldPaths().map((f) => f.path)
  );
});
const cli = new URL(
  "../packages/disclosureos-cli/dist/index.js",
  import.meta.url
);
const run = (name, ...args) =>
  spawnSync(process.execPath, [cli.pathname, name, ...args], {
    encoding: "utf8",
  });
function withFiles(fn) {
  const dir = mkdtempSync(join(tmpdir(), "disclosureos-population-"));
  try {
    const file = join(dir, "valid.json");
    writeFileSync(
      file,
      JSON.stringify(fixtures.find((f) => f.id === "minimal-v1-record").input)
    );
    fn(dir, file);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
test("CLI new and legacy names have identical JSON and exit status", () =>
  withFiles((dir, file) => {
    for (const flags of [[], ["--recursive"]]) {
      const a = run("population-coverage", dir, "--json", ...flags),
        b = run("completeness", dir, "--json", ...flags);
      assert.equal(a.status, 0, a.stderr);
      assert.equal(a.status, b.status);
      assert.deepEqual(JSON.parse(a.stdout), JSON.parse(b.stdout));
      assert.equal(JSON.parse(a.stdout).files[0].valid, true);
    }
  }));
test("CLI empty targets and invalid records preserve nonzero results", () =>
  withFiles((dir, file) => {
    writeFileSync(file, "{}");
    const empty = join(dir, "empty");
    mkdirSync(empty);
    for (const target of [file, empty]) {
      const a = run("population-coverage", target, "--json"),
        b = run("completeness", target, "--json");
      assert.equal(a.status, 1);
      assert.equal(a.status, b.status);
      assert.deepEqual(JSON.parse(a.stdout), JSON.parse(b.stdout));
      assert.equal(JSON.parse(a.stdout).valid, false);
    }
  }));
test("CLI human output uses the descriptive name; legacy remains compatible", () =>
  withFiles((dir, file) => {
    const a = run("population-coverage", file);
    assert.equal(a.status, 0);
    assert.match(a.stdout, /Population coverage:/);
    assert.match(a.stdout, /mean population coverage/);
    assert.match(run("completeness", file).stdout, /Completeness:/);
    const help = run("population-coverage", "--help");
    assert.match(help.stdout, /disclosureos population-coverage/);
    assert.match(help.stdout, /not analytical readiness/);
    assert.doesNotMatch(help.stdout, /next fields to target/);
  }));

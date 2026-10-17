import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { computeWorksheet } from "./methods/compute.mjs";
import { verifyExample } from "./verify.mjs";

const read = async (file) => JSON.parse(await readFile(new URL(file, import.meta.url), "utf8"));
const method = await read("methods/review.json");
const worksheet = await read("worksheets/team-a.json");

test("retained example reproduces four results and checks all canonical contracts and byte pins", async () => {
  const result = await verifyExample();
  assert.equal(result.results, 4);
  assert.equal(result.comparisons.filter((entry) => entry.eligible).length, 1);
});

test("missing judgment withholds the result without redistributing weight", () => {
  const incomplete = structuredClone(worksheet);
  incomplete.criteria[2].rating = null;
  const result = computeWorksheet(method, incomplete);
  assert.equal(result.status, "unavailable");
  assert.equal(result.value, null);
  assert.equal(result.grade, null);
  assert.deepEqual(result.missing, ["method-detail"]);
  assert.equal(result.criteria[2].awarded, null);
  assert.equal(result.criteria[2].weight, 30);
});

test("zero is an authored judgment and is retained as zero", () => {
  const zero = structuredClone(worksheet);
  for (const criterion of zero.criteria) criterion.rating = 0;
  assert.equal(computeWorksheet(method, zero).value, 0);
  assert.equal(computeWorksheet(method, zero).grade, "d");
});

test("maximum score includes the scale endpoint", () => {
  const all = structuredClone(worksheet);
  for (const criterion of all.criteria) criterion.rating = 1;
  assert.equal(computeWorksheet(method, all).value, 100);
  assert.equal(computeWorksheet(method, all).grade, "a");
});

test("the exact grade boundary belongs to the higher band", () => {
  const boundary = structuredClone(worksheet);
  boundary.criteria[0].rating = 0;
  for (const criterion of boundary.criteria.slice(1)) criterion.rating = 1;
  assert.equal(computeWorksheet(method, boundary).value, 75);
  assert.equal(computeWorksheet(method, boundary).grade, "b");
});

test("foreign method revisions and malformed ratings fail rather than silently default", () => {
  const foreign = structuredClone(worksheet);
  foreign.methodVersion = "2.0.0";
  assert.throws(() => computeWorksheet(method, foreign), /identify this method/);
  const invalid = structuredClone(worksheet);
  invalid.criteria[0].rating = "1";
  assert.throws(() => computeWorksheet(method, invalid), /Invalid or unexplained/);
  invalid.criteria[0].rating = 1;
  invalid.criteria[0].rationale = "";
  assert.throws(() => computeWorksheet(method, invalid), /Invalid or unexplained/);
});

test("repeated criteria or an invalid denominator cannot create a plausible result", () => {
  const duplicate = structuredClone(worksheet);
  duplicate.criteria[1].id = duplicate.criteria[0].id;
  assert.throws(() => computeWorksheet(method, duplicate), /each criterion once/);
  const invalid = structuredClone(method);
  invalid.criteria[0].weight = 30;
  assert.throws(() => computeWorksheet(invalid, worksheet), /totaling 100/);
});

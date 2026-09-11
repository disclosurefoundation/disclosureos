import { evaluateCaseRecord } from "../../../packages/disclosureos-schema/dist/experimental/v2/index.js";
import { fixture, documents } from "./fixture.mjs";
const f = fixture();
const result = await evaluateCaseRecord(f.caseRecord, {
  documents: documents(f),
});
console.log(JSON.stringify(result, null, 2));
if (!result.success) process.exitCode = 1;

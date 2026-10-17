import { evaluateVocabularyBindings } from "../../../packages/disclosureos-schema/dist/experimental/v2/index.js";
import { fixture, documents } from "./fixture.mjs";
const example = fixture();
const result = await evaluateVocabularyBindings(example.bindings, {
  documents: documents(example),
});
console.log(JSON.stringify(result, null, 2));
if (!result.success) process.exitCode = 1;

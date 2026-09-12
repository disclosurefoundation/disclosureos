import { evaluateCaseLinks } from "../../../packages/disclosureos-schema/dist/experimental/v2/index.js";
import { fixture, documents } from "./fixture.mjs";
const f = fixture(),
  result = await evaluateCaseLinks(f.links, { documents: documents(f) });
console.log(JSON.stringify(result, null, 2));
if (!result.success) process.exitCode = 1;

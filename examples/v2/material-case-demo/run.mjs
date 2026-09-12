import { buildPublicMaterialCaseOutputs } from "@disclosureos/schema/experimental/v2";
import { fixture, bytes, documents, approval } from "./fixture.mjs";
const f = fixture(),
  result = await buildPublicMaterialCaseOutputs(bytes(f.presentation), {
    documents: documents(f),
    approval: approval(f),
  });
console.log(JSON.stringify(result, null, 2));
if (!result.success) process.exitCode = 1;

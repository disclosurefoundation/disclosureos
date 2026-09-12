import { buildPublicCaseOutputs } from '../../../packages/disclosureos-schema/dist/experimental/v2/index.js';
import { fixture, bytes, documents, approval } from './fixture.mjs';
const f = fixture();
const result = await buildPublicCaseOutputs(bytes(f.presentation), {
  documents: documents(f),
  approval: approval(f),
});
if (!result.success) throw new Error(result.code);
console.log(JSON.stringify(result, null, 2));

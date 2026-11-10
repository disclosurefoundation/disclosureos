import { createHash } from 'node:crypto';
export const bytes = v => Buffer.from(JSON.stringify(v, null, 2) + '\n');
export const sha = b => createHash('sha256').update(b).digest('hex');
export const snapshot = (v, family) => ({ documentId: v.id, schemaId: `urn:disclosureos:experimental:${family}:${v.schemaVersion}`, sha256: sha(bytes(v)) });
export function fixture() {
  const original = Buffer.from('synthetic original reading: 12\n');
  const derived = Buffer.from('synthetic retained reading: 12\n');
  const time = '2026-10-01T00:00:00Z';
  const first = {
    kind: 'observation', schemaVersion: '0.2.0', id: 'capture-a', status: 'draft', createdAt: time, updatedAt: time,
    eventTime: { state: 'unknown', reason: 'not_recorded' }, position: { state: 'unknown', reason: 'not_collected' },
    sources: [{ id: 'sensor', kind: 'instrument_data', access: 'restricted' }],
    products: [
      { id: 'original', kind: 'raw', access: 'restricted', format: 'text/plain', sourceRefs: ['source:sensor'], digest: { algorithm: 'sha256', value: sha(original) } },
      { id: 'derived', kind: 'derived', access: 'restricted', format: 'text/plain', generatedBy: 'process:prepare', digest: { algorithm: 'sha256', value: sha(derived) } },
    ],
    methods: [{ id: 'prepare', version: '1', description: 'Fictional extraction with no retained execution date.' }, { id: 'review', version: '1', description: 'Inspect declared source and measurement relationships.' }],
    frames: [], assertions: [],
    measurements: [{ id: 'reading', quantity: 'synthetic_reading', value: { value: 12, unit: '1', uncertainty: { kind: 'unknown', reason: 'not_characterized' } }, sourceRefs: ['product:derived'] }],
    processing: [{ id: 'prepare', methodRef: 'method:prepare', methodVersion: '1', performedBy: 'Fictional source preparer', performedAt: { state: 'unknown', reason: 'not_recorded' }, inputRefs: ['product:original'], outputRefs: ['product:derived'] }],
  };
  const history = { kind: 'claim_history', schemaVersion: '0.6.0', id: 'observation-review', observation: first,
    claims: [{ id: 'review-a', kind: 'assessment', topic: 'Reading interpretation', subject: { kind: 'measurement', measurementId: 'reading' }, recordedAt: time, status: 'assessed', outcome: 'inconclusive', evaluatedBy: 'Fictional reviewer', evaluatedAt: time, methodRef: 'method:review', methodVersion: '1', inputRefs: ['measurement:reading'], rationale: 'Retained values alone do not establish a physical explanation.' }],
  };
  const second = structuredClone(first); second.id = 'capture-b'; second.schemaVersion = '0.1.0'; second.processing[0].performedAt = time;
  const caseRecord = {
    kind: 'case_record', schemaVersion: '0.2.0', id: 'mixed-case', recordedAt: time, recordedBy: 'Fictional assembler',
    observationRefs: [snapshot(first, 'observation'), snapshot(second, 'observation')],
    entities: [{ kind: 'relationship', id: 'related', fromObservationId: first.id, toObservationId: second.id, relation: 'related_to',
      basis: { text: 'The source groups these two captures; common physical identity is not established.', provenance: { observationId: first.id, sourceRef: 'product:original', attributedTo: 'Fictional recorder', extractedBy: 'Fictional assembler', locator: { kind: 'page', page: 1 } } } }],
  };
  const caseRef = snapshot(caseRecord, 'case-record');
  const caseHistory = { kind: 'case_claim_history', schemaVersion: '0.2.0', id: 'case-review', caseRefs: [caseRef], claims: [{
    ...structuredClone(history.claims[0]), id: 'case-assessment', topic: 'Shared identity',
    subject: { kind: 'case_relation', from: { case: caseRef, observationId: first.id }, to: { case: caseRef, observationId: second.id }, relation: 'same_object' },
    inputRefs: [], observationInputRefs: [{ case: caseRef, observationId: first.id, ref: 'measurement:reading' }],
    methodRef: { case: caseRef, observationId: first.id, methodId: 'review' },
  }] };
  const request = review => ({ kind: 'claim_review_evaluation', schemaVersion: '0.1.0', id: `evaluate-${review.id}`, review: snapshot(review, review.kind === 'claim_history' ? 'claim-history' : 'case-claim-history') });
  const documents = new Map([first, second, caseRecord].map(v => [sha(bytes(v)), bytes(v)]));
  const assets = new Map([['product:original', original], ['product:derived', derived]]);
  return { first, second, history, caseRecord, caseHistory, documents, assets, request };
}

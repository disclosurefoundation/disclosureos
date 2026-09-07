import { describe, expect, it } from 'vitest';
import { parseExperimentalClaimHistory } from '../experimental/v2';

const observation = {
  kind: 'observation', schemaVersion: '0.1.0', id: 'o', status: 'draft',
  createdAt: '2026-09-07T00:00:00Z', updatedAt: '2026-09-07T00:00:00Z',
  eventTime: { state: 'unknown', reason: 'not_recorded' }, position: { state: 'unknown', reason: 'not_recorded' },
  sources: [{ id: 's', kind: 'testimony', access: 'unknown' }], products: [], methods: [{id:'review',version:'1'}],
  frames: [], assertions: [], measurements: [], processing: [],
};
const source = { id:'a', kind:'source_assertion', recordedAt:'2026-09-07T00:00:00Z', topic:'synthetic motion',
  subject:{kind:'observation'}, text:'The source called this confirmed.', reportedLevel:'confirmed',
  provenance:{sourceRef:'source:s',extractedBy:'agent:extractor'} };
const envelope = (claims: unknown[]) => ({kind:'claim_history',schemaVersion:'0.1.0',id:'h',observation,claims});

describe('experimental claim history', () => {
  it('preserves a historical confirmed statement without an invented speaker or confidence', () => {
    const input = envelope([source]);
    const result = parseExperimentalClaimHistory(input);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toEqual(input);
    expect(result.checks.profile).toBe('not_checked');
  });
  it('does not allow an assessed claim to omit its evaluator', () => {
    const result = parseExperimentalClaimHistory(envelope([{...source,kind:'assessment',status:'assessed',outcome:'confirmed'}]));
    expect(result.checks.structural).toBe('failed');
    expect(result.checks.semantic).toBe('not_checked');
  });
  it('keeps unassessed distinct from assessed absence', () => {
    const pending = {id:'pending',kind:'assessment',recordedAt:source.recordedAt,topic:source.topic,subject:source.subject,
      status:'unassessed',inputRefs:['claim:a'],rationale:'Awaiting review.'};
    const result = parseExperimentalClaimHistory(envelope([source,pending]));
    expect(result.success).toBe(true);
    if(result.success) expect(result.data.claims[1]).not.toHaveProperty('outcome');
  });
  it('requires superseded statements to remain locally resolvable', () => {
    const result = parseExperimentalClaimHistory(envelope([{...source,supersedes:['claim:missing']}]));
    expect(result.issues).toEqual(expect.arrayContaining([expect.objectContaining({code:'REF.LOCAL_RESOLUTION',pointer:'/claims/0/supersedes/0'})]));
  });
});

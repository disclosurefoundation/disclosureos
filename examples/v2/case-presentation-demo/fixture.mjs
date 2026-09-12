import {
  fixture as assessments,
  refresh as refreshAssessments,
  bytes,
  digest,
  documents as assessmentDocuments,
} from '../case-assessment-demo/fixture.mjs';
export { bytes, digest };
export function refresh(f) {
  refreshAssessments(f);
  f.presentation.caseRef = structuredClone(f.history.caseRefs[0]);
  f.presentation.findings.forEach((item) => {
    item.historyRef = {
      documentId: f.history.id,
      schemaId: 'urn:disclosureos:experimental:case-claim-history:0.1.0',
      sha256: digest(bytes(f.history)),
    };
  });
  return f;
}
export function fixture() {
  const f = assessments();
  // A fictional attachment inventory. Original artifact bytes are not sent to public projection.
  f.first.sources[0].digest = {
    algorithm: 'sha256',
    value: digest(new TextEncoder().encode('Fictional station log.')),
  };
  f.presentation = {
    kind: 'case_presentation',
    schemaVersion: '0.1.0',
    publicId: 'two-station-control',
    caseRef: f.history.caseRefs[0],
    title: 'Two station records',
    summary: 'A fictional case showing separate observations and competing reviews.',
    updatedAt: '2026-09-12T12:00:00Z',
    status: 'published',
    citations: [
      { id: 'case', label: 'Fictional case record', target: { kind: 'case' } },
      {
        id: 'log',
        label: 'Station A log',
        description: 'Public citation to a fictional source.',
        target: { kind: 'artifact', observationId: 'capture-a', ref: 'source:log' },
      },
    ],
    blocks: [
      {
        id: 'overview',
        heading: 'What the records describe',
        text: 'Two observations are grouped for review. Their order does not establish a shared object.',
        citationIds: ['case', 'log'],
      },
    ],
    findings: [
      {
        id: 'review-a',
        claimId: 'finding-revised',
        title: 'Review remains inconclusive',
        summary: 'The revised assessment considers both reported conclusions.',
        reviewerLabel: 'Reviewer A',
        citationIds: ['case'],
      },
      {
        id: 'pending',
        claimId: 'corroboration-pending',
        title: 'Independence has not been assessed',
        summary: 'The case does not establish independent corroboration.',
        reviewerLabel: 'Review pending',
        citationIds: ['case'],
      },
    ],
    attachments: [
      {
        id: 'station-log',
        kind: 'data',
        role: 'supporting',
        observationId: 'capture-a',
        ref: 'source:log',
        sha256: f.first.sources[0].digest.value,
        caption: 'Fictional station log',
        credit: 'DisclosureOS example',
        rights: 'Fictional example for software testing.',
        citationIds: ['log'],
      },
    ],
    featuredAttachmentId: 'station-log',
    notices: [
      {
        id: 'scope',
        kind: 'scope',
        text: 'Synthetic demonstration. A supplied assessment outcome is not a scientific finding by DisclosureOS.',
      },
    ],
  };
  return refresh(f);
}
export const documents = (f) =>
  new Map([...assessmentDocuments(f), [digest(bytes(f.history)), bytes(f.history)]]);
export const approval = (f) => ({
  presentationSha256: digest(bytes(f.presentation)),
  policyVersion: 'fictional-publication-policy-1',
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import {
  buildPublicCase,
  buildPublicCaseOutputs,
  parseCasePresentation,
  casePresentationJsonSchema,
} from '../packages/disclosureos-schema/dist/experimental/v2/index.js';
import {
  fixture,
  refresh,
  bytes,
  digest,
  documents,
  approval,
} from '../examples/v2/case-presentation-demo/fixture.mjs';
import { fixture as linksFixture } from '../examples/v2/case-links-demo/fixture.mjs';
const run = (f, opts = {}) =>
  buildPublicCaseOutputs(bytes(f.presentation), {
    documents: documents(f),
    approval: approval(f),
    ...opts,
  });

test('public projection preserves editorial selections and assessment status, with no private reference shape', async () => {
  const r = await run(fixture());
  assert.equal(r.success, true);
  assert.equal(r.data.findings[0].outcome, 'inconclusive');
  assert.equal(r.data.findings[0].revision, 'current');
  assert.equal(r.data.findings[1].status, 'unassessed');
  assert.equal('outcome' in r.data.findings[1], false);
  assert.equal(r.data.attachments[0].href, '/case-assets/two-station-control/station-log');
  assert.equal('caseRef' in r.data, false);
  assert.equal('target' in r.data.citations[0], false);
  assert.equal('historyRef' in r.data.findings[0], false);
  assert.equal('sha256' in r.data.attachments[0], false);
  assert.deepEqual(JSON.parse(r.json), r.data);
  assert.equal(r.metadata.title, r.data.title);
  assert.equal(r.search.publicId, r.data.publicId);
});
test('without a separate server approval nothing is public', async () => {
  assert.deepEqual(await run(fixture(), { approval: undefined }), {
    success: false,
    code: 'APPROVAL_REQUIRED',
  });
});
test('approval pins exact bytes including whitespace', async () => {
  const f = fixture(),
    opts = { documents: documents(f), approval: approval(f) };
  f.presentation.summary += ' Changed';
  assert.equal((await run(f, opts)).code, 'APPROVAL_REQUIRED');
  const original = fixture();
  assert.equal(
    (
      await buildPublicCase(bytes(original.presentation).slice(0, -1), {
        documents: documents(original),
        approval: approval(original),
      })
    ).code,
    'APPROVAL_REQUIRED',
  );
});
for (const status of ['draft', 'withdrawn'])
  test(`${status} cannot yield a public payload`, async () => {
    const f = fixture();
    f.presentation.status = status;
    f.presentation.notices.push({
      id: 'withdrawal',
      kind: 'withdrawal',
      text: 'Removed from publication.',
    });
    assert.deepEqual(await run(f), { success: false, code: 'NOT_PUBLISHED' });
  });
test('archival state requires its public notice and remains explicitly archived', async () => {
  const f = fixture();
  f.presentation.status = 'archived';
  assert.equal((await run(f)).code, 'INVALID_PRESENTATION');
  f.presentation.notices.push({
    id: 'archive',
    kind: 'archive',
    text: 'Retained as a historical record.',
  });
  const r = await run(f);
  assert.equal(r.data.status, 'archived');
  assert.match(r.markdown, /historical record/);
});
for (const [name, mutate] of [
  [
    'private root properties',
    (p) => {
      p.internalNotes = 'SECRET';
    },
  ],
  [
    'private nested properties',
    (p) => {
      p.blocks[0].privateName = 'SECRET';
    },
  ],
  [
    'unknown citation',
    (p) => {
      p.blocks[0].citationIds = ['absent'];
    },
  ],
  [
    'duplicate citation selection',
    (p) => {
      p.blocks[0].citationIds = ['case', 'case'];
    },
  ],
  [
    'duplicate IDs',
    (p) => {
      p.blocks.push(structuredClone(p.blocks[0]));
    },
  ],
  [
    'missing featured attachment',
    (p) => {
      p.featuredAttachmentId = 'absent';
    },
  ],
  [
    'image without alt text',
    (p) => {
      p.attachments[0].kind = 'image';
    },
  ],
  [
    'non-image thumbnail',
    (p) => {
      p.attachments[0].role = 'thumbnail';
    },
  ],
  [
    'invalid dimensions',
    (p) => {
      p.attachments[0].dimensions = { width: 0, height: 10 };
    },
  ],
  [
    'duration on data',
    (p) => {
      p.attachments[0].durationSeconds = 10;
    },
  ],
  [
    'unsafe public route identifier',
    (p) => {
      p.publicId = '../secret';
    },
  ],
  [
    'URL in place of an artifact reference',
    (p) => {
      p.attachments[0].ref = 'javascript:alert(1)';
    },
  ],
  [
    'unsupported contract',
    (p) => {
      p.schemaVersion = '0.2.0';
    },
  ],
  [
    'invalid date',
    (p) => {
      p.updatedAt = '2026-02-30T12:00:00Z';
    },
  ],
])
  test(`reject ${name}`, async () => {
    const f = fixture();
    mutate(f.presentation);
    assert.equal((await run(f)).code, 'INVALID_PRESENTATION');
  });
for (const [name, mutate] of [
  [
    'out-of-case source',
    (p) => {
      p.citations[1].target.observationId = 'absent';
    },
  ],
  [
    'missing source',
    (p) => {
      p.citations[1].target.ref = 'source:absent';
    },
  ],
  [
    'mismatched artifact digest',
    (p) => {
      p.attachments[0].sha256 = '0'.repeat(64);
    },
  ],
  [
    'missing finding',
    (p) => {
      p.findings[0].claimId = 'absent';
    },
  ],
  [
    'source assertion as assessment',
    (p) => {
      p.findings[0].claimId = 'source-conclusion';
    },
  ],
  [
    'wrong snapshot identity',
    (p) => {
      p.caseRef.documentId = 'absent';
    },
  ],
  [
    'wrong snapshot digest',
    (p) => {
      p.caseRef.sha256 = '0'.repeat(64);
    },
  ],
])
  test(`fail closed for ${name}`, async () => {
    const f = fixture();
    mutate(f.presentation);
    assert.deepEqual(await run(f), { success: false, code: 'INVALID_REFERENCES' });
  });
test('missing dependency bytes and malformed UTF-8 yield constant failure only', async () => {
  const f = fixture();
  for (const entry of documents(f)) {
    const map = documents(f);
    map.delete(entry[0]);
    assert.equal((await run(f, { documents: map })).code, 'INVALID_REFERENCES');
  }
  const bad = new Uint8Array([255]);
  f.presentation.caseRef.sha256 = digest(bad);
  const map = documents(f);
  map.set(digest(bad), bad);
  assert.deepEqual(await run(f, { documents: map }), {
    success: false,
    code: 'INVALID_REFERENCES',
  });
});
test('same observation ID in another case revision cannot satisfy a finding subject', async () => {
  const f = fixture();
  const map = documents(f);
  const different = structuredClone(f.caseRecord);
  different.recordedBy += ' revised';
  const hash = digest(bytes(different));
  f.presentation.caseRef.sha256 = hash;
  map.set(hash, bytes(different));
  assert.deepEqual(await run(f, { documents: map }), {
    success: false,
    code: 'INVALID_REFERENCES',
  });
});
test('superseded selections are labeled instead of silently promoted to current', async () => {
  const f = fixture();
  f.presentation.findings[0].claimId = 'finding-original';
  const r = await run(f);
  assert.equal(r.data.findings[0].revision, 'superseded');
  assert.match(r.markdown, /superseded/);
});
test('reported assessment outcomes are copied, never recomputed as scientific certification', async () => {
  const f = fixture();
  f.history.claims.find((c) => c.id === 'finding-revised').outcome = 'confirmed';
  refresh(f);
  const r = await run(f);
  assert.equal(r.data.findings[0].outcome, 'confirmed');
  assert.match(r.data.notices[0].text, /not a scientific finding/);
});
test('private records and all their nested labels stay absent from every public output', async () => {
  const f = fixture();
  const secret = 'PRIVATE_CANARY_9f12';
  f.caseRecord.recordedBy = secret;
  f.first.sources[0].uri = `https://private.invalid/${secret}`;
  f.first.sources[0].title = secret;
  for (const c of f.history.claims)
    if (c.evaluatedBy === 'Fictional reviewer A') c.evaluatedBy = secret;
  f.history.claims.find((c) => c.id === 'finding-revised').rationale = secret;
  refresh(f);
  const map = documents(f);
  map.set('unrelated', new TextEncoder().encode(secret));
  const r = await run(f, { documents: map });
  assert.equal(r.success, true);
  assert.equal(JSON.stringify(r).includes(secret), false);
  // Even failed references do not expose offending values or error pointers.
  f.presentation.citations[1].target.observationId = secret;
  assert.equal(JSON.stringify(await run(f)).includes(secret), false);
});
test('a plain access declaration is neither approval nor a source URL for public media', async () => {
  const f = fixture();
  f.first.sources[0].access = 'public';
  refresh(f);
  assert.equal((await run(f, { approval: undefined })).code, 'APPROVAL_REQUIRED');
  const r = await run(f);
  assert.equal(r.success, true);
  assert.ok(r.data.attachments.every((a) => a.href.startsWith('/case-assets/')));
});
test('restricted source may have an approved citation without disclosing source details or granting file access', async () => {
  const f = fixture();
  f.first.sources[0].access = 'restricted';
  refresh(f);
  f.presentation.attachments = [];
  delete f.presentation.featuredAttachmentId;
  const r = await run(f);
  assert.equal(r.success, true);
  assert.equal(r.data.citations[1].label, 'Station A log');
  assert.equal(r.data.attachments.length, 0);
});
test('inputs and approval are captured before asynchronous work', async () => {
  const f = fixture(),
    b = bytes(f.presentation),
    map = documents(f),
    a = approval(f);
  const promise = buildPublicCase(b, { documents: map, approval: a });
  b.fill(0);
  for (const value of map.values()) value.fill(0);
  a.presentationSha256 = '0'.repeat(64);
  assert.equal((await promise).success, true);
});
test('plain text becomes escaped Markdown, with only generated attachment routes', async () => {
  const f = fixture();
  f.presentation.blocks[0].text = '<script>alert(1)</script> [run](javascript:evil)';
  const r = await run(f);
  assert.equal(r.success, true);
  assert.ok(r.markdown.includes('\\<script\\>'));
  assert.ok(r.markdown.includes('\\[run\\]\\(javascript\\:evil\\)'));
  assert.equal(r.data.blocks[0].text, f.presentation.blocks[0].text);
});
test('no optional content is invented for a narrative-only case', async () => {
  const f = fixture();
  f.presentation.findings = [];
  f.presentation.attachments = [];
  delete f.presentation.featuredAttachmentId;
  assert.equal((await run(f)).success, true);
});
test('linked supplement citations resolve only through the pinned case-links document', async () => {
  const f = fixture(),
    s = linksFixture();
  f.first = s.first;
  f.second = s.second;
  f.caseRecord = s.caseRecord;
  f.presentation.findings = [];
  f.presentation.attachments = [];
  delete f.presentation.featuredAttachmentId;
  f.presentation.caseRef = s.links.caseRef;
  const ref = {
    documentId: s.links.id,
    schemaId: 'urn:disclosureos:experimental:case-links:0.1.0',
    sha256: digest(bytes(s.links)),
  };
  f.presentation.linksRef = ref;
  f.presentation.citations.push({
    id: 'context',
    label: 'Public setting citation',
    target: { kind: 'supplement', linkId: s.links.links[0].id },
  });
  const map = new Map(
    [s.first, s.second, s.caseRecord, s.links, s.context, s.entities, s.intake].map((v) => [
      digest(bytes(v)),
      bytes(v),
    ]),
  );
  assert.equal((await run(f, { documents: map })).success, true);
  f.presentation.citations.at(-1).target.linkId = 'absent';
  assert.equal((await run(f, { documents: map })).code, 'INVALID_REFERENCES');
});
test('neither projection nor output generation fetches URLs', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = () => {
    throw new Error('network');
  };
  try {
    assert.equal((await run(fixture())).success, true);
  } finally {
    globalThis.fetch = original;
  }
});
test('emitted schema and committed presentation/output are reproducible', async () => {
  const json = JSON.parse(
    readFileSync(
      new URL(
        '../packages/disclosureos-schema/schema/experimental/case-presentation-0.1.0.schema.json',
        import.meta.url,
      ),
    ),
  );
  assert.deepEqual(json, casePresentationJsonSchema());
  const ajv = new Ajv2020({ strict: false });
  addFormats(ajv);
  assert.equal(ajv.compile(json)(fixture().presentation), true);
  const f = fixture();
  assert.equal(parseCasePresentation(f.presentation).success, true);
  assert.deepEqual(
    JSON.parse(
      readFileSync(
        new URL('../examples/v2/case-presentation-demo/presentation.json', import.meta.url),
      ),
    ),
    f.presentation,
  );
  assert.deepEqual(
    JSON.parse(
      readFileSync(new URL('../examples/v2/case-presentation-demo/public.json', import.meta.url)),
    ),
    (await run(f)).data,
  );
});

test('media metadata and a separately approved thumbnail are retained without copying storage URLs', async () => {
  const f = fixture();
  const a = f.presentation.attachments[0];
  a.mimeType = 'text/plain';
  a.fileSizeBytes = 22;
  a.thumbnailAttachmentId = 'preview';
  f.presentation.attachments.push({
    ...structuredClone(a),
    id: 'preview',
    kind: 'image',
    role: 'thumbnail',
    mimeType: 'image/png',
    alt: 'Fictional preview',
    dimensions: { width: 100, height: 100 },
    thumbnailAttachmentId: undefined,
  });
  const r = await run(f);
  assert.equal(r.success, true);
  assert.equal(r.data.attachments[0].thumbnailAttachmentId, 'preview');
  assert.equal(r.data.attachments[0].fileSizeBytes, 22);
  assert.equal(r.data.attachments[1].dimensions.height, 100);
  assert.match(r.data.assessmentNotice, /do not independently verify/);
  f.presentation.attachments[1].thumbnailAttachmentId = 'preview';
  assert.equal((await run(f)).code, 'INVALID_PRESENTATION');
});
test('all public surfaces retain a shared privacy boundary after approval changes', async () => {
  const f = fixture(),
    granted = approval(f);
  f.presentation.title = 'UNAPPROVED_PRIVATE_TITLE';
  const r = await run(f, { approval: granted });
  assert.deepEqual(r, { success: false, code: 'APPROVAL_REQUIRED' });
  assert.equal(JSON.stringify(r).includes('UNAPPROVED'), false);
});

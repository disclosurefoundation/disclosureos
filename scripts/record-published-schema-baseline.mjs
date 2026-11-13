// Read registry tarballs, verify SRI, and retain immutable schema identities.
// This script never installs, executes, versions or publishes package contents.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { verifyPublishedSchemaIdentities } from './release-candidate.mjs';
const [version, mode] = process.argv.slice(2);
assert.match(version ?? '', /^2\.0\.0-beta\.\d+$/);
assert.ok(mode === undefined || mode === '--write', 'Usage: record-published-schema-baseline.mjs <beta-version> [--write]');
const path = new URL('../docs/releases/published-schema-identities.json', import.meta.url);
const baseline = JSON.parse(readFileSync(path));
const temp = mkdtempSync(join(tmpdir(), 'published-schema-baseline-'));
const entries = [], current = [];
const get = async url => {const r=await fetch(url,{signal:AbortSignal.timeout(30000)});assert.equal(r.status,200,url);return r};
try {
  for (const family of ['records','observables','origins','instruments','scoring','schema','cli']) {
    const name = `@disclosureos/${family}`;
    const metadata = await (await get(`https://registry.npmjs.org/${encodeURIComponent(name)}/${version}`)).json();
    assert.equal(metadata.name,name); assert.equal(metadata.version,version);
    const url = new URL(metadata.dist.tarball);
    assert.equal(url.origin,'https://registry.npmjs.org');
    const data = Buffer.from(await (await get(url)).arrayBuffer());
    const sri = `sha512-${createHash('sha512').update(data).digest('base64')}`;
    assert.equal(sri,metadata.dist.integrity,`${name}: registry integrity`);
    const archive = join(temp,`${family}.tgz`); writeFileSync(archive,data);
    const paths=execFileSync('tar',['-tzf',archive],{encoding:'utf8'}).trim().split('\n');
    const schemas=[];
    for(const member of paths.filter(p=>p.startsWith('package/schema/')&&p.endsWith('.json')).sort()) {
      assert.ok(!member.split('/').includes('..'));
      const bytes=execFileSync('tar',['-xOf',archive,member]);
      const {$id:id}=JSON.parse(bytes);assert.ok(typeof id==='string'&&id.length);
      schemas.push({path:member.slice(8),id,sha256:createHash('sha256').update(bytes).digest('hex')});
      current.push({path:`${name}/${member}`,bytes});
    }
    entries.push({name,version,integrity:sri,schemas});
  }
  // Reject conflicts with earlier published identities before changing the baseline.
  verifyPublishedSchemaIdentities(baseline,current);
  for(const entry of entries) {
    const existing=baseline.packages.find(p=>p.name===entry.name&&p.version===version);
    if(existing) assert.deepEqual(existing,entry,`${entry.name}: published baseline drift`);
    else baseline.packages.push(entry);
  }
  if(mode==='--write')writeFileSync(path,JSON.stringify(baseline,null,2)+'\n');
  console.log(JSON.stringify({version,packages:entries.length,schemas:current.length,registryIntegrity:'passed',priorIdentities:'unchanged',written:mode==='--write',publication:'not-performed'},null,2));
} finally {rmSync(temp,{recursive:true,force:true})}

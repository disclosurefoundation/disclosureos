import { parseExperimentalClaimHistory } from '@disclosureos/records/experimental/v2';
import type { ClaimHistoryIssueCode, ExperimentalClaimHistory, HistoricalClaim } from '@disclosureos/records/experimental/v2';

export const ASSESSMENT_DOCUMENTATION_PROFILE = Object.freeze({
  id: 'urn:disclosureos:experimental:profile:assessment-documentation', version: '0.1.0', scope: 'documentary_only',
} as const);
type Status = 'passed' | 'failed' | 'not_checked';
export type DocumentationIssueCode = ClaimHistoryIssueCode | 'PROFILE.NO_ASSESSMENTS' | 'PROFILE.UNASSESSED'
  | 'PROFILE.INPUTS_REQUIRED' | 'PROFILE.METHOD_CONTEXT' | 'PROFILE.LOCATOR_REQUIRED' | 'PROFILE.DIGEST_REQUIRED'
  | 'PROFILE.MEASUREMENT_REQUIRED' | 'PROFILE.MEASUREMENT_UNCERTAINTY' | 'PROFILE.INSTRUMENT_PRODUCT_REQUIRED'
  | 'PROFILE.EVENT_TIME' | 'PROFILE.FRAME_CONTEXT' | 'EXTERNAL.ASSET_UNAVAILABLE' | 'EXTERNAL.DIGEST_MISMATCH'
  | 'EXTERNAL.HASH_UNAVAILABLE' | 'EXTERNAL.EMPTY_ASSET';
export interface DocumentationIssue {
  code: DocumentationIssueCode; stage: 'structural' | 'semantic' | 'profile' | 'external';
  severity: 'error' | 'warning'; pointer: string; message: string;
}
export interface AssetCheck { ref: string; status: Status; expectedSha256?: string; actualSha256?: string }
export interface AssessmentDocumentation {
  claimRef: string; status: Status; inputRefs: string[]; sourceRefs: string[]; productRefs: string[];
  measurementRefs: string[]; assets: AssetCheck[]; issues: DocumentationIssue[];
}
export interface DocumentationOptions {
  /** Exact complete bytes keyed by source:/product: reference. No URLs are fetched. */
  assets?: ReadonlyMap<string, Uint8Array>;
}
export interface DocumentationResult {
  success: boolean;
  profile: typeof ASSESSMENT_DOCUMENTATION_PROFILE;
  contract: ReturnType<typeof parseExperimentalClaimHistory>['contract'];
  checks: { structural: Status; semantic: Status; profile: Status; external: Status };
  scientific: 'not_checked'; locatorContents: 'not_checked'; methodExecution: 'not_checked';
  assessments: AssessmentDocumentation[]; issues: DocumentationIssue[];
}

type Observation = ExperimentalClaimHistory['observation'];
function inventories(observation: Observation, claims: HistoricalClaim[]) {
  return {
    sources: new Map(observation.sources.map((v, i) => [`source:${v.id}`, { value: v, pointer: `/observation/sources/${i}` }])),
    products: new Map(observation.products.map((v, i) => [`product:${v.id}`, { value: v, pointer: `/observation/products/${i}` }])),
    methods: new Map(observation.methods.map((v, i) => [`method:${v.id}`, { value: v, pointer: `/observation/methods/${i}` }])),
    frames: new Map(observation.frames.map((v, i) => [`frame:${v.id}`, { value: v, pointer: `/observation/frames/${i}` }])),
    measurements: new Map(observation.measurements.map((v, i) => [`measurement:${v.id}`, { value: v, pointer: `/observation/measurements/${i}` }])),
    assertions: new Map(observation.assertions.map((v, i) => [`assertion:${v.id}`, { value: v, pointer: `/observation/assertions/${i}` }])),
    processes: new Map(observation.processing.map((v, i) => [`process:${v.id}`, { value: v, pointer: `/observation/processing/${i}` }])),
    claims: new Map(claims.map((v, i) => [`claim:${v.id}`, { value: v, pointer: `/claims/${i}` }])),
  };
}

/** Documentary preflight plus local byte integrity, not scientific or locator-content verification. */
export async function evaluateAssessmentDocumentation(input: unknown, options: DocumentationOptions = {}): Promise<DocumentationResult> {
  const parsed = parseExperimentalClaimHistory(input);
  const result: DocumentationResult = {
    success: false, profile: ASSESSMENT_DOCUMENTATION_PROFILE, contract: parsed.contract,
    checks: { ...parsed.checks, profile: 'not_checked' }, scientific: 'not_checked', locatorContents: 'not_checked', methodExecution: 'not_checked',
    assessments: [], issues: [...parsed.issues],
  };
  if (!parsed.success) return result;
  const observation = parsed.data.observation;
  const inv = inventories(observation, parsed.data.claims);
  // Snapshot caller-owned bytes before the first asynchronous operation.
  const assets = new Map([...options.assets ?? []].map(([ref, bytes]) => [ref, Uint8Array.from(bytes)]));
  const hashes = new Map<string, Promise<string | undefined>>();
  function hash(ref: string): Promise<string | undefined> {
    const cached = hashes.get(ref);
    if (cached) return cached;
    const bytes = assets.get(ref);
    const pending = (async () => {
      if (!bytes) return undefined;
      try {
        const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
        return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
      } catch { return undefined; }
    })();
    hashes.set(ref, pending);
    return pending;
  }
  // Primary support excludes uncertainty annotations and revision links: neither establishes measurement lineage.
  function dependencies(ref: string): string[] {
    const claim = inv.claims.get(ref)?.value;
    if (claim) return claim.kind === 'source_assertion' ? [claim.provenance.sourceRef] : claim.inputRefs;
    const measurement = inv.measurements.get(ref)?.value;
    if (measurement) return measurement.sourceRefs;
    const assertion = inv.assertions.get(ref)?.value;
    if (assertion) return [assertion.provenance.sourceRef];
    const product = inv.products.get(ref)?.value;
    if (product) return product.kind === 'raw' ? product.sourceRefs : [product.generatedBy];
    return inv.processes.get(ref)?.value.inputRefs ?? [];
  }
  function closure(roots: readonly string[]): Set<string> {
    const seen = new Set<string>();
    const queue = [...roots];
    for (let i = 0; i < queue.length; i++) {
      const ref = queue[i]!;
      if (seen.has(ref)) continue;
      seen.add(ref);
      queue.push(...dependencies(ref));
    }
    return seen;
  }
  for (const claimRef of parsed.currentClaimRefs) {
    const entry = inv.claims.get(claimRef)!;
    const claim = entry.value;
    if (claim.kind !== 'assessment') continue;
    const report: AssessmentDocumentation = { claimRef, status: 'not_checked', inputRefs: [...claim.inputRefs], sourceRefs: [], productRefs: [], measurementRefs: [], assets: [], issues: [] };
    const issue = (code: DocumentationIssueCode, pointer: string, message: string, stage: 'profile' | 'external' = 'profile', severity: 'error' | 'warning' = 'error') => report.issues.push({code, pointer, message, stage, severity});
    if (claim.status === 'unassessed') {
      issue('PROFILE.UNASSESSED', `${entry.pointer}/status`, 'No evaluator assessment has been made.', 'profile', 'warning');
      result.assessments.push(report);
      continue;
    }
    const support = closure(claim.inputRefs);
    report.sourceRefs = [...support].filter(ref => inv.sources.has(ref));
    report.productRefs = [...support].filter(ref => inv.products.has(ref));
    report.measurementRefs = [...support].filter(ref => inv.measurements.has(ref));
    const requiredAssets = new Set<string>(report.productRefs);
    const located = new Set<string>();
    function checkMethod(ref: string): void {
      const method = inv.methods.get(ref);
      if (method && !method.value.description) issue('PROFILE.METHOD_CONTEXT', `${method.pointer}/description`, 'The referenced method needs a declared description; correctness is not verified.');
    }
    checkMethod(claim.methodRef);
    for (const ref of support) {
      const statement = inv.claims.get(ref);
      const assertion = inv.assertions.get(ref);
      const provenance = statement?.value.kind === 'source_assertion' ? statement.value.provenance : assertion?.value.provenance;
      const path = statement?.pointer ?? assertion?.pointer;
      if (provenance && path) {
        requiredAssets.add(provenance.sourceRef);
        if (!provenance.locator) issue('PROFILE.LOCATOR_REQUIRED', `${path}/provenance/locator`, 'A supporting statement or value assertion requires a source passage locator.');
        else located.add(provenance.sourceRef);
      }
      const process = inv.processes.get(ref)?.value;
      if (process) checkMethod(process.methodRef);
      const measurement = inv.measurements.get(ref)?.value;
      if (measurement?.selection) checkMethod(measurement.selection.methodRef);
      if (statement?.value.kind === 'assessment' && statement.value.status === 'assessed') checkMethod(statement.value.methodRef);
    }
    // A non-instrument source is documentary content, not merely an acquisition descriptor.
    for (const ref of report.sourceRefs) {
      const source = inv.sources.get(ref)!;
      if (source.value.kind === 'instrument_data') continue;
      requiredAssets.add(ref);
      if (!located.has(ref)) issue('PROFILE.LOCATOR_REQUIRED', source.pointer, 'A directly cited documentary source needs a passage locator through an assertion.');
    }
    if (!claim.inputRefs.length || !requiredAssets.size) issue('PROFILE.INPUTS_REQUIRED', `${entry.pointer}/inputRefs`, 'Assessment requires traceable source content or data products; descriptors alone are insufficient.');
    if (claim.outcome === 'confirmed') {
      const measurementSubject = claim.subject.kind === 'measurement' ? `measurement:${claim.subject.measurementId}` : undefined;
      const relevant = report.measurementRefs.filter(ref => !measurementSubject || ref === measurementSubject);
      if (!relevant.length) issue('PROFILE.MEASUREMENT_REQUIRED', `${entry.pointer}/inputRefs`, 'A confirmed declaration requires a measurement input matching its subject.');
      if (observation.eventTime.state !== 'known' && observation.eventTime.state !== 'approximate') issue('PROFILE.EVENT_TIME', '/observation/eventTime', 'Instrument documentation requires a supplied event time; an archival unknown remains valid outside this profile.');
      for (const ref of relevant) {
        const measurement = inv.measurements.get(ref)!;
        if (measurement.value.value.uncertainty.kind === 'unknown') issue('PROFILE.MEASUREMENT_UNCERTAINTY', `${measurement.pointer}/value/uncertainty`, 'Measurement uncertainty has not been characterized in the record.');
        const lineage = closure([ref]);
        if (![...lineage].some(item => {
          const raw = inv.products.get(item)?.value;
          return raw?.kind === 'raw' && raw.sourceRefs.some(source => inv.sources.get(source)?.value.kind === 'instrument_data');
        })) issue('PROFILE.INSTRUMENT_PRODUCT_REQUIRED', `${measurement.pointer}/sourceRefs`, 'Measurement support must reach a raw product declaring an instrument-data source.');
        const hasProductLocator = [...lineage].some(item => {
          const assertion = inv.assertions.get(item)?.value;
          return assertion?.provenance.sourceRef.startsWith('product:') && assertion.provenance.locator !== undefined;
        });
        if (!hasProductLocator) issue('PROFILE.LOCATOR_REQUIRED', `${measurement.pointer}/sourceRefs`, 'Measurement needs a value assertion locating its value within a supporting product.');
        if (measurement.value.frameRef) {
          const frame = inv.frames.get(measurement.value.frameRef)!;
          if (frame.value.definition.state === 'unknown') issue('PROFILE.FRAME_CONTEXT', `${frame.pointer}/definition`, 'The declared measurement frame is unknown.');
        }
        // Quantified uncertainty is supplementary provenance, never a substitute for primary product lineage.
        if (measurement.value.value.uncertainty.kind !== 'unknown') for (const source of measurement.value.value.uncertainty.sourceRefs) requiredAssets.add(source);
      }
    }
    for (const ref of requiredAssets) {
      const asset = inv.sources.get(ref) ?? inv.products.get(ref);
      if (!asset) continue; // Local resolution was already checked by the records parser.
      const digest = asset.value.digest?.value;
      const check: AssetCheck = {ref, status:'not_checked'};
      if (digest) check.expectedSha256 = digest;
      report.assets.push(check);
      if (!digest) { issue('PROFILE.DIGEST_REQUIRED', `${asset.pointer}/digest`, 'Supporting content requires a pinned SHA-256 digest.'); continue; }
      const bytes = assets.get(ref);
      if (!bytes) { issue('EXTERNAL.ASSET_UNAVAILABLE', asset.pointer, `No local bytes supplied for ${ref}; a URI or digest alone is not verification.`, 'external', 'warning'); continue; }
      if (!bytes.length) { check.status = 'failed'; issue('EXTERNAL.EMPTY_ASSET', asset.pointer, 'Empty content cannot support this assessment.', 'external'); continue; }
      const actual = await hash(ref);
      if (!actual) { issue('EXTERNAL.HASH_UNAVAILABLE', asset.pointer, 'SHA-256 verification is unavailable in this runtime.', 'external', 'warning'); continue; }
      check.actualSha256 = actual;
      check.status = actual === digest ? 'passed' : 'failed';
      if (check.status === 'failed') issue('EXTERNAL.DIGEST_MISMATCH', `${asset.pointer}/digest`, 'Supplied bytes do not match the pinned SHA-256 digest.', 'external');
    }
    report.status = report.issues.some(item => item.severity === 'error') ? 'failed'
      : report.assets.some(asset => asset.status === 'not_checked') ? 'not_checked' : 'passed';
    result.assessments.push(report);
  }
  result.issues.push(...result.assessments.flatMap(report => report.issues));
  if (!result.assessments.length) result.issues.push({code:'PROFILE.NO_ASSESSMENTS',stage:'profile',severity:'warning',pointer:'/claims',message:'There are no current evaluator assessments to check.'});
  result.checks.profile = result.assessments.some(report => report.status === 'failed') ? 'failed'
    : !result.assessments.length || result.assessments.some(report => report.status === 'not_checked') ? 'not_checked' : 'passed';
  // Any proven integrity failure fails the external stage; other external meaning remains unchecked.
  result.checks.external = result.assessments.some(report => report.assets.some(asset => asset.status === 'failed')) ? 'failed' : 'not_checked';
  result.success = result.checks.profile === 'passed';
  return result;
}

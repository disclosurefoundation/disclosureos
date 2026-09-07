import { ExperimentalObservationSchema } from './observation-schema';
import type { ExperimentalObservation, FramedPosition, MeasuredQuantity, QuantitativeUncertainty } from './observation-schema';
import { checkTime, comparePoints } from './primitives';
import type { EventTimeValue, PrimitiveIssue, ValueSelection } from './primitives';

export type ObservationIssueCode = PrimitiveIssue['code'] | 'METHOD.VERSION_MISMATCH' | 'UNIT.MISMATCH'
  | 'FRAME.KIND_MISMATCH' | 'FRAME.VERTICAL_REFERENCE' | 'SELECTION.REQUIRED' | 'TIME.RECORD_ORDER'
  | 'PROCESS.OUTPUT_MISMATCH' | 'SOURCE.DIGEST_MISMATCH' | 'PROCESS.CYCLE';

export interface ObservationIssue {
  code: ObservationIssueCode;
  stage: 'structural' | 'semantic';
  severity: 'error';
  pointer: string;
  message: string;
}
export interface ObservationChecks {
  structural: 'passed' | 'failed';
  semantic: 'passed' | 'failed' | 'not_checked';
  profile: 'not_checked';
  external: 'not_checked';
}
export type ObservationParseResult = {
  success: true; data: ExperimentalObservation; issues: ObservationIssue[]; checks: ObservationChecks; uncheckedRefs: string[];
} | {
  success: false; issues: ObservationIssue[]; checks: ObservationChecks; uncheckedRefs: string[];
};

const pointer = (path: readonly PropertyKey[]) => path.map(p => `/${String(p).replace(/~/g, '~0').replace(/\//g, '~1')}`).join('');
const key = (ref: string) => ref.slice(ref.indexOf(':') + 1);

/** Validates declared metadata and local lineage. Never fetches URLs or certifies profiles. */
export function parseExperimentalObservation(input: unknown): ObservationParseResult {
  const parsed = ExperimentalObservationSchema.safeParse(input);
  if (!parsed.success) return {
    success: false, checks: { structural: 'failed', semantic: 'not_checked', profile: 'not_checked', external: 'not_checked' }, uncheckedRefs: [],
    issues: parsed.error.issues.map(issue => ({ code: 'STRUCT.VALUE', stage: 'structural', severity: 'error', pointer: pointer(issue.path), message: issue.message })),
  };
  const data = parsed.data;
  const issues: ObservationIssue[] = [];
  const graph = new Map<string, Set<string>>();
  const problem = (code: ObservationIssueCode, path: string, message: string) => issues.push({ code, stage: 'semantic', severity: 'error', pointer: path, message });
  function index<T extends { id: string }>(items: T[], prefix: string, collection: string): Map<string, T> {
    const result = new Map<string, T>();
    for (const [i, item] of items.entries()) {
      if (result.has(item.id)) problem('REF.UNIQUE_ID', `/${collection}/${i}/id`, `Duplicate ${prefix} ID.`);
      else { result.set(item.id, item); graph.set(`${prefix}:${item.id}`, new Set()); }
    }
    return result;
  }
  const sources = index(data.sources, 'source', 'sources');
  const products = index(data.products, 'product', 'products');
  const methods = index(data.methods, 'method', 'methods');
  const frames = index(data.frames, 'frame', 'frames');
  const assertions = index(data.assertions, 'assertion', 'assertions');
  index(data.measurements, 'measurement', 'measurements');
  const processes = index(data.processing, 'process', 'processing');
  const processOutputs = new Map(data.processing.map(process => [process.id, new Set(process.outputRefs)]));

  function resolve(ref: string, path: string, owner?: string): boolean {
    if (!graph.has(ref)) { problem('REF.LOCAL_RESOLUTION', path, `Undeclared local reference: ${ref}`); return false; }
    if (owner) graph.get(owner)?.add(ref);
    return true;
  }
  function references(refs: string[], path: string, owner?: string): void {
    const seen = new Set<string>();
    for (const [i, ref] of refs.entries()) {
      if (seen.has(ref)) problem('REF.UNIQUE_ID', `${path}/${i}`, 'Reference is repeated.');
      seen.add(ref);
      resolve(ref, `${path}/${i}`, owner);
    }
  }
  function method(ref: string, version: string, path: string, owner?: string): void {
    if (resolve(ref, `${path}/methodRef`, owner) && methods.get(key(ref))?.version !== version) {
      problem('METHOD.VERSION_MISMATCH', `${path}/methodVersion`, 'Method version differs from the local declaration.');
    }
  }
  function time(value: EventTimeValue, path: string): void {
    const local: PrimitiveIssue[] = [];
    checkTime(value, path, local);
    for (const issue of local) problem(issue.code, issue.pointer, issue.message);
  }
  function instant(value: string, path: string): void { time({ kind: 'instant', value, timeScale: 'UTC' }, path); }
  function uncertainty(value: QuantitativeUncertainty, expectedUnit: string | readonly string[], path: string, owner?: string): void {
    if (value.kind === 'unknown') return;
    const units = typeof expectedUnit === 'string' ? [expectedUnit] : expectedUnit;
    if (!units.includes(value.unit)) problem('UNIT.MISMATCH', `${path}/unit`, 'Uncertainty unit does not match the declared quantity; no conversion is inferred.');
    references(value.sourceRefs, `${path}/sourceRefs`, owner);
  }
  function quantity(value: MeasuredQuantity, path: string, owner?: string, expectedUnit?: string): void {
    if (expectedUnit !== undefined && value.unit !== expectedUnit) problem('UNIT.MISMATCH', `${path}/unit`, 'Quantity unit differs from its reference frame.');
    uncertainty(value.uncertainty, value.unit, `${path}/uncertainty`, owner);
  }
  function position(value: FramedPosition, path: string, owner?: string): void {
    resolve(value.frameRef, `${path}/frameRef`, owner);
    const frame = frames.get(key(value.frameRef));
    if (frame && frame.kind !== value.kind) problem('FRAME.KIND_MISMATCH', `${path}/frameRef`, 'Position and reference frame use different coordinate systems.');
    if (value.kind === 'geodetic') {
      if (value.uncertainty) {
        uncertainty(value.uncertainty.latitude, 'deg', `${path}/uncertainty/latitude`, owner);
        uncertainty(value.uncertainty.longitude, 'deg', `${path}/uncertainty/longitude`, owner);
      }
      if (value.altitude) {
        if (frame?.kind === 'geodetic' && !frame.vertical) problem('FRAME.VERTICAL_REFERENCE', `${path}/altitude`, 'Altitude requires an explicit vertical reference and unit.');
        quantity(value.altitude, `${path}/altitude`, owner, frame?.kind === 'geodetic' ? frame.vertical?.unit : undefined);
      }
    } else {
      for (const axis of ['x', 'y', 'z'] as const) quantity(value[axis], `${path}/${axis}`, owner, frame?.kind === 'cartesian' ? frame.unit : undefined);
    }
  }
  function matchesField(ref: string, field: 'eventTime' | 'position' | 'measurement', measurementId?: string): boolean {
    const assertion = assertions.get(key(ref));
    return assertion?.field === field && (assertion.field !== 'measurement' || assertion.measurementId === measurementId);
  }
  function fieldReferences(refs: string[], field: 'eventTime' | 'position' | 'measurement', path: string, owner?: string, measurementId?: string): void {
    references(refs, path, owner);
    for (const [i, ref] of refs.entries()) {
      if (ref.startsWith('assertion:') && assertions.has(key(ref)) && !matchesField(ref, field, measurementId)) problem('REF.FIELD_MISMATCH', `${path}/${i}`, 'Assertion concerns a different field or measurement.');
    }
  }
  function selection(value: ValueSelection | undefined, selectedValue: unknown, refs: string[], field: 'eventTime' | 'position' | 'measurement', path: string, owner?: string, measurementId?: string): void {
    if (!value) {
      if (refs.some(ref => ref.startsWith('assertion:'))) problem('SELECTION.REQUIRED', `${path}/selection`, 'A curated value citing local assertions requires an explicit selection record.');
      return;
    }
    const selectionPath = `${path}/selection`;
    instant(value.evaluatedAt, `${selectionPath}/evaluatedAt`);
    method(value.methodRef, value.methodVersion, selectionPath, owner);
    fieldReferences(value.consideredAssertionRefs, field, `${selectionPath}/consideredAssertionRefs`, owner, measurementId);
    resolve(value.assertionRef, `${selectionPath}/assertionRef`, owner);
    if (!value.consideredAssertionRefs.includes(value.assertionRef)) problem('SELECTION.INPUTS', `${selectionPath}/assertionRef`, 'Selected assertion must be among considered inputs.');
    if (!refs.includes(value.assertionRef)) problem('SELECTION.SOURCE_REF', `${path}/sourceRefs`, 'Field must cite the selected assertion.');
    const target = assertions.get(key(value.assertionRef));
    if (target && !matchesField(value.assertionRef, field, measurementId)) problem('REF.FIELD_MISMATCH', `${selectionPath}/assertionRef`, 'Selected assertion concerns a different field or measurement.');
    else if (target && JSON.stringify(target.value) !== JSON.stringify(selectedValue)) problem('SELECTION.VALUE_MISMATCH', `${path}/value`, 'Selection must copy the cited assertion value exactly; processing is declared separately.');
  }

  instant(data.createdAt, '/createdAt');
  instant(data.updatedAt, '/updatedAt');
  if (comparePoints({ kind: 'instant', value: data.createdAt, timeScale: 'UTC' }, { kind: 'instant', value: data.updatedAt, timeScale: 'UTC' }) > 0) problem('TIME.RECORD_ORDER', '/updatedAt', 'Record update precedes record creation.');

  for (const [i, product] of data.products.entries()) {
    const owner = `product:${product.id}`;
    if (product.kind === 'raw') references(product.sourceRefs, `/products/${i}/sourceRefs`, owner);
    else {
      resolve(product.generatedBy, `/products/${i}/generatedBy`, owner);
      const producer = processes.get(key(product.generatedBy));
      if (producer && !processOutputs.get(producer.id)?.has(owner)) problem('PROCESS.OUTPUT_MISMATCH', `/products/${i}/generatedBy`, 'Producer does not list this derived product as an output.');
    }
  }
  for (const [i, assertion] of data.assertions.entries()) {
    const path = `/assertions/${i}`;
    const owner = `assertion:${assertion.id}`;
    resolve(assertion.provenance.sourceRef, `${path}/provenance/sourceRef`, owner);
    const origin = assertion.provenance.sourceRef.startsWith('source:') ? sources.get(key(assertion.provenance.sourceRef)) : products.get(key(assertion.provenance.sourceRef));
    if (assertion.provenance.sourceDigest && origin?.digest && assertion.provenance.sourceDigest.value !== origin.digest.value) problem('SOURCE.DIGEST_MISMATCH', `${path}/provenance/sourceDigest`, 'Declared digest differs from the inventory declaration; neither has been verified against bytes.');
    const locator = assertion.provenance.locator;
    if (locator?.kind === 'time_range' && locator.endSeconds < locator.startSeconds) problem('TIME.INTERVAL', `${path}/provenance/locator/endSeconds`, 'Locator end precedes its start.');
    if (assertion.field === 'eventTime') time(assertion.value, `${path}/value`);
    else if (assertion.field === 'position') position(assertion.value, `${path}/value`, owner);
    else {
      // This is the subject of the assertion, not a processing dependency.
      resolve(`measurement:${assertion.measurementId}`, `${path}/measurementId`);
      quantity(assertion.value, `${path}/value`, owner);
    }
  }
  if (data.eventTime.state === 'known' || data.eventTime.state === 'approximate') {
    time(data.eventTime.value, '/eventTime/value');
    fieldReferences(data.eventTime.sourceRefs, 'eventTime', '/eventTime/sourceRefs');
    if (data.eventTime.uncertainty) uncertainty(data.eventTime.uncertainty, ['s', 'ms', 'us', 'ns'], '/eventTime/uncertainty');
    selection(data.eventTime.selection, data.eventTime.value, data.eventTime.sourceRefs, 'eventTime', '/eventTime');
  }
  if (data.position.state === 'known' || data.position.state === 'approximate') {
    position(data.position.value, '/position/value');
    fieldReferences(data.position.sourceRefs, 'position', '/position/sourceRefs');
    selection(data.position.selection, data.position.value, data.position.sourceRefs, 'position', '/position');
  }
  for (const [i, measurement] of data.measurements.entries()) {
    const path = `/measurements/${i}`;
    const owner = `measurement:${measurement.id}`;
    if (measurement.frameRef) resolve(measurement.frameRef, `${path}/frameRef`, owner);
    quantity(measurement.value, `${path}/value`, owner);
    fieldReferences(measurement.sourceRefs, 'measurement', `${path}/sourceRefs`, owner, measurement.id);
    selection(measurement.selection, measurement.value, measurement.sourceRefs, 'measurement', path, owner, measurement.id);
  }
  for (const [i, process] of data.processing.entries()) {
    const path = `/processing/${i}`;
    const owner = `process:${process.id}`;
    instant(process.performedAt, `${path}/performedAt`);
    method(process.methodRef, process.methodVersion, path, owner);
    references(process.inputRefs, `${path}/inputRefs`, owner);
    // Outputs are reverse edges of product.generatedBy, not input dependencies.
    references(process.outputRefs, `${path}/outputRefs`);
    for (const [j, ref] of process.outputRefs.entries()) {
      const product = products.get(key(ref));
      if (product && (product.kind !== 'derived' || product.generatedBy !== owner)) problem('PROCESS.OUTPUT_MISMATCH', `${path}/outputRefs/${j}`, 'Output must be a derived product identifying this producer.');
    }
  }

  // Iterative topological check avoids recursion limits on long processing histories.
  const indegrees = new Map([...graph.keys()].map(ref => [ref, 0]));
  for (const dependencies of graph.values()) for (const ref of dependencies) indegrees.set(ref, (indegrees.get(ref) ?? 0) + 1);
  const queue = [...indegrees].filter(([, degree]) => degree === 0).map(([ref]) => ref);
  for (let i = 0; i < queue.length; i++) {
    for (const dependency of graph.get(queue[i]!) ?? []) {
      const degree = indegrees.get(dependency)! - 1;
      indegrees.set(dependency, degree);
      if (degree === 0) queue.push(dependency);
    }
  }
  if (queue.length !== graph.size) problem('PROCESS.CYCLE', '/processing', 'Local processing/provenance dependencies contain a cycle.');

  const checks: ObservationChecks = { structural: 'passed', semantic: issues.length ? 'failed' : 'passed', profile: 'not_checked', external: 'not_checked' };
  const uncheckedRefs = [...sources.keys()].map(id => `source:${id}`).concat(
    [...products.keys()].map(id => `product:${id}`), [...methods.keys()].map(id => `method:${id}`), [...frames.keys()].map(id => `frame:${id}`),
  );
  return issues.length ? { success: false, issues, checks, uncheckedRefs } : { success: true, data, issues, checks, uncheckedRefs };
}

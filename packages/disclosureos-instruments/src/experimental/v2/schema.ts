import { z } from 'zod';

const text = z.string().min(1).regex(/\S/);
const id = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]*(?![\s\S])/);
const ref = (kind: string) => z.string().regex(new RegExp(`^${kind}:[A-Za-z0-9][A-Za-z0-9._-]*(?![\\s\\S])`));
// Locally owned schema, matching the records UTC lexical contract without crossing Zod instances.
const instant = z.iso.datetime({offset:true}).regex(/^(?!0000)/).regex(/T[0-9]{2}:[0-9]{2}:[0-9]{2}/).regex(/(?:Z|[+-][0-9]{2}:[0-9]{2})(?![\s\S])/);
const unknown = z.strictObject({state:z.literal('unknown'),reason:text});
const knownText = z.union([z.strictObject({state:z.literal('known'),value:text}),unknown]);
const knownInstant = z.union([z.strictObject({state:z.literal('known'),value:instant}),unknown]);
const interval = z.strictObject({state:z.literal('known'),start:instant,end:instant,timeScale:z.literal('UTC')});
const period = z.union([interval,unknown]);
const binding = (kind: string) => z.union([
  z.strictObject({state:z.literal('pinned'),ref:ref(kind)}),
  z.strictObject({state:z.literal('unresolved'),reason:text,legacyRef:text.optional()}),
]);
export const ContextArtifactSchema = z.strictObject({
  digest:z.strictObject({algorithm:z.literal('sha256'),value:z.string().regex(/^[a-f0-9]{64}(?![\s\S])/)}),
  mediaType:text,byteLength:z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),uri:z.url().optional(),
});
export const InstrumentInstanceSchema = z.strictObject({
  id,identity:z.union([z.strictObject({state:z.literal('known'),manufacturer:text,model:text,serialNumber:text.optional()}),unknown]),
});
const channel = z.strictObject({id,quantity:text,unit:text,sampling:z.union([z.strictObject({state:z.literal('known'),rateHz:z.number().positive()}),unknown])});
export const ManifestRevisionSchema = z.strictObject({
  id,instrumentRef:ref('instrument'),version:text,publishedAt:instant,artifact:ContextArtifactSchema,
  configuration:z.strictObject({hardware:knownText,firmware:knownText}),channels:z.array(channel).min(1),
});
export const DeploymentContextSchema = z.strictObject({id,instrumentRef:ref('instrument'),manifest:binding('manifest'),period,site:knownText});
const quantified = {magnitude:z.number().min(0),unit:text};
const uncertainty = z.union([
  z.strictObject({kind:z.literal('unknown'),reason:text}),
  z.strictObject({kind:z.literal('standard'),...quantified}),z.strictObject({kind:z.literal('bound'),...quantified}),
  z.strictObject({kind:z.literal('expanded'),...quantified,coverageFactor:z.number().positive(),coverageProbability:z.number().gt(0).lte(1).optional()}),
]);
export const CalibrationContextSchema = z.strictObject({
  id,instrumentRef:ref('instrument'),manifestRef:ref('manifest'),channelId:id,performedAt:knownInstant,validity:period,
  method:z.union([z.strictObject({state:z.literal('known'),id:text,version:text,description:text}),unknown]),
  report:z.union([z.strictObject({state:z.literal('known'),artifact:ContextArtifactSchema}),unknown]),uncertainty,
  review:z.union([z.strictObject({state:z.literal('unreviewed')}),unknown,
    z.strictObject({state:z.literal('reviewed'),reviewedBy:text,reviewedAt:instant,outcome:z.enum(['accepted','rejected','inconclusive']),report:ContextArtifactSchema})]),
});
const timingQuantity = (positive: boolean) => z.union([
  z.strictObject({state:z.literal('known'),magnitude:positive ? z.number().positive() : z.number().min(0),unit:z.enum(['s','ms','us','ns'])}),unknown,
]);
export const AcquisitionContextEntrySchema = z.strictObject({
  id,instrumentRef:ref('instrument'),manifest:binding('manifest'),deployment:binding('deployment'),
  time:z.union([z.strictObject({state:z.literal('known'),kind:z.literal('instant'),value:instant,timeScale:z.literal('UTC')}),interval.extend({kind:z.literal('interval')}),unknown]),
  classification:z.enum(['background','known_control','candidate','other','unknown']),
  clock:z.strictObject({source:knownText,synchronization:knownText,resolution:timingQuantity(true),uncertainty:timingQuantity(false)}),
  channels:z.array(z.strictObject({channelId:id,calibration:binding('calibration')})).min(1),
});
export const RawAcquisitionProductSchema = z.strictObject({id,acquisitionRef:ref('acquisition'),kind:z.literal('raw'),artifact:ContextArtifactSchema});
export const ACQUISITION_CONTEXT_SCHEMA_ID = 'urn:disclosureos:experimental:acquisition-context:0.1.0';
export const ACQUISITION_CONTEXT_RULESET_VERSION = '0.1.0';
export const AcquisitionContextSchema = z.strictObject({
  kind:z.literal('acquisition_context'),schemaVersion:z.literal('0.1.0'),id,
  instruments:z.array(InstrumentInstanceSchema),manifests:z.array(ManifestRevisionSchema),deployments:z.array(DeploymentContextSchema),
  calibrations:z.array(CalibrationContextSchema),acquisitions:z.array(AcquisitionContextEntrySchema),products:z.array(RawAcquisitionProductSchema),
  extensions:z.record(z.string().regex(/^[a-z][a-z0-9_-]*(?:\.[a-z0-9_-]+)+(?![\s\S])/),z.json()).optional(),
});
export type AcquisitionContext = z.infer<typeof AcquisitionContextSchema>;
export type AcquisitionContextEntry = z.infer<typeof AcquisitionContextEntrySchema>;
export type CalibrationContext = z.infer<typeof CalibrationContextSchema>;
export type ManifestRevision = z.infer<typeof ManifestRevisionSchema>;
export type ContextArtifact = z.infer<typeof ContextArtifactSchema>;
export function acquisitionContextJsonSchema(): Record<string,unknown> {
  return {...z.toJSONSchema(AcquisitionContextSchema,{target:'draft-2020-12'}),$id:ACQUISITION_CONTEXT_SCHEMA_ID};
}

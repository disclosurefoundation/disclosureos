import { z } from 'zod';
import { SourceReferenceSchema } from '../source/reference';
// `ConfidenceLevel` (investigation confidence) is the single shared qualitative
// scale; imported here to keep one source of truth (DRY #1).
import { ConfidenceLevelSchema } from '../shared';

export const ObjectShapeSchema = z
  .enum([
    'sphere', 'orb', 'disc', 'saucer', 'oval', 'egg',
    'cylinder', 'cigar', 'tic_tac',
    'triangle', 'delta', 'boomerang', 'chevron',
    'diamond', 'rectangle', 'square', 'cube',
    'cross', 'star',
    'amorphous', 'changing', 'light_only',
    'other', 'unknown',
  ])
  .describe('Reported shape of the observed object.');

export type ObjectShape = z.infer<typeof ObjectShapeSchema>;

export const ObjectCharacteristicsSchema = z
  .object({
    shape: ObjectShapeSchema.optional(),
    size: z.string().optional().describe('Apparent size as reported (e.g. "size of a commercial airliner").'),
    sizeMeters: z.number().optional().describe('Estimated size of the object, in meters.'),
    color: z.string().optional().describe('Primary color of the object as reported.'),
    secondaryColors: z.array(z.string()).optional().describe('Additional colors observed on the object.'),
    luminosity: z
      .string()
      .optional()
      .describe('Light emission as reported (e.g. "glowing white", "self-luminous", "no lights").'),
    sound: z.string().optional().describe('Whether and what sound the object produced (e.g. "silent", "humming").'),
    soundDescription: z.string().optional().describe('Fuller free-text description of any sound.'),
    surfaceDetails: z
      .string()
      .optional()
      .describe('Visible surface features (e.g. "metallic, seamless, no rivets or seams").'),
    numberObserved: z.number().optional().describe('How many objects were observed.'),
    formation: z
      .string()
      .optional()
      .describe('Geometric arrangement when multiple objects were observed (e.g. "triangular formation").'),
    structuralFeatures: z
      .array(z.string())
      .optional()
      .describe('Distinct structural elements reported (e.g. "dome", "portholes", "appendages").'),
  })
  .meta({ id: 'ObjectCharacteristics' })
  .describe('Physical description of the observed object(s).');

export type ObjectCharacteristics = z.infer<typeof ObjectCharacteristicsSchema>;

export const ManeuverTypeSchema = z
  .enum([
    'hover', 'instant_acceleration', 'instant_stop',
    'right_angle_turn', 'zigzag', 'pendulum',
    'split', 'merge', 'disappear', 'appear',
    'transmedium_entry', 'transmedium_exit',
    'vertical_ascent', 'vertical_descent',
    'rotation', 'wobble',
    'other',
  ])
  .describe('A distinctive movement/maneuver exhibited by the object.');

export type ManeuverType = z.infer<typeof ManeuverTypeSchema>;

export const MovementSchema = z
  .object({
    speed: z.string().optional().describe('Speed as reported (e.g. "faster than any known aircraft").'),
    speedKmh: z.number().optional().describe('Estimated speed, in kilometers per hour.'),
    altitude: z.string().optional().describe('Altitude as reported (e.g. "treetop level", "very high").'),
    altitudeMeters: z.number().optional().describe('Estimated altitude of the object, in meters.'),
    heading: z.number().optional().describe('Direction of travel, in compass degrees (0–360).'),
    flightPath: z
      .string()
      .optional()
      .describe('Narrative of the object\u2019s path through the encounter (e.g. "descended from 80,000 ft to sea level").'),
    maneuvers: z.array(ManeuverTypeSchema).optional().describe('Distinctive maneuvers exhibited, from the typed vocabulary.'),
    maneuverDescriptions: z
      .array(z.string())
      .optional()
      .describe('Free-text descriptions elaborating on the typed maneuvers.'),
    radarData: z.boolean().optional().describe('Whether the movement was tracked on radar.'),
    infraredSignature: z.boolean().optional().describe('Whether the object showed an infrared signature.'),
    trajectory: z.string().optional().describe('Overall trajectory summary (e.g. "erratic", "straight and level").'),
  })
  .meta({ id: 'Movement' })
  .describe('How the object moved — kinematics and notable maneuvers.');

export type Movement = z.infer<typeof MovementSchema>;

export const InvestigationSchema = z
  .object({
    investigatingBody: z
      .string()
      .optional()
      .describe('Primary organization that investigated (e.g. "AARO", "Project Blue Book").'),
    investigatingBodies: z
      .array(z.string())
      .optional()
      .describe('All organizations that investigated, when more than one.'),
    caseNumber: z.string().optional().describe('Case or file number assigned by the investigating body.'),
    investigationDate: z.string().optional().describe('When the investigation was conducted (ISO date).'),
    conclusion: z.string().optional().describe('Official conclusion reached (e.g. "unidentified", "weather balloon").'),
    confidence: ConfidenceLevelSchema.optional(),
    methodologies: z
      .array(z.string())
      .optional()
      .describe('Methods used (e.g. "witness interviews", "radar data analysis").'),
    findings: z.string().optional().describe('Summary of what the investigation found.'),
    recommendations: z.string().optional().describe('Recommendations issued by the investigation.'),
  })
  .meta({ id: 'Investigation' })
  .describe('Official/independent investigation of the observation.');

export type Investigation = z.infer<typeof InvestigationSchema>;

export const WitnessesSchema = z
  .object({
    count: z.number().optional().describe('Total number of witnesses.'),
    categories: z
      .array(z.string())
      .optional()
      .describe('Kinds of witnesses present (e.g. "military pilots", "radar operators", "civilians").'),
    militaryWitnesses: z.boolean().optional().describe('Whether any witnesses were military personnel.'),
    aviationWitnesses: z
      .boolean()
      .optional()
      .describe('Whether any witnesses were pilots or aviation professionals.'),
    multipleIndependent: z
      .boolean()
      .optional()
      .describe('Whether independent witnesses observed from separate vantage points.'),
    professionalObservers: z
      .boolean()
      .optional()
      .describe('Whether any witnesses were trained observers (pilots, astronomers, military).'),
    descriptions: z.array(z.string()).optional().describe('Brief summaries of individual witness accounts.'),
  })
  .meta({ id: 'Witnesses' })
  .describe('Aggregate summary of who witnessed the observation.');

export type Witnesses = z.infer<typeof WitnessesSchema>;

export const ResponseImpactSchema = z
  .object({
    officialResponse: z
      .string()
      .optional()
      .describe('How officials responded (statements, denials, acknowledgments).'),
    mediaAttention: z.boolean().optional().describe('Whether the observation received media coverage.'),
    publicImpact: z.string().optional().describe('Effect on public awareness or discourse.'),
    policyImpact: z
      .string()
      .optional()
      .describe('Policy consequences (e.g. hearings, legislation, reporting-process changes).'),
    militaryResponse: z
      .string()
      .optional()
      .describe('Military actions taken (e.g. intercept scrambled, alert status changed).'),
    coverUpAlleged: z
      .boolean()
      .optional()
      .describe('Whether suppression or concealment of the event has been alleged.'),
  })
  .meta({ id: 'ResponseImpact' })
  .describe('Official, media, and public response to the observation.');

export type ResponseImpact = z.infer<typeof ResponseImpactSchema>;

export const EnvironmentSchema = z
  .object({
    weather: z.string().optional().describe('General weather conditions (e.g. "clear", "overcast").'),
    visibility: z.string().optional().describe('Visibility conditions (e.g. "unlimited", "10 miles", "hazy").'),
    cloudCover: z.string().optional().describe('Cloud cover description (e.g. "scattered at 5,000 ft").'),
    windSpeed: z.string().optional().describe('Wind conditions as reported.'),
    temperature: z.number().optional().describe('Air temperature, in degrees Celsius.'),
    humidity: z.number().optional().describe('Relative humidity, as a percentage (0–100).'),
    celestialConditions: z
      .string()
      .optional()
      .describe('Sky conditions relevant to identification (e.g. visible planets, meteor showers, satellites).'),
    moonPhase: z.string().optional().describe('Moon phase description at the time of observation.'),
    precipitation: z.string().optional().describe('Precipitation at the time of observation, if any.'),
  })
  .meta({ id: 'Environment' })
  .describe('Environmental and weather conditions at the time of observation.');

export type Environment = z.infer<typeof EnvironmentSchema>;

export const RelationKindSchema = z
  .enum([
    'corroborates',
    'contradicts',
    'duplicate_of',
    'same_object',
    'supersedes',
    'superseded_by',
    're_analysis_of',
    'part_of',
  ])
  .describe('How one observation relates to another (typed edge vocabulary).');

export type RelationKind = z.infer<typeof RelationKindSchema>;

export const RelationEdgeSchema = z
  .object({
    kind: RelationKindSchema,
    targetId: z.string().min(1).describe('The `Observation.id` this edge points at.'),
    note: z.string().optional().describe('Free-text context for why the link exists.'),
  })
  .meta({ id: 'RelationEdge' })
  .describe('A typed link from this observation to another.');

export type RelationEdge = z.infer<typeof RelationEdgeSchema>;

export const RelationsSchema = z
  .object({
    /** Typed edges to other observations — the standardized way to link records. */
    edges: z
      .array(RelationEdgeSchema)
      .optional()
      .describe('Typed edges to other observations — the standardized way to link records.'),
    /** Named grouping into a flap (a localized cluster of sightings). */
    flap: z.string().optional().describe('Named grouping into a flap (a localized cluster of sightings).'),
    /** Named grouping into a wave (a broad temporal surge of sightings). */
    wave: z.string().optional().describe('Named grouping into a wave (a broad temporal surge of sightings).'),
    /** Named grouping into an ad-hoc cluster. */
    cluster: z.string().optional().describe('Named grouping into an ad-hoc cluster.'),
    /** @deprecated Use typed `edges` with `kind: 'corroborates' | 'same_object' | …`. */
    relatedObservationIds: z
      .array(z.string())
      .optional()
      .describe('Deprecated — use typed `edges` with `kind: "corroborates" | "same_object" | …`.'),
    /** @deprecated Use typed `edges` with `kind: 'supersedes' | 're_analysis_of' | …`. */
    precedingEvents: z
      .array(z.string())
      .optional()
      .describe('Deprecated — use typed `edges` with `kind: "supersedes" | "re_analysis_of" | …`.'),
    /** @deprecated Use typed `edges`. */
    followingEvents: z.array(z.string()).optional().describe('Deprecated — use typed `edges`.'),
  })
  .meta({ id: 'Relations' })
  .describe('Typed links to related observations, plus flap/wave/cluster groupings.');

export type Relations = z.infer<typeof RelationsSchema>;

export const AviationSchema = z
  .object({
    aircraftType: z.string().optional().describe('Type of aircraft involved (e.g. "F/A-18F Super Hornet").'),
    aircraftDesignation: z.string().optional().describe('Military designation or tail number of the aircraft.'),
    squadron: z.string().optional().describe('Squadron or unit the aircraft belonged to.'),
    flightMission: z.string().optional().describe('Mission being flown at the time (e.g. "training exercise", "combat air patrol").'),
    altitude: z.number().optional().describe('Aircraft altitude during the encounter, in meters.'),
    speed: z.number().optional().describe('Aircraft speed during the encounter, in kilometers per hour.'),
    heading: z.number().optional().describe('Aircraft heading during the encounter, in compass degrees (0–360).'),
    radarContact: z.boolean().optional().describe('Whether the aircraft\u2019s radar held contact with the object.'),
    weaponsSystemEngaged: z
      .boolean()
      .optional()
      .describe('Whether a weapons system locked onto or tracked the object.'),
    interceptAttempted: z.boolean().optional().describe('Whether an intercept of the object was attempted.'),
  })
  .meta({ id: 'Aviation' })
  .describe('Aviation context when the observation involved aircraft.');

export type Aviation = z.infer<typeof AviationSchema>;

export const SourceDataSchema = z
  .object({
    primarySource: SourceReferenceSchema.optional(),
    sources: z.array(SourceReferenceSchema).optional(),
    originalClassification: z
      .string()
      .optional()
      .describe('Original government classification of the source material (e.g. "SECRET").'),
    declassificationDate: z.string().optional().describe('When the source material was declassified (ISO date).'),
    foiaRequestId: z.string().optional().describe('FOIA request number that produced the source material.'),
    archiveLocation: z
      .string()
      .optional()
      .describe('Physical or digital archive where the source material resides.'),
  })
  .meta({ id: 'SourceData' })
  .describe(
    'Where the observation data came from. Forensic custody/authenticity now lives in the optional `Observation.provenance` slot (@disclosureos/records/extensions/provenance).',
  );

export type SourceData = z.infer<typeof SourceDataSchema>;

// Re-export the shared qualitative confidence scale under the historical name
// so existing `domains` consumers keep resolving `ConfidenceLevel` here.
export type { ConfidenceLevel } from '../shared';

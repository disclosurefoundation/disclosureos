import { z } from "zod";
import {
  ObjectShapeSchema,
  ManeuverTypeSchema,
} from "../../observation/domains";
import {
  SiteTypeSchema,
  TerrainTypeSchema,
  AirspaceClassSchema,
  CoordinatePrecisionSchema,
  LocationSensitivitySchema,
} from "../../geo/location";
import {
  SensorTypeSchema,
  DetectionMethodSchema,
  SensorEvidenceDataSchema,
} from "../../source/sensor/types";
import { TimeOfDaySchema } from "../../temporal/time-of-day";
import {
  EventTimeValueSchema,
  EventTimePointSchema,
  SourceProvenanceSchema,
  instantString,
} from "./primitives";
import {
  FramedPositionSchema,
  EXPERIMENTAL_OBSERVATION_SCHEMA_ID,
} from "./observation-schema";

const text = z.string().min(1).regex(/\S/);
const id = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]*(?![\s\S])/);
const sourceRef = z
  .string()
  .regex(/^(source|product):[A-Za-z0-9][A-Za-z0-9._-]*(?![\s\S])/);
export const OBSERVATION_CONTEXT_SCHEMA_ID =
  "urn:disclosureos:experimental:observation-context:0.1.0";
export const DocumentSnapshotRefSchema = z.strictObject({
  documentId: id.describe("ID inside the supplied document; not a URL."),
  schemaId: text.describe("Exact document contract identity."),
  sha256: z
    .string()
    .regex(/^[a-f0-9]{64}(?![\s\S])/)
    .describe("SHA-256 of exact supplied document bytes."),
});
export const ObservationSnapshotRefSchema = DocumentSnapshotRefSchema.extend({
  schemaId: z.literal(EXPERIMENTAL_OBSERVATION_SCHEMA_ID),
});
const provenance = SourceProvenanceSchema.extend({ sourceRef });
function values<T extends z.ZodType>(schema: T) {
  return z
    .array(
      z.strictObject({
        id: id.describe(
          "Assertion identity within this entity, independent of array order.",
        ),
        content: z.union([
          z.strictObject({
            state: z.literal("known"),
            value: schema,
            provenance,
            originalWording: text.optional(),
          }),
          z.strictObject({
            state: z.literal("approximate"),
            value: schema,
            precision: text,
            provenance,
            originalWording: text.optional(),
          }),
          z.strictObject({
            state: z.literal("unknown"),
            reason: z.enum(["not_recorded", "not_collected", "unavailable"]),
          }),
          z.strictObject({ state: z.literal("redacted"), reason: text }),
          z.strictObject({
            state: z.literal("unmapped"),
            originalWording: text,
            provenance,
          }),
        ]),
      }),
    )
    .min(1)
    .optional();
}
const strings = z.array(text).min(1);
const localTime = z.strictObject({
  clock: z.string().regex(/^([01][0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/),
  timezone: text.optional(),
  utcOffset: z
    .string()
    .regex(/^[+-](0[0-9]|1[0-4]):[0-5][0-9]$/)
    .optional(),
  daylightSaving: z.boolean().optional(),
});
const period = z.union([
  z.strictObject({
    kind: z.literal("quarter"),
    year: z.number().int().min(1).max(9999),
    quarter: z.number().int().min(1).max(4),
  }),
  z.strictObject({
    kind: z.enum(["decade", "century"]),
    startYear: z.number().int().min(1).max(9999),
    endYear: z.number().int().min(1).max(9999),
  }),
]);
const calendarEndpoint = z.strictObject({
  value: z.union([EventTimePointSchema, period]),
  certainty: z.enum(["exact", "approximate", "estimated", "unknown"]),
  display: text.optional(),
  notes: text.optional(),
});
const calendarRange = z.strictObject({
  start: calendarEndpoint,
  end: calendarEndpoint,
  type: z.enum([
    "span",
    "uncertainty",
    "active_period",
    "investigation_period",
    "observation_window",
  ]),
  inclusiveEnd: z.boolean(),
  display: text.optional(),
});
const relative = z.strictObject({
  anchorTemporalId: id,
  relation: z.enum(["before", "after", "during", "around"]),
  offset: z
    .strictObject({
      value: z.number().min(0),
      unit: z.enum([
        "seconds",
        "minutes",
        "hours",
        "days",
        "weeks",
        "months",
        "years",
      ]),
      approximate: z.boolean(),
    })
    .optional(),
  wording: text,
});

export const ContextEventFields = {
  eventType: values(
    text.describe("Sourced event descriptor; not an origin hypothesis."),
  ),
  description: values(text),
  temporalId: values(id),
  placeIds: values(z.array(id).min(1)),
};
export const ContextObjectFields = {
  shape: values(ObjectShapeSchema),
  sizeDescription: values(text),
  color: values(text),
  secondaryColors: values(strings),
  luminosity: values(text),
  sound: values(text),
  soundDescription: values(text),
  surfaceDetails: values(text),
  formation: values(text),
  structuralFeatures: values(strings),
  countDescription: values(text),
  speedDescription: values(text),
  altitudeDescription: values(text),
  flightPath: values(text),
  maneuvers: values(z.array(ManeuverTypeSchema).min(1)),
  maneuverDescriptions: values(strings),
  trajectoryDescription: values(text),
  radarContactReported: values(z.boolean()),
  infraredSignatureReported: values(z.boolean()),
};
export const ContextPlaceFields = {
  name: values(text),
  country: values(text),
  countryCode: values(text),
  region: values(text),
  city: values(text),
  address: values(text),
  position: values(FramedPositionSchema),
  coordinatePrecision: values(CoordinatePrecisionSchema),
  coordinatesApproximate: values(z.boolean()),
  elevationSource: values(text),
  siteType: values(SiteTypeSchema),
  secondarySiteTypes: values(z.array(SiteTypeSchema).min(1)),
  terrain: values(z.array(TerrainTypeSchema).min(1)),
  airspaceClass: values(AirspaceClassSchema),
  proximity: values(
    z.strictObject({
      targetPlaceId: id,
      relation: z.enum([
        "nearby",
        "nearest_military",
        "nearest_nuclear",
        "nearest_airport",
      ]),
      distanceMeasurementId: id.optional(),
      bearingMeasurementId: id.optional(),
      note: text.optional(),
    }),
  ),
  infrastructureSensitivity: values(LocationSensitivitySchema),
  sensitivity: values(
    z
      .enum(["public", "approximate_only", "withheld"])
      .describe(
        "Publication instruction only; does not enforce access control.",
      ),
  ),
};
export const ContextPlatformFields = {
  role: values(z.enum(["observer", "station", "aircraft", "vessel"])),
  placeId: values(id),
  name: values(text),
  type: values(text),
  designation: values(text),
  callsign: values(text),
  flightNumber: values(text),
  squadron: values(text),
  mission: values(text),
  operator: values(text),
  radarContact: values(z.boolean()),
  weaponsSystemEngaged: values(z.boolean()),
  interceptAttempted: values(z.boolean()),
};
export const ContextEnvironmentFields = {
  placeId: values(id),
  platformId: values(id),
  temporalId: values(id),
  observedAt: values(EventTimeValueSchema),
  weather: values(text),
  visibility: values(text),
  cloudCover: values(text),
  windDescription: values(text),
  celestialConditions: values(text),
  moonPhase: values(text),
  precipitation: values(text),
};
export const ContextTemporalFields = {
  eventTime: values(EventTimeValueSchema),
  calendarPeriod: values(period),
  relativeDate: values(relative),
  calendarRange: values(calendarRange),
  localTime: values(localTime),
  dateCertainty: values(
    z.enum(["exact", "approximate", "estimated", "unknown"]),
  ),
  timeCertainty: values(
    z.enum(["exact", "approximate", "estimated", "unknown"]),
  ),
  timeOfDay: values(TimeOfDaySchema),
  durationDescription: values(text),
  display: values(text),
  notes: values(text),
  rangeInclusivity: values(
    z.enum(["both", "start", "end", "neither", "unknown"]),
  ),
};
export const ContextCollectionFields = {
  sensorType: values(SensorTypeSchema),
  detectionMethod: values(DetectionMethodSchema),
  productRefs: values(z.array(sourceRef).min(1)),
  acquisitionIds: values(z.array(id).min(1)),
  retentionStatus: values(
    SensorEvidenceDataSchema.shape.dataRetentionStatus.unwrap(),
  ),
  rawDataAvailable: values(z.boolean()),
  anomalies: values(strings),
  correlationDescription: values(text),
  alignmentDescription: values(text),
  notes: values(text),
};
// Descriptions belong to the new field envelopes; imported vocabularies stay unchanged.
for (const fields of [
  ContextEventFields,
  ContextObjectFields,
  ContextPlaceFields,
  ContextPlatformFields,
  ContextEnvironmentFields,
  ContextTemporalFields,
  ContextCollectionFields,
]) {
  for (const [key, schema] of Object.entries(fields)) {
    const label = key.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();
    (fields as Record<string, z.ZodType>)[key] = schema.describe(
      `Sourced ${label} assertions. Keep alternatives and missingness explicit; no assertion is selected by default.`,
    );
  }
}
const role = z.enum([
  "size",
  "count",
  "speed",
  "altitude",
  "heading",
  "ambient_temperature",
  "relative_humidity",
  "wind_speed",
  "moon_illumination",
  "duration",
  "distance",
  "bearing",
  "water_depth",
  "coordinate_precision",
  "time_alignment",
]);
export const ContextMeasurementLinkSchema = z
  .strictObject({
    id,
    role,
    measurementId: id,
    relatedPlaceId: id.optional(),
  })
  .describe(
    "Association to an Observation measurement. No copied numeric value.",
  );
function entity<K extends string, F extends z.ZodRawShape>(kind: K, fields: F) {
  const keys = Object.keys(fields) as [
    keyof F & string,
    ...(keyof F & string)[],
  ];
  return z.strictObject({
    kind: z.literal(kind),
    id,
    fields: z.strictObject(fields),
    measurements: z.array(ContextMeasurementLinkSchema).optional(),
    selections: z
      .array(
        z.strictObject({
          field: z.enum(keys),
          assertionId: id,
          consideredAssertionIds: z.array(id).min(1),
          evaluatedBy: text,
          evaluatedAt: instantString,
          methodRef: z
            .string()
            .regex(/^method:[A-Za-z0-9][A-Za-z0-9._-]*(?![\s\S])/),
          methodVersion: text,
          rationale: text,
        }),
      )
      .optional(),
  });
}
export const ContextEntitySchema = z.discriminatedUnion("kind", [
  entity("event", ContextEventFields),
  entity("reported_object", ContextObjectFields),
  entity("place", ContextPlaceFields),
  entity("platform", ContextPlatformFields),
  entity("environment", ContextEnvironmentFields),
  entity("temporal", ContextTemporalFields),
  entity("collection", ContextCollectionFields),
]);
export const ObservationContextSchema = z
  .strictObject({
    kind: z.literal("observation_context"),
    schemaVersion: z.literal("0.1.0"),
    id,
    observationRef: ObservationSnapshotRefSchema,
    acquisitionRef: DocumentSnapshotRefSchema.extend({
      schemaId: z.literal(
        "urn:disclosureos:experimental:acquisition-context:0.1.0",
      ),
    }).optional(),
    recordedAt: instantString,
    recordedBy: text,
    entities: z.array(ContextEntitySchema).min(1),
  })
  .describe(
    "Typed descriptions of an observation. Supplied values remain sourced declarations, not verified facts.",
  );
function target<K extends string, F extends z.ZodRawShape>(kind: K, fields: F) {
  const keys = Object.keys(fields) as [
    keyof F & string,
    ...(keyof F & string)[],
  ];
  return z.strictObject({
    kind: z.literal(kind),
    id,
    field: z.enum(keys).optional(),
  });
}
export const ContextTargetSchema = z.discriminatedUnion("kind", [
  target("event", ContextEventFields),
  target("reported_object", ContextObjectFields),
  target("place", ContextPlaceFields),
  target("platform", ContextPlatformFields),
  target("environment", ContextEnvironmentFields),
  target("temporal", ContextTemporalFields),
  target("collection", ContextCollectionFields),
]);
export const ContextReferenceSchema = z.strictObject({
  document: DocumentSnapshotRefSchema.extend({
    schemaId: z.literal(OBSERVATION_CONTEXT_SCHEMA_ID),
  }),
  target: ContextTargetSchema,
});
export const ContextAssertionReferenceSchema = ContextReferenceSchema.extend({
  assertionId: id,
});
export type ObservationContext = z.infer<typeof ObservationContextSchema>;
export type ContextEntity = z.infer<typeof ContextEntitySchema>;
export type ContextReference = z.infer<typeof ContextReferenceSchema>;
export type DocumentSnapshotRef = z.infer<typeof DocumentSnapshotRefSchema>;
export function observationContextJsonSchema(): Record<string, unknown> {
  return {
    ...z.toJSONSchema(ObservationContextSchema, {
      target: "draft-2020-12",
      reused: "ref",
    }),
    $id: OBSERVATION_CONTEXT_SCHEMA_ID,
  };
}

import { z } from 'zod';

export const CoordinatePrecisionSchema = z
  .enum(['exact', 'address', 'locality', 'region', 'approximate', 'unknown'])
  .describe('How precisely a coordinate is known.');

export type CoordinatePrecision = z.infer<typeof CoordinatePrecisionSchema>;

export const SiteTypeSchema = z
  .enum([
    'military_air_base',
    'military_naval_base',
    'military_army_base',
    'military_missile_site',
    'military_radar_station',
    'military_research_facility',
    'military_training_area',
    'military_other',
    'nuclear_power_plant',
    'nuclear_weapons_storage',
    'nuclear_research_facility',
    'nuclear_waste_storage',
    'nuclear_other',
    'civilian_airport',
    'private_airfield',
    'heliport',
    'seaport',
    'offshore_platform',
    'naval_vessel',
    'government_facility',
    'embassy',
    'intelligence_facility',
    'power_plant',
    'dam',
    'telecommunications',
    'water_treatment',
    'research_facility',
    'test_range',
    'space_station',
    'archaeological_site',
    'volcano',
    'command_center',
    'residential',
    'commercial',
    'industrial',
    'agricultural',
    'wilderness',
    'ocean',
    'lake',
    'mountain',
    'desert',
    'forest',
    'urban',
    'suburban',
    'rural',
    'other',
    'unknown',
  ])
  .describe('Category of site at or near the observation location (military, nuclear, civilian, natural, etc.).');

export type SiteType = z.infer<typeof SiteTypeSchema>;

export const TerrainTypeSchema = z
  .enum([
    'ocean',
    'coastal',
    'lake',
    'river',
    'wetland',
    'plains',
    'hills',
    'mountains',
    'desert',
    'forest',
    'jungle',
    'tundra',
    'arctic',
    'urban',
    'suburban',
    'rural',
    'underground',
    'underwater',
    'airborne',
    'space',
    'unknown',
  ])
  .describe('Physical terrain at the observation location.');

export type TerrainType = z.infer<typeof TerrainTypeSchema>;

export const AirspaceClassSchema = z
  .enum([
    'A',
    'B',
    'C',
    'D',
    'E',
    'G',
    'restricted',
    'prohibited',
    'warning',
    'moa',
    'alert',
    'cfa',
    'national_security',
    'tfr',
    'international',
    'unknown',
  ])
  .describe('Airspace classification over the location (ICAO classes plus special-use airspace).');

export type AirspaceClass = z.infer<typeof AirspaceClassSchema>;

export const LocationSensitivitySchema = z
  .enum(['critical', 'high', 'moderate', 'standard', 'none'])
  .describe('How sensitive the location is (e.g. proximity to critical infrastructure).');

export type LocationSensitivity = z.infer<typeof LocationSensitivitySchema>;

export const ProximitySiteSchema = z
  .object({
    siteType: SiteTypeSchema,
    siteName: z.string().optional().describe('Name of the nearby site (e.g. "Naval Air Station Oceana").'),
    distanceKm: z.number().describe('Distance from the observation location, in kilometers.'),
    bearing: z.number().optional().describe('Compass bearing from the observation location to the site, in degrees (0–360).'),
  })
  .meta({ id: 'ProximitySite' })
  .describe('A site of interest near the observation and its distance/bearing.');

export type ProximitySite = z.infer<typeof ProximitySiteSchema>;

export const LocationDataSchema = z
  .object({
    id: z.string().min(1).describe('Stable unique identifier for this location.'),
    name: z.string().min(1).describe('Human-readable place name (e.g. "Off the coast of San Diego").'),
    country: z.string().min(1).describe('Country where the observation occurred.'),
    countryCode: z.string().optional().describe('ISO 3166-1 alpha-2 country code (e.g. "US").'),
    region: z.string().optional().describe('State, province, or administrative region.'),
    city: z.string().optional().describe('Nearest city or town.'),
    address: z.string().optional().describe('Street address, when the location is that precise.'),
    longitude: z.number().min(-180).max(180).describe('Longitude in decimal degrees (WGS 84).'),
    latitude: z.number().min(-90).max(90).describe('Latitude in decimal degrees (WGS 84).'),
    coordinatePrecision: CoordinatePrecisionSchema.optional(),
    coordinatePrecisionMeters: z
      .number()
      .optional()
      .describe('Numeric uncertainty radius of the coordinates, in meters.'),
    coordinatesApproximate: z
      .boolean()
      .optional()
      .describe('Whether the coordinates are an approximation rather than a measured fix.'),
    elevationMeters: z.number().optional().describe('Ground elevation at the location, in meters above sea level.'),
    elevationSource: z
      .enum(['gps', 'map', 'estimated', 'unknown'])
      .optional()
      .describe('How the elevation value was obtained.'),
    siteType: SiteTypeSchema,
    secondarySiteTypes: z
      .array(SiteTypeSchema)
      .optional()
      .describe('Additional site categories that also apply to the location.'),
    terrain: TerrainTypeSchema.optional(),
    airspaceClass: AirspaceClassSchema.optional(),
    locationSensitivity: LocationSensitivitySchema.optional(),
    proximitySites: z
      .array(ProximitySiteSchema)
      .optional()
      .describe('Named sites of interest near the observation, with distance and bearing.'),
    nearestMilitaryKm: z
      .number()
      .optional()
      .describe('Distance to the nearest military installation, in kilometers.'),
    nearestNuclearKm: z.number().optional().describe('Distance to the nearest nuclear facility, in kilometers.'),
    nearestAirportKm: z.number().optional().describe('Distance to the nearest airport, in kilometers.'),
    waterDepthMeters: z
      .number()
      .optional()
      .describe('Water depth at the location for maritime observations, in meters.'),
    vesselName: z.string().optional().describe('Name of the vessel the observer was aboard, if any.'),
    vesselType: z.string().optional().describe('Type of vessel (e.g. "aircraft carrier", "fishing trawler").'),
    aircraftType: z.string().optional().describe('Type of aircraft the observer was aboard, if any.'),
    aircraftCallsign: z.string().optional().describe('Callsign of the observer\u2019s aircraft.'),
    flightNumber: z.string().optional().describe('Commercial flight number, for airline observations.'),
    observerAltitudeMeters: z
      .number()
      .optional()
      .describe('Altitude of an airborne observer at the time of observation, in meters.'),
  })
  .meta({ id: 'LocationData' })
  .describe('Where an observation occurred — identity, coordinates, site classification, and proximity context.');

export type LocationData = z.infer<typeof LocationDataSchema>;

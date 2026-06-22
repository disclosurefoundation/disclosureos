import type { SourceType } from '../source/types';
import type { SourceCredibility } from '../source/credibility';
import type { TemporalCertainty } from '../temporal/certainty';
import type { TimeOfDay } from '../temporal/time-of-day';
import type { DateGranularity, DateRangeType, RelativeDate } from '../temporal/date-range';
import type { MediaType } from '../media/types';
import type { CoordinatePrecision, LocationSensitivity } from '../geo/location';
import type { ObjectShape, ConfidenceLevel, RelationKind } from '../observation/domains';
import type { PublicationStatus } from '../observation/types';
import type { ChainOfCustody } from '../extensions/provenance/custody';
import type { VerificationResult } from '../extensions/provenance/digital';
import type { EvidenceQuality } from '../extensions/physical/types';

export const SOURCE_TYPE_LABELS: Record<SourceType, string> = {
  foia: 'FOIA Release',
  official_report: 'Official Report',
  official_statement: 'Official Statement',
  congressional_testimony: 'Congressional Testimony',
  congressional_report: 'Congressional Report',
  military_document: 'Military Document',
  intelligence_document: 'Intelligence Document',
  whistleblower: 'Whistleblower',
  firsthand_witness: 'Firsthand Witness',
  secondhand_account: 'Secondhand Account',
  news_article: 'News Article',
  documentary: 'Documentary',
  interview: 'Interview',
  book: 'Book',
  academic_paper: 'Academic Paper',
  investigation_report: 'Investigation Report',
  database_entry: 'Database Entry',
  social_media: 'Social Media',
  website: 'Website',
  other: 'Other',
};

export const SOURCE_CREDIBILITY_LABELS: Record<SourceCredibility, string> = {
  official: 'Official',
  verified: 'Verified',
  credible: 'Credible',
  unverified: 'Unverified',
  questionable: 'Questionable',
  disputed: 'Disputed',
  unknown: 'Unknown',
};

export const TEMPORAL_CERTAINTY_LABELS: Record<TemporalCertainty, string> = {
  exact: 'Exact',
  approximate: 'Approximate',
  estimated: 'Estimated',
  unknown: 'Unknown',
};

export const DATE_GRANULARITY_LABELS: Record<DateGranularity, string> = {
  exact: 'Exact',
  month: 'Month',
  quarter: 'Quarter',
  year: 'Year',
  decade: 'Decade',
  century: 'Century',
  unknown: 'Unknown',
};

export const DATE_RANGE_TYPE_LABELS: Record<DateRangeType, string> = {
  span: 'Span',
  uncertainty: 'Uncertainty Window',
  active_period: 'Active Period',
  investigation_period: 'Investigation Period',
  observation_window: 'Observation Window',
};

export const RELATIVE_RELATION_LABELS: Record<RelativeDate['relation'], string> = {
  before: 'Before',
  after: 'After',
  during: 'During',
  around: 'Around',
};

export const TIME_OF_DAY_LABELS: Record<TimeOfDay, string> = {
  astronomical_dawn: 'Astronomical Dawn',
  nautical_dawn: 'Nautical Dawn',
  civil_dawn: 'Civil Dawn',
  sunrise: 'Sunrise',
  morning: 'Morning',
  noon: 'Noon',
  afternoon: 'Afternoon',
  sunset: 'Sunset',
  civil_dusk: 'Civil Dusk',
  nautical_dusk: 'Nautical Dusk',
  astronomical_dusk: 'Astronomical Dusk',
  night: 'Night',
  unknown: 'Unknown',
};

export const MEDIA_TYPE_LABELS: Record<MediaType, string> = {
  image: 'Image',
  video: 'Video',
  document: 'Document',
  audio: 'Audio',
};

export const COORDINATE_PRECISION_LABELS: Record<CoordinatePrecision, string> = {
  exact: 'Exact',
  address: 'Address',
  locality: 'Locality',
  region: 'Region',
  approximate: 'Approximate',
  unknown: 'Unknown',
};

export const LOCATION_SENSITIVITY_LABELS: Record<LocationSensitivity, string> = {
  critical: 'Critical',
  high: 'High',
  moderate: 'Moderate',
  standard: 'Standard',
  none: 'None',
};

export const OBJECT_SHAPE_LABELS: Record<ObjectShape, string> = {
  sphere: 'Sphere',
  orb: 'Orb',
  disc: 'Disc',
  saucer: 'Saucer',
  oval: 'Oval',
  egg: 'Egg',
  cylinder: 'Cylinder',
  cigar: 'Cigar',
  tic_tac: 'Tic Tac',
  triangle: 'Triangle',
  delta: 'Delta',
  boomerang: 'Boomerang',
  chevron: 'Chevron',
  diamond: 'Diamond',
  rectangle: 'Rectangle',
  square: 'Square',
  cube: 'Cube',
  cross: 'Cross',
  star: 'Star',
  amorphous: 'Amorphous',
  changing: 'Changing',
  light_only: 'Light Only',
  other: 'Other',
  unknown: 'Unknown',
};

export const RELATION_KIND_LABELS: Record<RelationKind, string> = {
  corroborates: 'Corroborates',
  contradicts: 'Contradicts',
  duplicate_of: 'Duplicate Of',
  same_object: 'Same Object',
  supersedes: 'Supersedes',
  superseded_by: 'Superseded By',
  re_analysis_of: 'Re-analysis Of',
  part_of: 'Part Of',
};

export const CONFIDENCE_LEVEL_LABELS: Record<ConfidenceLevel, string> = {
  very_high: 'Very High',
  high: 'High',
  moderate: 'Moderate',
  low: 'Low',
  very_low: 'Very Low',
  unassessed: 'Unassessed',
};

export const PUBLICATION_STATUS_LABELS: Record<PublicationStatus, string> = {
  draft: 'Draft',
  review: 'Under Review',
  published: 'Published',
  archived: 'Archived',
  retracted: 'Retracted',
};

export const CHAIN_OF_CUSTODY_LABELS: Record<ChainOfCustody, string> = {
  verified: 'Verified',
  partial: 'Partial',
  unverified: 'Unverified',
  government_held: 'Government Held',
  private_held: 'Privately Held',
  lost: 'Lost',
  destroyed: 'Destroyed',
  classified: 'Classified',
  unknown: 'Unknown',
};

export const VERIFICATION_RESULT_LABELS: Record<VerificationResult, string> = {
  authentic: 'Authentic',
  likely_authentic: 'Likely Authentic',
  inconclusive: 'Inconclusive',
  likely_manipulated: 'Likely Manipulated',
  manipulated: 'Manipulated',
  ai_generated: 'AI Generated',
  deepfake: 'Deepfake',
  composite: 'Composite',
  unknown: 'Unknown',
};

export const EVIDENCE_QUALITY_LABELS: Record<EvidenceQuality, string> = {
  laboratory_grade: 'Laboratory Grade',
  field_collected: 'Field Collected',
  uncontrolled: 'Uncontrolled',
  degraded: 'Degraded',
  contaminated: 'Contaminated',
  unknown: 'Unknown',
};

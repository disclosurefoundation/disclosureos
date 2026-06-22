import type { CoordinatePrecision } from '../geo/location';
import type { TemporalData } from '../temporal/temporal-data';
import type { FuzzyDate, DateRange, RelativeDate } from '../temporal/date-range';
import type { SourceType } from '../source/types';
import type { TimeOfDay } from '../temporal/time-of-day';
import {
  SOURCE_TYPE_LABELS, TEMPORAL_CERTAINTY_LABELS, TIME_OF_DAY_LABELS,
  COORDINATE_PRECISION_LABELS, RELATIVE_RELATION_LABELS,
} from '../labels';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;

function ordinal(n: number): string {
  const v = n % 100;
  if (v >= 11 && v <= 13) return `${n}th`;
  switch (n % 10) {
    case 1: return `${n}st`;
    case 2: return `${n}nd`;
    case 3: return `${n}rd`;
    default: return `${n}th`;
  }
}

/** Render a fuzzy date for display, honoring its granularity (e.g. "July 1947", "1950s", "20th century"). */
export function formatFuzzyDate(fd: FuzzyDate): string {
  if (fd.display) return fd.display;
  const [yearStr, monthStr] = fd.value.split('-');
  const year = Number(yearStr);
  const hasYear = Number.isFinite(year);
  switch (fd.granularity) {
    case 'month': {
      const m = Number(monthStr);
      if (hasYear && m >= 1 && m <= 12) return `${MONTH_NAMES[m - 1]} ${year}`;
      return fd.value;
    }
    case 'quarter':
      return hasYear && fd.quarter ? `Q${fd.quarter} ${year}` : fd.value;
    case 'year':
      return hasYear ? String(year) : fd.value;
    case 'decade':
      return hasYear ? `${Math.floor(year / 10) * 10}s` : fd.value;
    case 'century':
      return hasYear ? `${ordinal(Math.floor(year / 100) + 1)} century` : fd.value;
    case 'unknown':
      return fd.value || 'Unknown date';
    case 'exact':
    default:
      return fd.value;
  }
}

/** Render a date range, e.g. "1952 – 1957". */
export function formatDateRange(range: DateRange): string {
  if (range.display) return range.display;
  return `${formatFuzzyDate(range.start)} \u2013 ${formatFuzzyDate(range.end)}`;
}

/** Render a relative date, e.g. "3 days after the crash". */
export function formatRelativeDate(rel: RelativeDate): string {
  if (rel.display) return rel.display;
  const relation = RELATIVE_RELATION_LABELS[rel.relation].toLowerCase();
  const offset = rel.offset ? `${rel.offset.value} ${rel.offset.unit} ` : '';
  return `${offset}${relation} ${rel.referenceEvent}`.trim();
}

export function formatTemporalData(data: TemporalData): string {
  const parts: string[] = [];

  if (data.dateRange) {
    parts.push(formatDateRange(data.dateRange));
  } else if (data.dateGranularity && data.dateGranularity !== 'exact') {
    parts.push(
      formatFuzzyDate({ value: data.date, granularity: data.dateGranularity, certainty: data.dateCertainty }),
    );
  } else {
    parts.push(data.date);
  }

  if (data.time) parts.push(data.time);
  if (data.timezone) parts.push(`(${data.timezone})`);
  if (data.dateCertainty !== 'exact') {
    parts.push(`[${TEMPORAL_CERTAINTY_LABELS[data.dateCertainty]}]`);
  }
  if (data.relativeDate) parts.push(`(${formatRelativeDate(data.relativeDate)})`);

  return parts.join(' ');
}

export function formatSourceType(type: SourceType): string {
  return SOURCE_TYPE_LABELS[type];
}

export function formatTimeOfDay(tod: TimeOfDay): string {
  return TIME_OF_DAY_LABELS[tod];
}

export function formatCoordinatePrecision(precision: CoordinatePrecision): string {
  return COORDINATE_PRECISION_LABELS[precision];
}

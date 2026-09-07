import { expect, test } from 'vitest';
import { compareUtcInstants } from '../experimental/v2';
test('public UTC comparison preserves fractional precision and offsets', () => {
 expect(compareUtcInstants('2026-07-28T12:00:00.000000001Z','2026-07-28T12:00:00Z')).toBe(1);
 expect(compareUtcInstants('2026-07-28T12:00:00.10Z','2026-07-28T05:00:00.1-07:00')).toBe(0);
});
test('invalid timestamps cannot produce an ordering', () => {
 expect(compareUtcInstants('2026-02-30T12:00:00Z','2026-03-01T12:00:00Z')).toBeUndefined();
 expect(compareUtcInstants('2026-07-28T12:00Z','2026-07-28T12:00:00Z')).toBeUndefined();
});

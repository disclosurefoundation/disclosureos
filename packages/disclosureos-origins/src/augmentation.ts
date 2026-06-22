// Type-only anchor so TS treats the block below as an *augmentation* of the
// external `@disclosureos/records` module (not an ambient module declaration).
import type {} from '@disclosureos/records';
import type { OriginClassificationSlot } from './constants';

/**
 * Module augmentation entry point: importing `@disclosureos/origins` adds the `origin`
 * slot to `Observation` from `@disclosureos/records`.
 *
 * This file has no runtime output — it exists only to merge the declaration.
 * `src/index.ts` references it so the augmentation ships in the bundled types.
 */
declare module '@disclosureos/records' {
  interface ObservationExtensions {
    /**
     * Origin-hypothesis classification for this observation (OCS taxonomy).
     * Typed automatically wherever `@disclosureos/origins` is imported.
     */
    origin?: OriginClassificationSlot;
  }
}

export {};

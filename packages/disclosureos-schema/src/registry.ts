/**
 * `ExtensionRegistry` — the runtime mirror of the TypeScript module augmentation.
 *
 * In TS, importing `@disclosureos/observables` / `@disclosureos/origins` augments
 * `Observation` with the `observableAssessments` / `origin` slots. That augmentation
 * is compile-time only — invisible to JSON Schema, Python, or any non-TS consumer.
 *
 * This registry makes the same fact available at runtime: it maps each satellite
 * slot to its owner package, canonical schema `$id`, version, and a function that
 * emits the slot's standalone JSON Schema. {@link composeObservationSchema} walks
 * the registry to fold every registered slot into one enriched `Observation` schema,
 * so adding a new first-party (or third-party) slot is a single `register()` call —
 * no edit to the composition logic OR the validation logic: {@link composeObservationSchema}
 * walks the registry for JSON Schema and `parseEnrichedObservation` walks it for runtime
 * validation, both driven entirely by what is registered.
 */
import type { ValidationIssue } from '@disclosureos/records/shared';

/** One satellite slot on `Observation`, described for runtime composition. */
export interface SlotRegistration {
  /** Property name on `Observation` (e.g. `"observableAssessments"`, `"origin"`). */
  slot: string;
  /** Package that owns the slot (e.g. `"@disclosureos/observables"`). */
  owner: string;
  /** Canonical, versioned `$id` of the slot's standalone JSON Schema. */
  schemaId: string;
  /** Schema version of the slot (its `x-schema-version`). */
  version: string;
  /**
   * Emit the slot's standalone JSON Schema (the same enveloped artifact the owner
   * package commits). Called by {@link composeObservationSchema} during merge.
   */
  jsonSchema: () => Record<string, unknown>;
  /**
   * Validate the slot's value with the owner package's canonical, schema-backed
   * validator. Called by `parseEnrichedObservation` for every present slot, so
   * enriched validation stays brand-free (each package validates with its own Zod)
   * and registry-driven (no slot is hard-coded in the parse path).
   */
  validate: (value: unknown) => ValidationIssue[];
}

/**
 * A mutable map of `slot → registration`. Use the shared {@link defaultRegistry}
 * for the first-party slots; construct your own only for isolated tests or to
 * compose a custom subset of slots.
 */
export class ExtensionRegistry {
  private readonly slots = new Map<string, SlotRegistration>();

  /**
   * Register a slot. Throws on a duplicate slot name (one owner per slot).
   *
   * @experimental First-party slots (observables, origins) are registered for you
   * on {@link defaultRegistry}. Registering *third-party* slots is supported but the
   * extensibility contract (how external slots compose, version, and resolve) is
   * still settling and may change in a minor release.
   */
  register(registration: SlotRegistration): this {
    if (this.slots.has(registration.slot)) {
      const existing = this.slots.get(registration.slot)!;
      throw new Error(
        `Slot "${registration.slot}" is already registered by ${existing.owner}; `
          + `cannot re-register it for ${registration.owner}.`,
      );
    }
    this.slots.set(registration.slot, registration);
    return this;
  }

  /** Look up a slot's registration, or `undefined` if not registered. */
  get(slot: string): SlotRegistration | undefined {
    return this.slots.get(slot);
  }

  /** Whether a slot is registered. */
  has(slot: string): boolean {
    return this.slots.has(slot);
  }

  /** All registrations, in insertion order. */
  list(): SlotRegistration[] {
    return [...this.slots.values()];
  }
}

/**
 * The shared registry, pre-populated with the first-party satellite slots. Import
 * sites that need the full enriched contract should use this; it is the runtime
 * counterpart to importing both satellite packages for their TS augmentation.
 */
export const defaultRegistry = new ExtensionRegistry();

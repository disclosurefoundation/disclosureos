import { describe, it, expect } from 'vitest';
import { ObservationSchema } from '../observation/types';

/**
 * The foundation's Zod 4 schemas implement the Standard Schema v1 spec
 * (https://standardschema.dev) via the `~standard` property, so any
 * Standard-Schema-compatible validator/framework can consume them without a
 * DisclosureOS-specific adapter. Every foundation package shares one
 * catalog-pinned Zod, so guarding the substrate schema here guards them all
 * against an accidental downgrade that would drop the interface.
 */
describe('Standard Schema v1 compliance', () => {
  const standard = (ObservationSchema as { '~standard'?: unknown })['~standard'] as
    | { version: number; vendor: string; validate: unknown }
    | undefined;

  it('exposes the ~standard interface', () => {
    expect(standard).toBeDefined();
  });

  it('declares Standard Schema v1', () => {
    expect(standard?.version).toBe(1);
    expect(standard?.vendor).toBe('zod');
  });

  it('exposes a validate function', () => {
    expect(typeof standard?.validate).toBe('function');
  });
});

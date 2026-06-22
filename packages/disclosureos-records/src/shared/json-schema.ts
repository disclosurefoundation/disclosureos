/**
 * Shared JSON-Schema emission helpers.
 *
 * Every DisclosureOS package emits a committed, versioned JSON Schema artifact
 * wrapped in the same draft + `$id` + version envelope. These helpers own that
 * envelope so the four `schema.ts` files don't each copy it.
 *
 * They take/return PLAIN DATA only (objects + strings) — never a Zod schema —
 * so they stay free of Zod's cross-package version brand. The
 * `z.toJSONSchema(..., { target: 'draft-2020-12' })` call stays inside each
 * package, operating on its own Zod instance.
 */

const JSON_SCHEMA_DRAFT = 'https://json-schema.org/draft/2020-12/schema' as const;
const SCHEMA_HOST = 'https://os.disclosure.org/schema' as const;

/** Build the canonical, versioned `$id` URL for a DisclosureOS schema artifact. */
export function schemaId(domain: string, file: string, version: string): string {
  return `${SCHEMA_HOST}/${domain}/${version}/${file}.json`;
}

/**
 * Wrap an emitted JSON-Schema body in the standard draft + `$id` + version
 * envelope. `body` is the output of `z.toJSONSchema(...)`.
 */
export function jsonSchemaEnvelope(
  body: Record<string, unknown>,
  meta: { id: string; version: string },
): Record<string, unknown> {
  return {
    $schema: JSON_SCHEMA_DRAFT,
    $id: meta.id,
    'x-schema-version': meta.version,
    ...body,
  };
}

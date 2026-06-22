/**
 * Layer-3 nominal brand. `OCSNodeId` lives here (not in `records/shared`) because
 * the OCS taxonomy is an origins concern — the Layer-1 substrate stays agnostic
 * about classification. A branded value is a plain string at runtime; the brand
 * only constrains assignment at compile time and never touches emitted JSON Schema.
 */

declare const __ocsBrand: unique symbol;

/** Validated OCS taxonomy node id (e.g. `1.1.3`). */
export type OCSNodeId = string & { readonly [__ocsBrand]: 'OCSNodeId' };

export function asOCSNodeId(value: string): OCSNodeId {
  return value as OCSNodeId;
}

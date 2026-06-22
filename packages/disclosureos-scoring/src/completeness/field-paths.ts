import { recordsJsonSchema } from '@disclosureos/records';

/** A leaf field path derived from the records JSON Schema. */
export interface FieldPath {
  /** Dot-path into an `Observation` (e.g. `location.latitude`). */
  path: string;
  /** True only when every segment along the path is schema-required. */
  required: boolean;
}

interface SchemaNode {
  $ref?: string;
  properties?: Record<string, SchemaNode>;
  required?: string[];
  type?: string | string[];
}

function refName(ref: string): string {
  return ref.replace('#/$defs/', '');
}

/**
 * Walk the committed records JSON Schema and enumerate every leaf field path on
 * `Observation`. Objects are recursed (resolving `$ref` into `$defs`); arrays,
 * enums, scalars, and `record`/`anyOf` nodes are treated as leaves. This is the
 * single source of completeness coverage — there is no hand-maintained path list
 * (so adding a field to the schema automatically extends completeness).
 */
export function deriveFieldPaths(schema?: Record<string, unknown>): FieldPath[] {
  const root = (schema ?? recordsJsonSchema()) as Record<string, unknown> & {
    $ref?: string;
    $defs?: Record<string, SchemaNode>;
  };
  const defs = root.$defs ?? {};
  const out: FieldPath[] = [];

  function resolve(node: SchemaNode): SchemaNode {
    let cur: SchemaNode = node;
    const seen = new Set<string>();
    while (cur.$ref) {
      const name = refName(cur.$ref);
      if (seen.has(name)) break;
      seen.add(name);
      cur = defs[name] ?? {};
    }
    return cur;
  }

  function walk(node: SchemaNode, prefix: string, required: boolean, visited: Set<string>): void {
    const refn = node.$ref ? refName(node.$ref) : undefined;
    // Cycle guard: a recursive $ref re-entering an in-progress def becomes a leaf.
    if (refn && visited.has(refn)) {
      if (prefix) out.push({ path: prefix, required });
      return;
    }
    const resolved = resolve(node);
    const props = resolved.properties;
    if (props && Object.keys(props).length > 0) {
      const nextVisited = refn ? new Set([...visited, refn]) : visited;
      const req = new Set(resolved.required ?? []);
      for (const [key, child] of Object.entries(props)) {
        const childPath = prefix ? `${prefix}.${key}` : key;
        walk(child, childPath, required && req.has(key), nextVisited);
      }
      return;
    }
    if (prefix) out.push({ path: prefix, required });
  }

  if (root.$ref) {
    walk({ $ref: root.$ref }, '', true, new Set());
  }
  return out;
}

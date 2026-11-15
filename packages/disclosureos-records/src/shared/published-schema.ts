/** Keep the published JSON Schema spelling when a dependency changes only emission.
 * This receives plain JSON, never schemas from another package's Zod instance.
 * These rewrites are equivalent under draft 2020-12; contract drift still fails CI.
 */
const publishedDatetimePatterns = new Map<string, string>([
  ["^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$", "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$"],
  ["^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$", "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z))$"],
]);

export function preservePublishedSchema<T extends Record<string, unknown>>(body: T): T {
  const visit = (value: unknown, secondsRequired = false): unknown => {
    if (Array.isArray(value)) return value.map(item => visit(item, secondsRequired));
    if (!value || typeof value !== 'object') return value;
    const source = value as Record<string, unknown>;
    const result: Record<string, unknown> = { ...source };
    const allOf = source.allOf as Array<Record<string, unknown>> | undefined;
    const hasSeconds = secondsRequired || source.format === 'date-time' ||
      (Array.isArray(allOf) && allOf.some(item => item.pattern === 'T[0-9]{2}:[0-9]{2}:[0-9]{2}'));
    // Only schema-bearing keywords are traversed. Example and default data stay literal.
    for (const key of ['$defs', 'definitions', 'properties', 'patternProperties', 'dependentSchemas']) {
      const entries = source[key];
      if (entries && typeof entries === 'object' && !Array.isArray(entries)) {
        result[key] = Object.fromEntries(Object.entries(entries).map(([name, schema]) => [name, visit(schema)]));
      }
    }
    for (const key of ['items', 'additionalProperties', 'contains', 'not', 'if', 'then', 'else', 'propertyNames', 'unevaluatedItems', 'unevaluatedProperties']) {
      if (key in source) result[key] = visit(source[key]);
    }
    for (const key of ['allOf', 'anyOf', 'oneOf', 'prefixItems']) {
      if (key in source) result[key] = visit(source[key], key === 'allOf' && hasSeconds);
    }
    if (hasSeconds && typeof source.pattern === 'string' && publishedDatetimePatterns.has(source.pattern)) {
      result.pattern = publishedDatetimePatterns.get(source.pattern);
    }
    // A union of bare JSON types is equivalent to anyOf; retain our existing spelling.
    if (Array.isArray(source.type) && source.type.length > 1 && !('anyOf' in source)) {
      delete result.type;
      result.anyOf = source.type.map(type => ({ type }));
    }
    // maxItems already forbids a tail after a fixed tuple; items:false is redundant.
    if (source.items === false && Array.isArray(source.prefixItems) && source.maxItems === source.prefixItems.length) {
      delete result.items;
    }
    return result;
  };
  return visit(body) as T;
}

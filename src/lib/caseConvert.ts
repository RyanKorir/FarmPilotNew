/**
 * Bidirectional camelCase ↔ snake_case conversion.
 * Keeps all component logic unchanged; only the persistence layer
 * uses snake_case (Supabase/Postgres convention).
 */

function toSnakeCase(str: string): string {
  return str
    .replace(/([A-Z])/g, '_$1')
    .toLowerCase()
    .replace(/^_/, '');
}

function toCamelCase(str: string): string {
  return str.replace(/_([a-z])/g, (_, char) => char.toUpperCase());
}

type PlainObject = Record<string, unknown>;

function isPlainObject(value: unknown): value is PlainObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Recursively converts all object keys from camelCase → snake_case. */
export function toSnakeCaseDeep(obj: unknown): unknown {
  if (Array.isArray(obj)) return obj.map(toSnakeCaseDeep);
  if (isPlainObject(obj)) {
    return Object.fromEntries(
      Object.entries(obj).map(([k, v]) => [toSnakeCase(k), toSnakeCaseDeep(v)])
    );
  }
  return obj;
}

/** Recursively converts all object keys from snake_case → camelCase. */
export function toCamelCaseDeep(obj: unknown): unknown {
  if (Array.isArray(obj)) return obj.map(toCamelCaseDeep);
  if (isPlainObject(obj)) {
    return Object.fromEntries(
      Object.entries(obj).map(([k, v]) => [toCamelCase(k), toCamelCaseDeep(v)])
    );
  }
  return obj;
}

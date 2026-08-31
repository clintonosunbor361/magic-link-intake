import { and, or, sql, type SQL } from "drizzle-orm";

export function splitSearchTokens(search: string): string[] {
  return search
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .map((token) => token.replace(/[%_]/g, ""))
    .filter(Boolean);
}

export function tokenSearchCondition(tokens: string[], fields: SQL<unknown>[]): SQL<unknown> | undefined {
  const conditions = tokens
    .map((token) => {
      const term = `%${token}%`;
      return or(...fields.map((field) => sql`${field} like ${term}`));
    })
    .filter(Boolean);

  if (conditions.length === 0) return undefined;
  return and(...conditions);
}

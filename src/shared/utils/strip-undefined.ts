/**
 * Why this file exists: with `exactOptionalPropertyTypes: true` (this
 * project's tsconfig), an optional field typed `field?: string` accepts
 * "key absent" but NOT "key present with value `undefined`" — so a Zod
 * `.partial()` schema's parsed output (which explicitly sets untouched
 * fields to `undefined` rather than omitting the key) is not directly
 * assignable to a Prisma `update()` call's `data` argument. This strips
 * every `undefined`-valued key, leaving only keys the caller actually
 * provided a value for — turning "explicitly undefined" back into
 * "absent," which is what a partial update should mean.
 *
 * Dependencies: none.
 * Future usage: every service's update method that forwards a parsed
 * partial-update DTO to its repository's `update()`.
 */
/**
 * `NoUndefinedValues<T>` is a homomorphic mapped type: it keeps each key
 * of T exactly as optional/required as T declared it, but excludes
 * `undefined` from the VALUE type. That's the piece `Partial<T>` alone
 * doesn't fix — a Zod `.partial()` field is already `name?: string`, but
 * its parsed value type is `string | undefined`, and it's that trailing
 * `| undefined` in the value (not the optional key) that
 * exactOptionalPropertyTypes objects to.
 */
type NoUndefinedValues<T> = { [K in keyof T]: Exclude<T[K], undefined> };

export function stripUndefined<T extends Record<string, unknown>>(input: T): NoUndefinedValues<T> {
  const result = {} as NoUndefinedValues<T>;
  for (const key of Object.keys(input) as Array<keyof T>) {
    const value = input[key];
    if (value !== undefined) {
      result[key] = value as NoUndefinedValues<T>[typeof key];
    }
  }
  return result;
}

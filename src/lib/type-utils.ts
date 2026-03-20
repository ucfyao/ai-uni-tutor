import type { Json } from '@/types/database';

/** Cast a known-shape value to Supabase Json type. Centralizes `as unknown as Json` casts. */
export function toJson<T>(value: T): Json {
  return value as unknown as Json;
}

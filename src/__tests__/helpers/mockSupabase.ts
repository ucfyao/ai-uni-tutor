/**
 * Mock Supabase Client Factory
 *
 * Creates a chainable Supabase client mock supporting common query patterns:
 *   .from().select().eq().single()
 *   .from().insert().select().single()
 *   .from().update().eq()
 *   .from().delete().eq()
 *   .from().select().eq().order()
 *   .rpc()
 *
 * Usage:
 *   const { client, setResponse, setSingleResponse, setQueryResponse, reset } = createMockSupabase();
 *   vi.mocked(createClient).mockResolvedValue(client as any);
 *   setSingleResponse({ id: '1', name: 'Test' });
 */

import { vi } from 'vitest';

/** Supabase PGRST116: "Searched for a single row but found 0 rows" */
export const PGRST116 = { code: 'PGRST116', message: 'Row not found', details: '', hint: '' };

/** Create a standard Supabase error object */
export function dbError(
  message: string,
  code = 'PGRST000',
): { code: string; message: string; details: string; hint: string } {
  return { code, message, details: '', hint: '' };
}

export interface MockSupabaseResult {
  /** The mock client to inject. Cast as `any` when passing to mocked createClient. */
  client: ReturnType<typeof buildMockClient>;
  /** Set the terminal response for all chain endings (select, single, insert, update, delete, rpc). */
  setResponse: (data: unknown, error?: unknown) => void;
  /** Shorthand: set a `.single()` response (data + null error). */
  setSingleResponse: (data: unknown) => void;
  /** Shorthand: set a query (list) response (data array + null error). */
  setQueryResponse: (data: unknown[]) => void;
  /** Shorthand: set an error response. */
  setErrorResponse: (error: {
    code: string;
    message: string;
    details: string;
    hint: string;
  }) => void;
  /** Reset all mock state. */
  reset: () => void;
}

function buildMockClient() {
  let _response: { data: unknown; error: unknown } = { data: null, error: null };

  const resolveResponse = () => Promise.resolve({ data: _response.data, error: _response.error });

  // Build a chainable mock: every method returns `chain` so calls can be composed in any order.
  // Terminal methods (single, then-able ending) resolve the stored response.
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};

  const methods = [
    'select',
    'insert',
    'update',
    'delete',
    'upsert',
    'eq',
    'neq',
    'gt',
    'gte',
    'lt',
    'lte',
    'like',
    'ilike',
    'is',
    'in',
    'or',
    'not',
    'order',
    'limit',
    'range',
    'match',
    'filter',
    'contains',
    'containedBy',
    'textSearch',
    'maybeSingle',
  ];

  // All chainable methods return `chain` (which is also thenable).
  for (const method of methods) {
    chain[method] = vi.fn().mockReturnValue(chain);
  }

  // `single()` is a terminal that resolves
  chain.single = vi.fn().mockImplementation(() => resolveResponse());

  // Make the chain itself thenable (for queries that don't end with .single())
  // When used with `await supabase.from('x').select('*').eq('y', z)` (no .single()),
  // the await resolves the chain. We use `.then` on the chain object.
  chain.then = vi.fn().mockImplementation((resolve: (v: unknown) => void) => {
    return resolveResponse().then(resolve);
  });

  // `from` returns the chain
  const from = vi.fn().mockReturnValue(chain);

  // `rpc` resolves directly
  const rpc = vi.fn().mockImplementation(() => resolveResponse());

  const auth = {
    getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
  };

  const client = { from, rpc, auth, _chain: chain };

  return Object.assign(client, {
    _setResponse(data: unknown, error: unknown) {
      _response = { data, error };
    },
    _reset() {
      _response = { data: null, error: null };
      from.mockClear().mockReturnValue(chain);
      rpc.mockClear().mockImplementation(() => resolveResponse());
      auth.getUser.mockClear().mockResolvedValue({ data: { user: null }, error: null });
      for (const method of methods) {
        chain[method].mockClear().mockReturnValue(chain);
      }
      chain.single.mockClear().mockImplementation(() => resolveResponse());
      chain.then.mockClear().mockImplementation((resolve: (v: unknown) => void) => {
        return resolveResponse().then(resolve);
      });
    },
  });
}

export function createMockSupabase(): MockSupabaseResult {
  const client = buildMockClient();

  return {
    client,
    setResponse(data: unknown, error: unknown = null) {
      client._setResponse(data, error);
    },
    setSingleResponse(data: unknown) {
      client._setResponse(data, null);
    },
    setQueryResponse(data: unknown[]) {
      client._setResponse(data, null);
    },
    setErrorResponse(error: { code: string; message: string; details: string; hint: string }) {
      client._setResponse(null, error);
    },
    reset() {
      client._reset();
    },
  };
}

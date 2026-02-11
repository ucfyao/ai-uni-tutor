/**
 * Unified action response types.
 *
 * ActionResult<T>    – for non-form server actions (discriminated union on `success`).
 * FormActionState    – for useActionState-bound form actions (status enum).
 */

/** Discriminated union for non-form server actions. */
export type ActionResult<T> = { success: true; data: T } | { success: false; error: string };

/** State shape for React useActionState-bound form actions. */
export type FormActionState = {
  status: 'idle' | 'success' | 'error';
  message: string;
};

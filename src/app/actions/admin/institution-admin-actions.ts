'use server';

import { z } from 'zod';
import { mapError } from '@/lib/errors';
import { getInstitutionService } from '@/lib/services/InstitutionService';
import { requireAnyAdmin } from '@/lib/supabase/server';
import type { ActionResult } from '@/types/actions';
import type { InstitutionEntity } from '@/types/institution';

// ============================================================================
// Schemas
// ============================================================================

const createInstitutionSchema = z.object({
  name: z.string().min(2).max(255),
  adminUserId: z.string().uuid(),
  commissionRate: z.number().min(0).max(1).optional(),
  contactInfo: z.record(z.string(), z.unknown()).optional(),
});

const listInstitutionsSchema = z.object({
  isActive: z.boolean().optional(),
});

const updateInstitutionSchema = z.object({
  institutionId: z.string().uuid(),
  name: z.string().min(2).max(255).optional(),
  commissionRate: z.number().min(0).max(1).optional(),
  contactInfo: z.record(z.string(), z.unknown()).optional(),
  isActive: z.boolean().optional(),
});

// ============================================================================
// Actions
// ============================================================================

export async function createInstitution(input: unknown): Promise<ActionResult<string>> {
  const parsed = createInstitutionSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: 'Invalid input', code: 'VALIDATION' };

  try {
    await requireAnyAdmin();
    const service = getInstitutionService();
    const institutionId = await service.createInstitution({
      name: parsed.data.name,
      adminId: parsed.data.adminUserId,
      commissionRate: parsed.data.commissionRate,
      contactInfo: parsed.data.contactInfo,
    });
    return { success: true, data: institutionId };
  } catch (error) {
    return mapError(error);
  }
}

export async function listInstitutions(input: unknown): Promise<ActionResult<InstitutionEntity[]>> {
  const parsed = listInstitutionsSchema.safeParse(input ?? {});
  if (!parsed.success) return { success: false, error: 'Invalid input', code: 'VALIDATION' };

  try {
    await requireAnyAdmin();
    const service = getInstitutionService();
    const institutions = await service.listInstitutions(parsed.data.isActive);
    return { success: true, data: institutions };
  } catch (error) {
    return mapError(error);
  }
}

export async function updateInstitution(input: unknown): Promise<ActionResult<void>> {
  const parsed = updateInstitutionSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: 'Invalid input', code: 'VALIDATION' };

  try {
    await requireAnyAdmin();
    const service = getInstitutionService();
    const { institutionId, ...updates } = parsed.data;
    await service.updateInstitution(institutionId, updates);
    return { success: true, data: undefined };
  } catch (error) {
    return mapError(error);
  }
}

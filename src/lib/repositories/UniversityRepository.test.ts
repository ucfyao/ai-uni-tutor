/**
 * UniversityRepository Tests
 *
 * Tests all university-related database operations including
 * CRUD, published filters, entity mapping, and error handling.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createMockSupabase,
  dbError,
  PGRST116,
  type MockSupabaseResult,
} from '@/__tests__/helpers/mockSupabase';
import { DatabaseError } from '@/lib/errors';

// ── Mocks ──

let mockSupabase: MockSupabaseResult;

vi.mock('@/lib/supabase/server', () => {
  mockSupabase = createMockSupabase();
  return {
    createClient: vi.fn().mockResolvedValue(mockSupabase.client),
  };
});

// Import after mocks
const { UniversityRepository } = await import('./UniversityRepository');

// ── Test Data ──

const universityRow = {
  id: 'uni-1',
  name: 'University of Melbourne',
  short_name: 'UoM',
  logo_url: 'https://example.com/logo.png',
  is_published: true,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-02T00:00:00Z',
};

const universityEntity = {
  id: 'uni-1',
  name: 'University of Melbourne',
  shortName: 'UoM',
  logoUrl: 'https://example.com/logo.png',
  isPublished: true,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-02T00:00:00Z'),
};

const universityRow2 = {
  id: 'uni-2',
  name: 'Monash University',
  short_name: 'Monash',
  logo_url: null,
  is_published: false,
  created_at: '2026-02-01T00:00:00Z',
  updated_at: '2026-02-02T00:00:00Z',
};

const universityEntity2 = {
  id: 'uni-2',
  name: 'Monash University',
  shortName: 'Monash',
  logoUrl: null,
  isPublished: false,
  createdAt: new Date('2026-02-01T00:00:00Z'),
  updatedAt: new Date('2026-02-02T00:00:00Z'),
};

describe('UniversityRepository', () => {
  let repo: InstanceType<typeof UniversityRepository>;

  beforeEach(() => {
    repo = new UniversityRepository();
    mockSupabase.reset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── findAll ──

  describe('findAll', () => {
    it('should return all universities mapped to entities', async () => {
      mockSupabase.setQueryResponse([universityRow, universityRow2]);

      const result = await repo.findAll();

      expect(result).toEqual([universityEntity, universityEntity2]);
      expect(mockSupabase.client.from).toHaveBeenCalledWith('universities');
      expect(mockSupabase.client._chain.select).toHaveBeenCalledWith('*');
      expect(mockSupabase.client._chain.order).toHaveBeenCalledWith('name', {
        ascending: true,
      });
    });

    it('should return an empty array when no universities exist', async () => {
      mockSupabase.setQueryResponse([]);

      const result = await repo.findAll();

      expect(result).toEqual([]);
    });

    it('should return an empty array when data is null', async () => {
      mockSupabase.setResponse(null);

      const result = await repo.findAll();

      expect(result).toEqual([]);
    });

    it('should throw DatabaseError on error', async () => {
      mockSupabase.setErrorResponse(dbError('Connection error'));

      await expect(repo.findAll()).rejects.toThrow(DatabaseError);
      await expect(repo.findAll()).rejects.toThrow('Failed to fetch universities');
    });
  });

  // ── findById ──

  describe('findById', () => {
    it('should return a university entity when found', async () => {
      mockSupabase.setSingleResponse(universityRow);

      const result = await repo.findById('uni-1');

      expect(result).toEqual(universityEntity);
      expect(mockSupabase.client.from).toHaveBeenCalledWith('universities');
      expect(mockSupabase.client._chain.select).toHaveBeenCalledWith('*');
      expect(mockSupabase.client._chain.eq).toHaveBeenCalledWith('id', 'uni-1');
      expect(mockSupabase.client._chain.single).toHaveBeenCalled();
    });

    it('should return null when university not found (PGRST116)', async () => {
      mockSupabase.setErrorResponse(PGRST116);

      const result = await repo.findById('nonexistent');

      expect(result).toBeNull();
    });

    it('should return null when data is null', async () => {
      mockSupabase.setSingleResponse(null);

      const result = await repo.findById('uni-1');

      expect(result).toBeNull();
    });

    it('should throw DatabaseError on other errors', async () => {
      mockSupabase.setErrorResponse(dbError('Server error'));

      await expect(repo.findById('uni-1')).rejects.toThrow(DatabaseError);
      await expect(repo.findById('uni-1')).rejects.toThrow('Failed to fetch university');
    });
  });

  // ── create ──

  describe('create', () => {
    it('should insert a university and return the entity', async () => {
      mockSupabase.setSingleResponse(universityRow);

      const result = await repo.create({
        name: 'University of Melbourne',
        shortName: 'UoM',
        logoUrl: 'https://example.com/logo.png',
        isPublished: true,
      });

      expect(result).toEqual(universityEntity);
      expect(mockSupabase.client.from).toHaveBeenCalledWith('universities');
      expect(mockSupabase.client._chain.insert).toHaveBeenCalledWith({
        name: 'University of Melbourne',
        short_name: 'UoM',
        logo_url: 'https://example.com/logo.png',
        is_published: true,
      });
      expect(mockSupabase.client._chain.select).toHaveBeenCalled();
      expect(mockSupabase.client._chain.single).toHaveBeenCalled();
    });

    it('should default isPublished to false when not provided', async () => {
      mockSupabase.setSingleResponse(universityRow);

      await repo.create({
        name: 'Test University',
        shortName: 'TU',
      });

      expect(mockSupabase.client._chain.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          is_published: false,
        }),
      );
    });

    it('should default logoUrl to null when not provided', async () => {
      mockSupabase.setSingleResponse(universityRow2);

      await repo.create({
        name: 'Monash University',
        shortName: 'Monash',
      });

      expect(mockSupabase.client._chain.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          logo_url: null,
        }),
      );
    });

    it('should throw DatabaseError on insert error', async () => {
      mockSupabase.setErrorResponse(dbError('Insert failed'));

      await expect(
        repo.create({ name: 'Test', shortName: 'T' }),
      ).rejects.toThrow(DatabaseError);
      await expect(
        repo.create({ name: 'Test', shortName: 'T' }),
      ).rejects.toThrow('Failed to create university');
    });

    it('should throw DatabaseError when data is null after insert', async () => {
      mockSupabase.setSingleResponse(null);

      await expect(
        repo.create({ name: 'Test', shortName: 'T' }),
      ).rejects.toThrow(DatabaseError);
    });
  });

  // ── update ──

  describe('update', () => {
    it('should update a university and return the entity', async () => {
      mockSupabase.setSingleResponse(universityRow);

      const result = await repo.update('uni-1', { name: 'Updated University' });

      expect(result).toEqual(universityEntity);
      expect(mockSupabase.client.from).toHaveBeenCalledWith('universities');
      expect(mockSupabase.client._chain.update).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Updated University',
          updated_at: expect.any(String),
        }),
      );
      expect(mockSupabase.client._chain.eq).toHaveBeenCalledWith('id', 'uni-1');
      expect(mockSupabase.client._chain.select).toHaveBeenCalled();
      expect(mockSupabase.client._chain.single).toHaveBeenCalled();
    });

    it('should map shortName to short_name', async () => {
      mockSupabase.setSingleResponse(universityRow);

      await repo.update('uni-1', { shortName: 'UM' });

      expect(mockSupabase.client._chain.update).toHaveBeenCalledWith(
        expect.objectContaining({
          short_name: 'UM',
        }),
      );
    });

    it('should map logoUrl to logo_url', async () => {
      mockSupabase.setSingleResponse(universityRow);

      await repo.update('uni-1', { logoUrl: 'https://new-logo.png' });

      expect(mockSupabase.client._chain.update).toHaveBeenCalledWith(
        expect.objectContaining({
          logo_url: 'https://new-logo.png',
        }),
      );
    });

    it('should map isPublished to is_published', async () => {
      mockSupabase.setSingleResponse(universityRow);

      await repo.update('uni-1', { isPublished: false });

      expect(mockSupabase.client._chain.update).toHaveBeenCalledWith(
        expect.objectContaining({
          is_published: false,
        }),
      );
    });

    it('should always include updated_at', async () => {
      mockSupabase.setSingleResponse(universityRow);

      await repo.update('uni-1', {});

      expect(mockSupabase.client._chain.update).toHaveBeenCalledWith(
        expect.objectContaining({
          updated_at: expect.any(String),
        }),
      );
    });

    it('should handle multiple fields at once', async () => {
      mockSupabase.setSingleResponse(universityRow);

      await repo.update('uni-1', {
        name: 'New Name',
        shortName: 'NN',
        isPublished: true,
      });

      expect(mockSupabase.client._chain.update).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'New Name',
          short_name: 'NN',
          is_published: true,
          updated_at: expect.any(String),
        }),
      );
    });

    it('should throw DatabaseError on update error', async () => {
      mockSupabase.setErrorResponse(dbError('Update failed'));

      await expect(repo.update('uni-1', { name: 'Test' })).rejects.toThrow(DatabaseError);
      await expect(repo.update('uni-1', { name: 'Test' })).rejects.toThrow(
        'Failed to update university',
      );
    });

    it('should throw DatabaseError when data is null after update', async () => {
      mockSupabase.setSingleResponse(null);

      await expect(repo.update('uni-1', { name: 'Test' })).rejects.toThrow(DatabaseError);
    });
  });

  // ── findAllPublished ──

  describe('findAllPublished', () => {
    it('should return only published universities', async () => {
      mockSupabase.setQueryResponse([universityRow]);

      const result = await repo.findAllPublished();

      expect(result).toEqual([universityEntity]);
      expect(mockSupabase.client.from).toHaveBeenCalledWith('universities');
      expect(mockSupabase.client._chain.select).toHaveBeenCalledWith('*');
      expect(mockSupabase.client._chain.eq).toHaveBeenCalledWith('is_published', true);
      expect(mockSupabase.client._chain.order).toHaveBeenCalledWith('name', {
        ascending: true,
      });
    });

    it('should return an empty array when no published universities exist', async () => {
      mockSupabase.setQueryResponse([]);

      const result = await repo.findAllPublished();

      expect(result).toEqual([]);
    });

    it('should throw DatabaseError on error', async () => {
      mockSupabase.setErrorResponse(dbError('Fetch error'));

      await expect(repo.findAllPublished()).rejects.toThrow(DatabaseError);
      await expect(repo.findAllPublished()).rejects.toThrow(
        'Failed to fetch published universities',
      );
    });
  });

  // ── delete ──

  describe('delete', () => {
    it('should delete a university by ID', async () => {
      mockSupabase.setResponse(null);

      await repo.delete('uni-1');

      expect(mockSupabase.client.from).toHaveBeenCalledWith('universities');
      expect(mockSupabase.client._chain.delete).toHaveBeenCalled();
      expect(mockSupabase.client._chain.eq).toHaveBeenCalledWith('id', 'uni-1');
    });

    it('should not throw on success', async () => {
      mockSupabase.setResponse(null);

      await expect(repo.delete('uni-1')).resolves.toBeUndefined();
    });

    it('should throw DatabaseError on error', async () => {
      mockSupabase.setErrorResponse(dbError('Delete failed'));

      await expect(repo.delete('uni-1')).rejects.toThrow(DatabaseError);
      await expect(repo.delete('uni-1')).rejects.toThrow('Failed to delete university');
    });
  });

  // ── Entity mapping ──

  describe('entity mapping', () => {
    it('should convert snake_case row to camelCase entity', async () => {
      mockSupabase.setSingleResponse(universityRow);

      const result = await repo.findById('uni-1');

      expect(result).not.toBeNull();
      expect(result!.id).toBe(universityRow.id);
      expect(result!.name).toBe(universityRow.name);
      expect(result!.shortName).toBe(universityRow.short_name);
      expect(result!.logoUrl).toBe(universityRow.logo_url);
      expect(result!.isPublished).toBe(universityRow.is_published);
      expect(result!.createdAt).toEqual(new Date(universityRow.created_at));
      expect(result!.updatedAt).toEqual(new Date(universityRow.updated_at));
    });

    it('should handle null logoUrl', async () => {
      mockSupabase.setSingleResponse(universityRow2);

      const result = await repo.findById('uni-2');

      expect(result).not.toBeNull();
      expect(result!.logoUrl).toBeNull();
    });
  });
});

/**
 * AdminRepository Tests
 *
 * Tests course assignment CRUD operations, bulk operations,
 * and access checks on the admin_course_assignments table.
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
const { AdminRepository } = await import('./AdminRepository');

// ── Fixtures ──

const adminId = 'admin-001';
const courseId = 'course-001';
const assignedBy = 'superadmin-001';

const courseRow = {
  id: 'course-001',
  university_id: 'uni-001',
  code: 'CS101',
  name: 'Intro to CS',
  created_at: '2025-06-01T10:00:00Z',
  updated_at: '2025-06-02T12:00:00Z',
};

const courseEntity = {
  id: 'course-001',
  universityId: 'uni-001',
  code: 'CS101',
  name: 'Intro to CS',
  createdAt: new Date('2025-06-01T10:00:00Z'),
  updatedAt: new Date('2025-06-02T12:00:00Z'),
};

describe('AdminRepository', () => {
  let repo: InstanceType<typeof AdminRepository>;

  beforeEach(() => {
    repo = new AdminRepository();
    mockSupabase.reset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── assignCourse ──

  describe('assignCourse', () => {
    it('should insert a course assignment', async () => {
      mockSupabase.setResponse(null);

      await repo.assignCourse(adminId, courseId, assignedBy);

      expect(mockSupabase.client.from).toHaveBeenCalledWith('admin_course_assignments');
      expect(mockSupabase.client._chain.insert).toHaveBeenCalledWith({
        admin_id: adminId,
        course_id: courseId,
        assigned_by: assignedBy,
      });
    });

    it('should throw DatabaseError on insert failure', async () => {
      mockSupabase.setErrorResponse(dbError('Insert failed'));

      await expect(repo.assignCourse(adminId, courseId, assignedBy)).rejects.toThrow(DatabaseError);
      await expect(repo.assignCourse(adminId, courseId, assignedBy)).rejects.toThrow(
        'Failed to assign course',
      );
    });
  });

  // ── removeCourse ──

  describe('removeCourse', () => {
    it('should delete a specific course assignment', async () => {
      mockSupabase.setResponse(null);

      await repo.removeCourse(adminId, courseId);

      expect(mockSupabase.client.from).toHaveBeenCalledWith('admin_course_assignments');
      expect(mockSupabase.client._chain.delete).toHaveBeenCalled();
      expect(mockSupabase.client._chain.eq).toHaveBeenCalledWith('admin_id', adminId);
      expect(mockSupabase.client._chain.eq).toHaveBeenCalledWith('course_id', courseId);
    });

    it('should throw DatabaseError on delete failure', async () => {
      mockSupabase.setErrorResponse(dbError('Delete failed'));

      await expect(repo.removeCourse(adminId, courseId)).rejects.toThrow(DatabaseError);
      await expect(repo.removeCourse(adminId, courseId)).rejects.toThrow(
        'Failed to remove course assignment',
      );
    });
  });

  // ── removeAllCourses ──

  describe('removeAllCourses', () => {
    it('should delete all course assignments for an admin', async () => {
      mockSupabase.setResponse(null);

      await repo.removeAllCourses(adminId);

      expect(mockSupabase.client.from).toHaveBeenCalledWith('admin_course_assignments');
      expect(mockSupabase.client._chain.delete).toHaveBeenCalled();
      expect(mockSupabase.client._chain.eq).toHaveBeenCalledWith('admin_id', adminId);
    });

    it('should throw DatabaseError on delete failure', async () => {
      mockSupabase.setErrorResponse(dbError('Delete failed'));

      await expect(repo.removeAllCourses(adminId)).rejects.toThrow(DatabaseError);
      await expect(repo.removeAllCourses(adminId)).rejects.toThrow(
        'Failed to remove course assignments',
      );
    });
  });

  // ── bulkAssignCourses ──

  describe('bulkAssignCourses', () => {
    it('should insert multiple course assignments', async () => {
      mockSupabase.setResponse(null);
      const courseIds = ['course-001', 'course-002'];

      await repo.bulkAssignCourses(adminId, courseIds, assignedBy);

      expect(mockSupabase.client.from).toHaveBeenCalledWith('admin_course_assignments');
      expect(mockSupabase.client._chain.insert).toHaveBeenCalledWith([
        { admin_id: adminId, course_id: 'course-001', assigned_by: assignedBy },
        { admin_id: adminId, course_id: 'course-002', assigned_by: assignedBy },
      ]);
    });

    it('should do nothing when courseIds is empty', async () => {
      await repo.bulkAssignCourses(adminId, [], assignedBy);

      expect(mockSupabase.client.from).not.toHaveBeenCalled();
    });

    it('should throw DatabaseError on insert failure', async () => {
      mockSupabase.setErrorResponse(dbError('Bulk insert failed'));

      await expect(
        repo.bulkAssignCourses(adminId, ['course-001'], assignedBy),
      ).rejects.toThrow(DatabaseError);
      await expect(
        repo.bulkAssignCourses(adminId, ['course-001'], assignedBy),
      ).rejects.toThrow('Failed to assign courses');
    });
  });

  // ── bulkRemoveCourses ──

  describe('bulkRemoveCourses', () => {
    it('should delete multiple course assignments', async () => {
      mockSupabase.setResponse(null);
      const courseIds = ['course-001', 'course-002'];

      await repo.bulkRemoveCourses(adminId, courseIds);

      expect(mockSupabase.client.from).toHaveBeenCalledWith('admin_course_assignments');
      expect(mockSupabase.client._chain.delete).toHaveBeenCalled();
      expect(mockSupabase.client._chain.eq).toHaveBeenCalledWith('admin_id', adminId);
      expect(mockSupabase.client._chain.in).toHaveBeenCalledWith('course_id', courseIds);
    });

    it('should do nothing when courseIds is empty', async () => {
      await repo.bulkRemoveCourses(adminId, []);

      expect(mockSupabase.client.from).not.toHaveBeenCalled();
    });

    it('should throw DatabaseError on delete failure', async () => {
      mockSupabase.setErrorResponse(dbError('Bulk delete failed'));

      await expect(repo.bulkRemoveCourses(adminId, ['course-001'])).rejects.toThrow(DatabaseError);
      await expect(repo.bulkRemoveCourses(adminId, ['course-001'])).rejects.toThrow(
        'Failed to remove course assignments',
      );
    });
  });

  // ── getAssignedCourses ──

  describe('getAssignedCourses', () => {
    it('should return mapped course entities', async () => {
      mockSupabase.setQueryResponse([{ course_id: courseId, courses: courseRow }]);

      const result = await repo.getAssignedCourses(adminId);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(courseEntity);
      expect(mockSupabase.client.from).toHaveBeenCalledWith('admin_course_assignments');
      expect(mockSupabase.client._chain.select).toHaveBeenCalledWith(
        'course_id, courses(id, university_id, code, name, created_at, updated_at)',
      );
      expect(mockSupabase.client._chain.eq).toHaveBeenCalledWith('admin_id', adminId);
    });

    it('should filter out rows with null courses', async () => {
      mockSupabase.setQueryResponse([
        { course_id: courseId, courses: courseRow },
        { course_id: 'course-002', courses: null },
      ]);

      const result = await repo.getAssignedCourses(adminId);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(courseId);
    });

    it('should return empty array when data is null', async () => {
      mockSupabase.setResponse(null);

      const result = await repo.getAssignedCourses(adminId);

      expect(result).toEqual([]);
    });

    it('should throw DatabaseError on fetch failure', async () => {
      mockSupabase.setErrorResponse(dbError('Fetch failed'));

      await expect(repo.getAssignedCourses(adminId)).rejects.toThrow(DatabaseError);
      await expect(repo.getAssignedCourses(adminId)).rejects.toThrow(
        'Failed to fetch assigned courses',
      );
    });
  });

  // ── hasCourseAccess ──

  describe('hasCourseAccess', () => {
    it('should return true when assignment exists', async () => {
      mockSupabase.setSingleResponse({ id: 'assignment-001' });

      const result = await repo.hasCourseAccess(adminId, courseId);

      expect(result).toBe(true);
      expect(mockSupabase.client.from).toHaveBeenCalledWith('admin_course_assignments');
      expect(mockSupabase.client._chain.select).toHaveBeenCalledWith('id');
      expect(mockSupabase.client._chain.eq).toHaveBeenCalledWith('admin_id', adminId);
      expect(mockSupabase.client._chain.eq).toHaveBeenCalledWith('course_id', courseId);
    });

    it('should return false when no assignment found (PGRST116)', async () => {
      mockSupabase.setResponse(null, PGRST116);

      const result = await repo.hasCourseAccess(adminId, courseId);

      expect(result).toBe(false);
    });

    it('should throw DatabaseError on non-PGRST116 error', async () => {
      mockSupabase.setErrorResponse(dbError('Connection failed'));

      await expect(repo.hasCourseAccess(adminId, courseId)).rejects.toThrow(DatabaseError);
      await expect(repo.hasCourseAccess(adminId, courseId)).rejects.toThrow(
        'Failed to check course access',
      );
    });
  });

  // ── setCourses ──

  describe('setCourses', () => {
    it('should call RPC with correct parameters', async () => {
      mockSupabase.setResponse(null);

      await repo.setCourses(adminId, ['course-001', 'course-002'], assignedBy);

      expect(mockSupabase.client.rpc).toHaveBeenCalledWith('set_admin_courses', {
        p_admin_id: adminId,
        p_course_ids: ['course-001', 'course-002'],
        p_assigned_by: assignedBy,
      });
    });

    it('should call RPC with empty courseIds', async () => {
      mockSupabase.setResponse(null);

      await repo.setCourses(adminId, [], assignedBy);

      expect(mockSupabase.client.rpc).toHaveBeenCalledWith('set_admin_courses', {
        p_admin_id: adminId,
        p_course_ids: [],
        p_assigned_by: assignedBy,
      });
    });

    it('should throw DatabaseError on RPC failure', async () => {
      mockSupabase.setErrorResponse(dbError('RPC failed'));

      await expect(repo.setCourses(adminId, ['course-001'], assignedBy)).rejects.toThrow(
        DatabaseError,
      );
      await expect(repo.setCourses(adminId, ['course-001'], assignedBy)).rejects.toThrow(
        'Failed to set admin courses',
      );
    });
  });

  // ── getAssignedCourseIds ──

  describe('getAssignedCourseIds', () => {
    it('should return array of course IDs', async () => {
      mockSupabase.setQueryResponse([
        { course_id: 'course-001' },
        { course_id: 'course-002' },
      ]);

      const result = await repo.getAssignedCourseIds(adminId);

      expect(result).toEqual(['course-001', 'course-002']);
      expect(mockSupabase.client.from).toHaveBeenCalledWith('admin_course_assignments');
      expect(mockSupabase.client._chain.select).toHaveBeenCalledWith('course_id');
      expect(mockSupabase.client._chain.eq).toHaveBeenCalledWith('admin_id', adminId);
    });

    it('should return empty array when data is null', async () => {
      mockSupabase.setResponse(null);

      const result = await repo.getAssignedCourseIds(adminId);

      expect(result).toEqual([]);
    });

    it('should throw DatabaseError on fetch failure', async () => {
      mockSupabase.setErrorResponse(dbError('Fetch failed'));

      await expect(repo.getAssignedCourseIds(adminId)).rejects.toThrow(DatabaseError);
      await expect(repo.getAssignedCourseIds(adminId)).rejects.toThrow(
        'Failed to fetch assigned course IDs',
      );
    });
  });
});

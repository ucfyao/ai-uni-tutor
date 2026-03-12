import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ForbiddenError, UnauthorizedError } from '@/lib/errors';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockRequireAnyAdmin = vi.fn();
const mockRequireAssignmentAccess = vi.fn();
vi.mock('@/lib/supabase/server', () => ({
  requireAnyAdmin: () => mockRequireAnyAdmin(),
  requireAssignmentAccess: (...args: unknown[]) => mockRequireAssignmentAccess(...args),
}));

const mockAssignmentService = {
  createEmpty: vi.fn(),
  rename: vi.fn(),
  deleteAssignment: vi.fn(),
  publish: vi.fn(),
  unpublish: vi.fn(),
  getItems: vi.fn(),
  addItem: vi.fn(),
  verifyItemsBelongToAssignment: vi.fn(),
  deleteItemsByIds: vi.fn(),
  updateItem: vi.fn(),
  updateItemEmbedding: vi.fn(),
  validateItemContent: vi.fn(),
  mergeItems: vi.fn(),
  splitItem: vi.fn(),
  batchUpdateAnswers: vi.fn(),
  moveItem: vi.fn(),
};
vi.mock('@/lib/services/AssignmentService', () => ({
  getAssignmentService: () => mockAssignmentService,
}));

const mockCourseService = {
  getCourseById: vi.fn(),
  getUniversityById: vi.fn(),
};
vi.mock('@/lib/services/CourseService', () => ({
  getCourseService: () => mockCourseService,
}));

// ---------------------------------------------------------------------------
// Import actions (after mocks)
// ---------------------------------------------------------------------------

const {
  createEmptyAssignment,
  renameAssignment,
  deleteAssignment,
  publishAssignment,
  fetchAssignmentItems,
} = await import('./assignments');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MOCK_USER = { id: 'aaaaaaaa-bbbb-1ccc-8ddd-eeeeeeeeeeee', email: 'admin@test.com' };
const ASSIGNMENT_ID = '11111111-2222-3333-8444-555555555555';
const COURSE_ID = '22222222-3333-4444-8555-666666666666';
const UNIVERSITY_ID = '33333333-4444-5555-8666-777777777777';

function setupAdmin() {
  mockRequireAnyAdmin.mockResolvedValue({ user: MOCK_USER, role: 'admin' as const });
  mockRequireAssignmentAccess.mockResolvedValue(undefined);
}

function setupUnauthorized() {
  mockRequireAnyAdmin.mockRejectedValue(new UnauthorizedError());
}

function setupForbidden() {
  mockRequireAnyAdmin.mockRejectedValue(new ForbiddenError('Admin access required'));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Assignment Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupAdmin();
  });

  // =========================================================================
  // createEmptyAssignment
  // =========================================================================
  describe('createEmptyAssignment', () => {
    const validInput = {
      title: 'Homework 1',
      universityId: UNIVERSITY_ID,
      courseId: COURSE_ID,
    };

    it('should create an assignment successfully', async () => {
      mockCourseService.getCourseById.mockResolvedValue({ code: 'CS101' });
      mockCourseService.getUniversityById.mockResolvedValue({ shortName: 'MIT' });
      mockAssignmentService.createEmpty.mockResolvedValue('new-id-123');

      const result = await createEmptyAssignment(validInput);

      expect(result).toEqual({ success: true, data: { id: 'new-id-123' } });
      expect(mockAssignmentService.createEmpty).toHaveBeenCalledWith(MOCK_USER.id, {
        title: 'Homework 1',
        school: 'MIT',
        course: 'CS101',
        courseId: COURSE_ID,
      });
    });

    it('should handle null university/course gracefully', async () => {
      mockCourseService.getCourseById.mockResolvedValue(null);
      mockCourseService.getUniversityById.mockResolvedValue(null);
      mockAssignmentService.createEmpty.mockResolvedValue('new-id');

      const result = await createEmptyAssignment(validInput);

      expect(result.success).toBe(true);
      expect(mockAssignmentService.createEmpty).toHaveBeenCalledWith(MOCK_USER.id, {
        title: 'Homework 1',
        school: null,
        course: null,
        courseId: COURSE_ID,
      });
    });

    it('should return error when not authenticated', async () => {
      setupUnauthorized();

      const result = await createEmptyAssignment(validInput);

      expect(result.success).toBe(false);
    });

    it('should return error for admin access denied', async () => {
      setupForbidden();

      const result = await createEmptyAssignment(validInput);

      expect(result).toEqual({ success: false, error: 'Admin access required' });
    });

    it('should return error for invalid input', async () => {
      const result = await createEmptyAssignment({
        title: '',
        universityId: 'bad',
        courseId: 'bad',
      });

      expect(result).toEqual({ success: false, error: 'Invalid input' });
      expect(mockAssignmentService.createEmpty).not.toHaveBeenCalled();
    });

    it('should handle service errors', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      mockCourseService.getCourseById.mockResolvedValue({ code: 'CS101' });
      mockCourseService.getUniversityById.mockResolvedValue({ shortName: 'MIT' });
      mockAssignmentService.createEmpty.mockRejectedValue(new Error('DB error'));

      const result = await createEmptyAssignment(validInput);

      expect(result).toEqual({ success: false, error: 'Failed to create assignment' });
    });
  });

  // =========================================================================
  // renameAssignment
  // =========================================================================
  describe('renameAssignment', () => {
    const validInput = { assignmentId: ASSIGNMENT_ID, title: 'New Title' };

    it('should rename assignment successfully', async () => {
      mockAssignmentService.rename.mockResolvedValue(undefined);

      const result = await renameAssignment(validInput);

      expect(result).toEqual({ success: true, data: null });
      expect(mockRequireAssignmentAccess).toHaveBeenCalledWith(
        ASSIGNMENT_ID,
        MOCK_USER.id,
        'admin',
      );
      expect(mockAssignmentService.rename).toHaveBeenCalledWith(ASSIGNMENT_ID, 'New Title');
    });

    it('should return error when not authenticated', async () => {
      setupUnauthorized();

      const result = await renameAssignment(validInput);

      expect(result.success).toBe(false);
    });

    it('should return error when assignment access denied', async () => {
      mockRequireAssignmentAccess.mockRejectedValue(
        new ForbiddenError('No access to this assignment'),
      );

      const result = await renameAssignment(validInput);

      expect(result).toEqual({ success: false, error: 'No access' });
    });

    it('should return error for invalid input', async () => {
      const result = await renameAssignment({ assignmentId: 'bad', title: '' });

      expect(result).toEqual({ success: false, error: 'Invalid input' });
    });

    it('should handle service errors', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      mockAssignmentService.rename.mockRejectedValue(new Error('DB error'));

      const result = await renameAssignment(validInput);

      expect(result).toEqual({ success: false, error: 'Failed to rename assignment' });
    });
  });

  // =========================================================================
  // deleteAssignment
  // =========================================================================
  describe('deleteAssignment', () => {
    it('should delete assignment successfully', async () => {
      mockAssignmentService.deleteAssignment.mockResolvedValue(undefined);

      const result = await deleteAssignment(ASSIGNMENT_ID);

      expect(result).toEqual({ success: true, data: null });
      expect(mockRequireAssignmentAccess).toHaveBeenCalledWith(
        ASSIGNMENT_ID,
        MOCK_USER.id,
        'admin',
      );
      expect(mockAssignmentService.deleteAssignment).toHaveBeenCalledWith(ASSIGNMENT_ID);
    });

    it('should return error when not authenticated', async () => {
      setupUnauthorized();

      const result = await deleteAssignment(ASSIGNMENT_ID);

      expect(result.success).toBe(false);
    });

    it('should return error when assignment access denied', async () => {
      mockRequireAssignmentAccess.mockRejectedValue(new ForbiddenError('No access'));

      const result = await deleteAssignment(ASSIGNMENT_ID);

      expect(result).toEqual({ success: false, error: 'No access' });
    });

    it('should return error for invalid assignment ID', async () => {
      const result = await deleteAssignment('not-a-uuid');

      expect(result).toEqual({ success: false, error: 'Invalid assignment ID' });
    });

    it('should handle service errors', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      mockAssignmentService.deleteAssignment.mockRejectedValue(new Error('DB error'));

      const result = await deleteAssignment(ASSIGNMENT_ID);

      expect(result).toEqual({ success: false, error: 'Failed to delete assignment' });
    });
  });

  // =========================================================================
  // publishAssignment
  // =========================================================================
  describe('publishAssignment', () => {
    it('should publish assignment successfully', async () => {
      mockAssignmentService.publish.mockResolvedValue(undefined);

      const result = await publishAssignment(ASSIGNMENT_ID);

      expect(result).toEqual({ success: true, data: null });
      expect(mockAssignmentService.publish).toHaveBeenCalledWith(ASSIGNMENT_ID);
    });

    it('should return error when not authenticated', async () => {
      setupUnauthorized();

      const result = await publishAssignment(ASSIGNMENT_ID);

      expect(result.success).toBe(false);
    });

    it('should return error when assignment access denied', async () => {
      mockRequireAssignmentAccess.mockRejectedValue(new ForbiddenError('No access'));

      const result = await publishAssignment(ASSIGNMENT_ID);

      expect(result).toEqual({ success: false, error: 'No access' });
    });

    it('should return error for invalid assignment ID', async () => {
      const result = await publishAssignment('bad-id');

      expect(result).toEqual({ success: false, error: 'Invalid assignment ID' });
    });

    it('should propagate service error messages', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      mockAssignmentService.publish.mockRejectedValue(new Error('No items to publish'));

      const result = await publishAssignment(ASSIGNMENT_ID);

      expect(result).toEqual({ success: false, error: 'No items to publish' });
    });
  });

  // =========================================================================
  // fetchAssignmentItems
  // =========================================================================
  describe('fetchAssignmentItems', () => {
    const validInput = { assignmentId: ASSIGNMENT_ID };

    it('should fetch items successfully', async () => {
      const mockItems = [
        { id: 'item-1', content: 'Q1', assignmentId: ASSIGNMENT_ID },
        { id: 'item-2', content: 'Q2', assignmentId: ASSIGNMENT_ID },
      ];
      mockAssignmentService.getItems.mockResolvedValue(mockItems);

      const result = await fetchAssignmentItems(validInput);

      expect(result).toEqual({ success: true, data: mockItems });
      expect(mockAssignmentService.getItems).toHaveBeenCalledWith(ASSIGNMENT_ID);
    });

    it('should return error when not authenticated', async () => {
      setupUnauthorized();

      const result = await fetchAssignmentItems(validInput);

      expect(result.success).toBe(false);
    });

    it('should return error when assignment access denied', async () => {
      mockRequireAssignmentAccess.mockRejectedValue(new ForbiddenError('No access'));

      const result = await fetchAssignmentItems(validInput);

      expect(result).toEqual({ success: false, error: 'No access' });
    });

    it('should handle service errors', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      mockAssignmentService.getItems.mockRejectedValue(new Error('DB error'));

      const result = await fetchAssignmentItems(validInput);

      expect(result).toEqual({ success: false, error: 'Failed to fetch items' });
    });
  });
});

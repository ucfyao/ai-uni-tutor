import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ForbiddenError, UnauthorizedError } from '@/lib/errors';

// Mock supabase/server auth helpers directly
const mockRequireUser = vi.fn();
const mockRequireSuperAdmin = vi.fn();
vi.mock('@/lib/supabase/server', () => ({
  requireUser: (...args: unknown[]) => mockRequireUser(...args),
  requireSuperAdmin: (...args: unknown[]) => mockRequireSuperAdmin(...args),
}));

// Mock revalidatePath
const mockRevalidatePath = vi.fn();
vi.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}));

// Mock CourseService
const mockCourseService = {
  getPublishedUniversities: vi.fn(),
  getPublishedCourses: vi.fn(),
  getAllPublishedCourses: vi.fn(),
  createCourse: vi.fn(),
  deleteCourse: vi.fn(),
  createUniversity: vi.fn(),
  deleteUniversity: vi.fn(),
  updateUniversity: vi.fn(),
  updateCourse: vi.fn(),
  getAllUniversities: vi.fn(),
  getAllCourses: vi.fn(),
  getCoursesByUniversity: vi.fn(),
  toggleUniversityPublished: vi.fn(),
  toggleCoursePublished: vi.fn(),
};
vi.mock('@/lib/services/CourseService', () => ({
  getCourseService: () => mockCourseService,
}));

// Mock mapError passthrough
vi.mock('@/lib/errors', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/errors')>();
  return { ...actual };
});

const {
  createCourse,
  deleteCourse,
  fetchCourses,
  fetchUniversities,
} = await import('./courses');

const MOCK_USER = { id: 'user-1', email: 'test@example.com' };

function setupAuthenticatedUser() {
  mockRequireUser.mockResolvedValue(MOCK_USER);
}

function setupSuperAdmin() {
  mockRequireUser.mockResolvedValue(MOCK_USER);
  mockRequireSuperAdmin.mockResolvedValue(MOCK_USER);
}

function setupRegularUser() {
  mockRequireUser.mockResolvedValue(MOCK_USER);
  mockRequireSuperAdmin.mockRejectedValue(
    new ForbiddenError('Super admin access required'),
  );
}

function setupUnauthenticated() {
  mockRequireUser.mockRejectedValue(new UnauthorizedError());
  mockRequireSuperAdmin.mockRejectedValue(new UnauthorizedError());
}

// --------------------------------------------------------------------------
// fetchUniversities
// --------------------------------------------------------------------------
describe('fetchUniversities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return UNAUTHORIZED when not logged in', async () => {
    setupUnauthenticated();
    const result = await fetchUniversities();
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.code).toBe('UNAUTHORIZED');
    }
  });

  it('should return universities on success', async () => {
    setupAuthenticatedUser();
    const universities = [
      { id: 'u1', name: 'MIT', shortName: 'MIT', logoUrl: null, isPublished: true },
      { id: 'u2', name: 'Stanford', shortName: 'SU', logoUrl: 'https://logo.png', isPublished: true },
    ];
    mockCourseService.getPublishedUniversities.mockResolvedValue(universities);

    const result = await fetchUniversities();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual([
        { id: 'u1', name: 'MIT', shortName: 'MIT', logoUrl: null },
        { id: 'u2', name: 'Stanford', shortName: 'SU', logoUrl: 'https://logo.png' },
      ]);
    }
  });

  it('should handle service errors', async () => {
    setupAuthenticatedUser();
    mockCourseService.getPublishedUniversities.mockRejectedValue(new Error('DB fail'));
    const result = await fetchUniversities();
    expect(result.success).toBe(false);
  });
});

// --------------------------------------------------------------------------
// fetchCourses
// --------------------------------------------------------------------------
describe('fetchCourses', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return UNAUTHORIZED when not logged in', async () => {
    setupUnauthenticated();
    const result = await fetchCourses('uni-1');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.code).toBe('UNAUTHORIZED');
    }
  });

  it('should fetch courses for a specific university', async () => {
    setupAuthenticatedUser();
    const courses = [
      { id: 'c1', universityId: 'uni-1', code: 'CS101', name: 'Intro CS', isPublished: true },
    ];
    mockCourseService.getPublishedCourses.mockResolvedValue(courses);

    const result = await fetchCourses('uni-1');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual([
        { id: 'c1', universityId: 'uni-1', code: 'CS101', name: 'Intro CS' },
      ]);
    }
    expect(mockCourseService.getPublishedCourses).toHaveBeenCalledWith('uni-1');
    expect(mockCourseService.getAllPublishedCourses).not.toHaveBeenCalled();
  });

  it('should fetch all courses when no universityId', async () => {
    setupAuthenticatedUser();
    const courses = [
      { id: 'c1', universityId: 'uni-1', code: 'CS101', name: 'Intro CS', isPublished: true },
      { id: 'c2', universityId: 'uni-2', code: 'MA201', name: 'Linear Algebra', isPublished: true },
    ];
    mockCourseService.getAllPublishedCourses.mockResolvedValue(courses);

    const result = await fetchCourses();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveLength(2);
    }
    expect(mockCourseService.getAllPublishedCourses).toHaveBeenCalled();
    expect(mockCourseService.getPublishedCourses).not.toHaveBeenCalled();
  });

  it('should handle service errors', async () => {
    setupAuthenticatedUser();
    mockCourseService.getPublishedCourses.mockRejectedValue(new Error('fail'));
    const result = await fetchCourses('uni-1');
    expect(result.success).toBe(false);
  });
});

// --------------------------------------------------------------------------
// createCourse (admin)
// --------------------------------------------------------------------------
describe('createCourse', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return UNAUTHORIZED when not logged in', async () => {
    setupUnauthenticated();
    const result = await createCourse({
      universityId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      code: 'CS101',
      name: 'Intro CS',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.code).toBe('UNAUTHORIZED');
    }
  });

  it('should return FORBIDDEN when user is not super admin', async () => {
    setupRegularUser();
    const result = await createCourse({
      universityId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      code: 'CS101',
      name: 'Intro CS',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.code).toBe('FORBIDDEN');
    }
  });

  it('should return error for invalid input (missing universityId)', async () => {
    setupSuperAdmin();
    const result = await createCourse({ code: '', name: '' });
    expect(result.success).toBe(false);
  });

  it('should return error for invalid input (non-uuid universityId)', async () => {
    setupSuperAdmin();
    const result = await createCourse({
      universityId: 'not-a-uuid',
      code: 'CS101',
      name: 'Intro CS',
    });
    expect(result.success).toBe(false);
  });

  it('should create course on success', async () => {
    setupSuperAdmin();
    const created = {
      id: 'c-new',
      universityId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      code: 'CS101',
      name: 'Intro CS',
    };
    mockCourseService.createCourse.mockResolvedValue(created);

    const result = await createCourse({
      universityId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      code: 'CS101',
      name: 'Intro CS',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        id: 'c-new',
        universityId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        code: 'CS101',
        name: 'Intro CS',
      });
    }
    expect(mockCourseService.createCourse).toHaveBeenCalledWith({
      universityId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      code: 'CS101',
      name: 'Intro CS',
    });
    expect(mockRevalidatePath).toHaveBeenCalledWith('/admin/courses');
  });

  it('should handle service errors', async () => {
    setupSuperAdmin();
    mockCourseService.createCourse.mockRejectedValue(new Error('fail'));
    const result = await createCourse({
      universityId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      code: 'CS101',
      name: 'Intro CS',
    });
    expect(result.success).toBe(false);
  });
});

// --------------------------------------------------------------------------
// deleteCourse (admin)
// --------------------------------------------------------------------------
describe('deleteCourse', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return UNAUTHORIZED when not logged in', async () => {
    setupUnauthenticated();
    const result = await deleteCourse('c-1');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.code).toBe('UNAUTHORIZED');
    }
  });

  it('should return FORBIDDEN when user is not super admin', async () => {
    setupRegularUser();
    const result = await deleteCourse('c-1');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.code).toBe('FORBIDDEN');
    }
  });

  it('should delete course on success', async () => {
    setupSuperAdmin();
    mockCourseService.deleteCourse.mockResolvedValue(undefined);

    const result = await deleteCourse('c-1');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBeUndefined();
    }
    expect(mockCourseService.deleteCourse).toHaveBeenCalledWith('c-1');
    expect(mockRevalidatePath).toHaveBeenCalledWith('/admin/courses');
  });

  it('should handle service errors', async () => {
    setupSuperAdmin();
    mockCourseService.deleteCourse.mockRejectedValue(new Error('fail'));
    const result = await deleteCourse('c-1');
    expect(result.success).toBe(false);
  });
});

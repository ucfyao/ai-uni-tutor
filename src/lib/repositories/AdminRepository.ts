/**
 * Admin Repository Implementation
 *
 * Handles admin course assignments and user role queries.
 */

import type { CourseEntity } from '@/lib/domain/models/Course';
import { DatabaseError } from '@/lib/errors';
import { createClient } from '@/lib/supabase/server';

export class AdminRepository {
  async assignCourse(adminId: string, courseId: string, assignedBy: string): Promise<void> {
    const supabase = await createClient();
    const { error } = await supabase.from('admin_course_assignments').insert({
      admin_id: adminId,
      course_id: courseId,
      assigned_by: assignedBy,
    });
    if (error) throw new DatabaseError(`Failed to assign course: ${error.message}`, error);
  }

  async removeCourse(adminId: string, courseId: string): Promise<void> {
    const supabase = await createClient();
    const { error } = await supabase
      .from('admin_course_assignments')
      .delete()
      .eq('admin_id', adminId)
      .eq('course_id', courseId);
    if (error)
      throw new DatabaseError(`Failed to remove course assignment: ${error.message}`, error);
  }

  async removeAllCourses(adminId: string): Promise<void> {
    const supabase = await createClient();
    const { error } = await supabase
      .from('admin_course_assignments')
      .delete()
      .eq('admin_id', adminId);
    if (error)
      throw new DatabaseError(`Failed to remove course assignments: ${error.message}`, error);
  }

  async getAssignedCourses(adminId: string): Promise<CourseEntity[]> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('admin_course_assignments')
      .select('course_id, courses(id, university_id, code, name, created_at, updated_at)')
      .eq('admin_id', adminId);

    if (error) throw new DatabaseError(`Failed to fetch assigned courses: ${error.message}`, error);

    return (data ?? [])
      .map((row) => {
        const c = row.courses as unknown as Record<string, string> | null;
        if (!c) return null;
        return {
          id: c.id,
          universityId: c.university_id,
          code: c.code,
          name: c.name,
          createdAt: new Date(c.created_at),
          updatedAt: new Date(c.updated_at),
        };
      })
      .filter((c): c is CourseEntity => c !== null);
  }

  async hasCourseAccess(adminId: string, courseId: string): Promise<boolean> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('admin_course_assignments')
      .select('id')
      .eq('admin_id', adminId)
      .eq('course_id', courseId)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new DatabaseError(`Failed to check course access: ${error.message}`, error);
    }
    return data !== null;
  }

  async getAssignedCourseIds(adminId: string): Promise<string[]> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('admin_course_assignments')
      .select('course_id')
      .eq('admin_id', adminId);

    if (error)
      throw new DatabaseError(`Failed to fetch assigned course IDs: ${error.message}`, error);
    return (data ?? []).map((row) => row.course_id);
  }
}

let _adminRepository: AdminRepository | null = null;

export function getAdminRepository(): AdminRepository {
  if (!_adminRepository) {
    _adminRepository = new AdminRepository();
  }
  return _adminRepository;
}

import type { ICourseRepository } from '@/lib/domain/interfaces/ICourseRepository';
import type { CourseEntity, CreateCourseDTO, UpdateCourseDTO } from '@/lib/domain/models/Course';
import { DatabaseError } from '@/lib/errors';
import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/types/database';

type CourseRow = Database['public']['Tables']['courses']['Row'];

export class CourseRepository implements ICourseRepository {
  private mapToEntity(row: CourseRow): CourseEntity {
    return {
      id: row.id,
      universityId: row.university_id,
      code: row.code,
      name: row.name,
      knowledgeOutline: row.knowledge_outline ?? null,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  async findAll(): Promise<CourseEntity[]> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('courses')
      .select('*')
      .order('code', { ascending: true });

    if (error) throw new DatabaseError(`Failed to fetch courses: ${error.message}`, error);
    return (data ?? []).map((row) => this.mapToEntity(row));
  }

  async findByUniversityId(universityId: string): Promise<CourseEntity[]> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('courses')
      .select('*')
      .eq('university_id', universityId)
      .order('code', { ascending: true });

    if (error) throw new DatabaseError(`Failed to fetch courses: ${error.message}`, error);
    return (data ?? []).map((row) => this.mapToEntity(row));
  }

  async findById(id: string): Promise<CourseEntity | null> {
    const supabase = await createClient();
    const { data, error } = await supabase.from('courses').select('*').eq('id', id).single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new DatabaseError(`Failed to fetch course: ${error.message}`, error);
    }
    if (!data) return null;
    return this.mapToEntity(data);
  }

  async create(dto: CreateCourseDTO): Promise<CourseEntity> {
    const supabase = await createClient();
    const insertData: Database['public']['Tables']['courses']['Insert'] = {
      university_id: dto.universityId,
      code: dto.code,
      name: dto.name,
    };

    const { data, error } = await supabase.from('courses').insert(insertData).select().single();

    if (error || !data)
      throw new DatabaseError(`Failed to create course: ${error?.message}`, error);
    return this.mapToEntity(data);
  }

  async update(id: string, dto: UpdateCourseDTO): Promise<CourseEntity> {
    const supabase = await createClient();
    const updates: Database['public']['Tables']['courses']['Update'] = {
      updated_at: new Date().toISOString(),
    };
    if (dto.code !== undefined) updates.code = dto.code;
    if (dto.name !== undefined) updates.name = dto.name;

    const { data, error } = await supabase
      .from('courses')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error || !data)
      throw new DatabaseError(`Failed to update course: ${error?.message}`, error);
    return this.mapToEntity(data);
  }

  async delete(id: string): Promise<void> {
    const supabase = await createClient();
    const { error } = await supabase.from('courses').delete().eq('id', id);
    if (error) throw new DatabaseError(`Failed to delete course: ${error.message}`, error);
  }
}

let _courseRepository: CourseRepository | null = null;

export function getCourseRepository(): CourseRepository {
  if (!_courseRepository) {
    _courseRepository = new CourseRepository();
  }
  return _courseRepository;
}

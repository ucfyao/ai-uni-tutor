import type { CourseEntity, CreateCourseDTO, UpdateCourseDTO } from '@/lib/domain/models/Course';

export interface ICourseRepository {
  findAll(): Promise<CourseEntity[]>;
  findByUniversityId(universityId: string): Promise<CourseEntity[]>;
  findById(id: string): Promise<CourseEntity | null>;
  create(dto: CreateCourseDTO): Promise<CourseEntity>;
  update(id: string, dto: UpdateCourseDTO): Promise<CourseEntity>;
  delete(id: string): Promise<void>;
}

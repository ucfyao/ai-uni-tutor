import type { CourseEntity, CreateCourseDTO, UpdateCourseDTO } from '@/lib/domain/models/Course';
import type {
  CreateUniversityDTO,
  UniversityEntity,
  UpdateUniversityDTO,
} from '@/lib/domain/models/University';
import { getCourseRepository, getUniversityRepository } from '@/lib/repositories';
import type { CourseRepository } from '@/lib/repositories/CourseRepository';
import type { UniversityRepository } from '@/lib/repositories/UniversityRepository';

export class CourseService {
  private readonly uniRepo: UniversityRepository;
  private readonly courseRepo: CourseRepository;

  constructor(uniRepo?: UniversityRepository, courseRepo?: CourseRepository) {
    this.uniRepo = uniRepo ?? getUniversityRepository();
    this.courseRepo = courseRepo ?? getCourseRepository();
  }

  async getAllUniversities(): Promise<UniversityEntity[]> {
    return this.uniRepo.findAll();
  }

  async getUniversityById(id: string): Promise<UniversityEntity | null> {
    return this.uniRepo.findById(id);
  }

  async createUniversity(dto: CreateUniversityDTO): Promise<UniversityEntity> {
    return this.uniRepo.create(dto);
  }

  async updateUniversity(id: string, dto: UpdateUniversityDTO): Promise<UniversityEntity> {
    return this.uniRepo.update(id, dto);
  }

  async deleteUniversity(id: string): Promise<void> {
    return this.uniRepo.delete(id);
  }

  async getAllCourses(): Promise<CourseEntity[]> {
    return this.courseRepo.findAll();
  }

  async getCoursesByUniversity(universityId: string): Promise<CourseEntity[]> {
    return this.courseRepo.findByUniversityId(universityId);
  }

  async getCourseById(id: string): Promise<CourseEntity | null> {
    return this.courseRepo.findById(id);
  }

  async createCourse(dto: CreateCourseDTO): Promise<CourseEntity> {
    return this.courseRepo.create(dto);
  }

  async updateCourse(id: string, dto: UpdateCourseDTO): Promise<CourseEntity> {
    return this.courseRepo.update(id, dto);
  }

  async deleteCourse(id: string): Promise<void> {
    return this.courseRepo.delete(id);
  }
}

let _courseService: CourseService | null = null;

export function getCourseService(): CourseService {
  if (!_courseService) {
    _courseService = new CourseService();
  }
  return _courseService;
}

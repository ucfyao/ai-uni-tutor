import { CACHE_KEYS, CACHE_TTL, cachedGet, invalidateCache } from '@/lib/cache';
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
    return cachedGet(CACHE_KEYS.universitiesList, CACHE_TTL.universities, () =>
      this.uniRepo.findAll(),
    );
  }

  async createUniversity(dto: CreateUniversityDTO): Promise<UniversityEntity> {
    const result = await this.uniRepo.create(dto);
    await invalidateCache(CACHE_KEYS.universitiesList);
    return result;
  }

  async updateUniversity(id: string, dto: UpdateUniversityDTO): Promise<UniversityEntity> {
    const result = await this.uniRepo.update(id, dto);
    await invalidateCache(CACHE_KEYS.universitiesList);
    return result;
  }

  async deleteUniversity(id: string): Promise<void> {
    await this.uniRepo.delete(id);
    await invalidateCache(CACHE_KEYS.universitiesList);
  }

  async getAllCourses(): Promise<CourseEntity[]> {
    return cachedGet(CACHE_KEYS.coursesList, CACHE_TTL.courses, () => this.courseRepo.findAll());
  }

  async getCoursesByUniversity(universityId: string): Promise<CourseEntity[]> {
    return this.courseRepo.findByUniversityId(universityId);
  }

  async getCourseById(id: string): Promise<CourseEntity | null> {
    return this.courseRepo.findById(id);
  }

  async createCourse(dto: CreateCourseDTO): Promise<CourseEntity> {
    const result = await this.courseRepo.create(dto);
    await invalidateCache(CACHE_KEYS.coursesList);
    return result;
  }

  async updateCourse(id: string, dto: UpdateCourseDTO): Promise<CourseEntity> {
    const result = await this.courseRepo.update(id, dto);
    await invalidateCache(CACHE_KEYS.coursesList);
    return result;
  }

  async deleteCourse(id: string): Promise<void> {
    await this.courseRepo.delete(id);
    await invalidateCache(CACHE_KEYS.coursesList);
  }
}

let _courseService: CourseService | null = null;

export function getCourseService(): CourseService {
  if (!_courseService) {
    _courseService = new CourseService();
  }
  return _courseService;
}

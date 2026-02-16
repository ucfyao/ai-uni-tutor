import type {
  CreateUniversityDTO,
  UniversityEntity,
  UpdateUniversityDTO,
} from '@/lib/domain/models/University';

export interface IUniversityRepository {
  findAll(): Promise<UniversityEntity[]>;
  findById(id: string): Promise<UniversityEntity | null>;
  create(dto: CreateUniversityDTO): Promise<UniversityEntity>;
  update(id: string, dto: UpdateUniversityDTO): Promise<UniversityEntity>;
  delete(id: string): Promise<void>;
}

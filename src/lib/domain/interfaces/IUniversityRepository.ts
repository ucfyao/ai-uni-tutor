import type {
  CreateUniversityDTO,
  UniversityEntity,
  UpdateUniversityDTO,
} from '@/types/university';

export interface IUniversityRepository {
  findAll(): Promise<UniversityEntity[]>;
  findAllPublished(): Promise<UniversityEntity[]>;
  findById(id: string): Promise<UniversityEntity | null>;
  create(dto: CreateUniversityDTO): Promise<UniversityEntity>;
  update(id: string, dto: UpdateUniversityDTO): Promise<UniversityEntity>;
  delete(id: string): Promise<void>;
}

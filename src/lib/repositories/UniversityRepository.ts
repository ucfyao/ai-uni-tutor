import type { IUniversityRepository } from '@/lib/domain/interfaces/IUniversityRepository';
import type {
  CreateUniversityDTO,
  UniversityEntity,
  UpdateUniversityDTO,
} from '@/lib/domain/models/University';
import { DatabaseError } from '@/lib/errors';
import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/types/database';

type UniversityRow = Database['public']['Tables']['universities']['Row'];

export class UniversityRepository implements IUniversityRepository {
  private mapToEntity(row: UniversityRow): UniversityEntity {
    return {
      id: row.id,
      name: row.name,
      shortName: row.short_name,
      logoUrl: row.logo_url,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  async findAll(): Promise<UniversityEntity[]> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('universities')
      .select('*')
      .order('name', { ascending: true });

    if (error) throw new DatabaseError(`Failed to fetch universities: ${error.message}`, error);
    return (data ?? []).map((row) => this.mapToEntity(row));
  }

  async findById(id: string): Promise<UniversityEntity | null> {
    const supabase = await createClient();
    const { data, error } = await supabase.from('universities').select('*').eq('id', id).single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new DatabaseError(`Failed to fetch university: ${error.message}`, error);
    }
    if (!data) return null;
    return this.mapToEntity(data);
  }

  async create(dto: CreateUniversityDTO): Promise<UniversityEntity> {
    const supabase = await createClient();
    const insertData: Database['public']['Tables']['universities']['Insert'] = {
      name: dto.name,
      short_name: dto.shortName,
      logo_url: dto.logoUrl ?? null,
    };

    const { data, error } = await supabase
      .from('universities')
      .insert(insertData)
      .select()
      .single();

    if (error || !data)
      throw new DatabaseError(`Failed to create university: ${error?.message}`, error);
    return this.mapToEntity(data);
  }

  async update(id: string, dto: UpdateUniversityDTO): Promise<UniversityEntity> {
    const supabase = await createClient();
    const updates: Database['public']['Tables']['universities']['Update'] = {
      updated_at: new Date().toISOString(),
    };
    if (dto.name !== undefined) updates.name = dto.name;
    if (dto.shortName !== undefined) updates.short_name = dto.shortName;
    if (dto.logoUrl !== undefined) updates.logo_url = dto.logoUrl;

    const { data, error } = await supabase
      .from('universities')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error || !data)
      throw new DatabaseError(`Failed to update university: ${error?.message}`, error);
    return this.mapToEntity(data);
  }

  async delete(id: string): Promise<void> {
    const supabase = await createClient();
    const { error } = await supabase.from('universities').delete().eq('id', id);
    if (error) throw new DatabaseError(`Failed to delete university: ${error.message}`, error);
  }
}

let _universityRepository: UniversityRepository | null = null;

export function getUniversityRepository(): UniversityRepository {
  if (!_universityRepository) {
    _universityRepository = new UniversityRepository();
  }
  return _universityRepository;
}

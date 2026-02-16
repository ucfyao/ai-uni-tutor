export interface UniversityEntity {
  id: string;
  name: string;
  shortName: string;
  logoUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateUniversityDTO {
  name: string;
  shortName: string;
  logoUrl?: string | null;
}

export interface UpdateUniversityDTO {
  name?: string;
  shortName?: string;
  logoUrl?: string | null;
}

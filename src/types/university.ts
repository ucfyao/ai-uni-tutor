export interface UniversityEntity {
  id: string;
  name: string;
  shortName: string;
  logoUrl: string | null;
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateUniversityDTO {
  name: string;
  shortName: string;
  logoUrl?: string | null;
  isPublished?: boolean;
}

export interface UpdateUniversityDTO {
  name?: string;
  shortName?: string;
  logoUrl?: string | null;
  isPublished?: boolean;
}

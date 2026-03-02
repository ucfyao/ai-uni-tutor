import type { Json } from '@/types/database';

export interface CourseEntity {
  id: string;
  universityId: string;
  code: string;
  name: string;
  knowledgeOutline: Json | null;
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateCourseDTO {
  universityId: string;
  code: string;
  name: string;
  isPublished?: boolean;
}

export interface UpdateCourseDTO {
  code?: string;
  name?: string;
  isPublished?: boolean;
  knowledgeOutline?: Json;
}

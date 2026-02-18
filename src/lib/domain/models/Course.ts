import type { Json } from '@/types/database';

export interface CourseEntity {
  id: string;
  universityId: string;
  code: string;
  name: string;
  knowledgeOutline: Json | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateCourseDTO {
  universityId: string;
  code: string;
  name: string;
}

export interface UpdateCourseDTO {
  code?: string;
  name?: string;
  knowledgeOutline?: Json;
}

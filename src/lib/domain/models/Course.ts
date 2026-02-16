export interface CourseEntity {
  id: string;
  universityId: string;
  code: string;
  name: string;
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
}

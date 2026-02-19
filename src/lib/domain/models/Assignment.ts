/**
 * Domain Models - Assignment Entity
 */

type AssignmentStatus = 'draft' | 'ready';

export interface AssignmentEntity {
  id: string;
  userId: string;
  title: string;
  school: string | null;
  course: string | null;
  courseId: string | null;
  status: AssignmentStatus;
  createdAt: string;
}

export interface AssignmentItemEntity {
  id: string;
  assignmentId: string;
  orderNum: number;
  type: string;
  content: string;
  referenceAnswer: string;
  explanation: string;
  points: number;
  difficulty: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

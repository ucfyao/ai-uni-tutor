/**
 * Domain Models - Assignment Entity
 */

export type AssignmentStatus = 'parsing' | 'ready' | 'error';

export interface AssignmentEntity {
  id: string;
  userId: string;
  title: string;
  school: string | null;
  course: string | null;
  courseId: string | null;
  status: AssignmentStatus;
  statusMessage: string | null;
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

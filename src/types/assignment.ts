/**
 * Domain Models - Assignment Entity
 */

import type { AssignmentMetadata } from '@/lib/rag/parsers/types';

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
  itemCount?: number;
  metadata?: AssignmentMetadata;
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
  warnings: string[];
  parentItemId: string | null;
  createdAt: string;
}

export interface MatchedAssignmentItem {
  id: string;
  assignmentId: string;
  orderNum: number;
  content: string;
  referenceAnswer: string;
  explanation: string;
  points: number;
  difficulty: string;
  similarity: number;
}

export interface CreateAssignmentItemDTO {
  assignmentId: string;
  orderNum: number;
  type?: string;
  content: string;
  referenceAnswer?: string;
  explanation?: string;
  points?: number;
  difficulty?: string;
  metadata?: Record<string, unknown>;
  embedding?: number[] | null;
  warnings?: string[];
  parentItemId?: string | null;
}

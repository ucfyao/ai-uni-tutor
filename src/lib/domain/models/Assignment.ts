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

export interface AssignmentItemTree extends AssignmentItemEntity {
  children: AssignmentItemTree[];
}

/** Build a tree from a flat list of items. Orphans become roots. */
export function buildItemTree(items: AssignmentItemEntity[]): AssignmentItemTree[] {
  const map = new Map<string, AssignmentItemTree>();
  const roots: AssignmentItemTree[] = [];

  for (const item of items) {
    map.set(item.id, { ...item, children: [] });
  }

  for (const node of map.values()) {
    if (node.parentItemId && map.has(node.parentItemId)) {
      map.get(node.parentItemId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  const sortChildren = (nodes: AssignmentItemTree[]) => {
    nodes.sort((a, b) => a.orderNum - b.orderNum);
    for (const n of nodes) sortChildren(n.children);
  };
  sortChildren(roots);
  return roots;
}

/** Compute display label like "1.2.3" from tree position. */
export function computeDisplayLabels(roots: AssignmentItemTree[]): Map<string, string> {
  const labels = new Map<string, string>();
  const walk = (nodes: AssignmentItemTree[], prefix: string) => {
    for (let i = 0; i < nodes.length; i++) {
      const label = prefix ? `${prefix}.${i + 1}` : `${i + 1}`;
      labels.set(nodes[i].id, label);
      walk(nodes[i].children, label);
    }
  };
  walk(roots, '');
  return labels;
}

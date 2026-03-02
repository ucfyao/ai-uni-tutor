import type { ExamQuestion } from '@/types/exam';

export interface ExamQuestionTree extends ExamQuestion {
  children: ExamQuestionTree[];
}

/** Build a tree from a flat list of questions. Orphans become roots. */
export function buildQuestionTree(questions: ExamQuestion[]): ExamQuestionTree[] {
  const map = new Map<string, ExamQuestionTree>();
  const roots: ExamQuestionTree[] = [];

  for (const q of questions) {
    map.set(q.id, { ...q, children: [] });
  }

  for (const node of map.values()) {
    if (node.parentQuestionId && map.has(node.parentQuestionId)) {
      map.get(node.parentQuestionId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  const sortChildren = (nodes: ExamQuestionTree[]) => {
    nodes.sort((a, b) => a.orderNum - b.orderNum);
    for (const n of nodes) sortChildren(n.children);
  };
  sortChildren(roots);
  return roots;
}

/** Compute display label like "1.2.3" from tree position. */
export function computeDisplayLabels(roots: ExamQuestionTree[]): Map<string, string> {
  const labels = new Map<string, string>();
  const walk = (nodes: ExamQuestionTree[], prefix: string) => {
    for (let i = 0; i < nodes.length; i++) {
      const label = prefix ? `${prefix}.${i + 1}` : `${i + 1}`;
      labels.set(nodes[i].id, label);
      walk(nodes[i].children, label);
    }
  };
  walk(roots, '');
  return labels;
}

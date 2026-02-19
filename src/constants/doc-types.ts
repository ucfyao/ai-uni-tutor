import type { LucideIcon } from 'lucide-react';
import { BookOpen, ClipboardCheck, FileText } from 'lucide-react';

export interface DocTypeConfig {
  value: string;
  label: string;
  color: string;
  icon: LucideIcon;
}

export const DOC_TYPES: DocTypeConfig[] = [
  { value: 'lecture', label: 'Lecture', color: 'indigo', icon: BookOpen },
  { value: 'assignment', label: 'Assignment', color: 'violet', icon: ClipboardCheck },
  { value: 'exam', label: 'Exam', color: 'orange', icon: FileText },
];

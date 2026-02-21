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
  { value: 'assignment', label: 'Assignment', color: 'teal', icon: ClipboardCheck },
  { value: 'exam', label: 'Exam', color: 'orange', icon: FileText },
];

/** Lookup helpers — single source of truth for doc-type theming */
const _configMap = new Map(DOC_TYPES.map((dt) => [dt.value, dt]));
const _fallback = DOC_TYPES[0];

export function getDocTypeConfig(docType: string): DocTypeConfig {
  return _configMap.get(docType) ?? _fallback;
}

export function getDocColor(docType: string): string {
  return getDocTypeConfig(docType).color;
}

export function getDocIcon(docType: string): LucideIcon {
  return getDocTypeConfig(docType).icon;
}

import type { LucideIcon } from 'lucide-react';
import { Compass, FileQuestion, Presentation } from 'lucide-react';
import { TutoringMode } from '../types/index';

export interface ModeMetadata {
  id: string;
  label: TutoringMode;
  icon: LucideIcon;
  color: string;
  desc: string;
  intro: string;
  hoverClass: string;
  suggestedPrompts?: string[];
}

export const MODES_METADATA: Record<TutoringMode, ModeMetadata> = {
  'Lecture Helper': {
    id: 'lecture',
    label: 'Lecture Helper',
    icon: Presentation,
    color: 'indigo',
    desc: 'Simplify & Explain',
    intro:
      '**Lecture Helper Mode Active**\n\nI break down complex theories into simple, digestible parts using analogies. What concept needs clarifying?',
    hoverClass: 'hover:border-indigo-300 hover:shadow-[0_8px_30px_rgba(79,70,229,0.15)]',
    suggestedPrompts: [
      'Summarize the key concepts of the last lecture',
      'Explain this concept like I am 5',
      'Connect this topic to real-world examples',
      'What are the most common misconceptions here?',
    ],
  },
  'Assignment Coach': {
    id: 'assignment',
    label: 'Assignment Coach',
    icon: Compass,
    color: 'violet',
    desc: 'Guide & Debug',
    intro:
      "**Assignment Coach Mode Active**\n\nI guide you through code, writing, and analysis without giving direct answers, so you learn the 'why'.",
    hoverClass: 'hover:border-violet-300 hover:shadow-[0_8px_30px_rgba(124,58,237,0.15)]',
    suggestedPrompts: [
      'Help me break down this assignment prompt',
      'Review my logic (without giving the answer)',
      'Give me a hint for the next step',
      'Debug this specific error message',
    ],
  },
  'Exam Prep': {
    id: 'exam',
    label: 'Exam Prep',
    icon: FileQuestion,
    color: 'purple',
    desc: 'Drill & Simulate',
    intro:
      '**Exam Prep Mode Active**\n\nI generate practice questions and simulate exam scenarios to test your knowledge gaps. Ready to drill?',
    hoverClass: 'hover:border-purple-300 hover:shadow-[0_8px_30px_rgba(147,51,234,0.15)]',
    suggestedPrompts: [
      'Generate a practice question on this topic',
      'Simulate a short quiz (3 questions)',
      'Identify my weak spots based on chat history',
      'Explain why my answer was wrong',
    ],
  },
};

export const MODES_LIST = Object.values(MODES_METADATA);

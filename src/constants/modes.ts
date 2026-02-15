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
  'Mock Exam': {
    id: 'exam/mock',
    label: 'Mock Exam',
    icon: FileQuestion,
    color: 'purple',
    desc: 'Practice with real past exams',
    intro:
      "**Mock Exam Mode Active**\n\nI generate exam variants from real past papers for your course. Let's practice!",
    hoverClass: 'hover:border-purple-300 hover:shadow-[0_8px_30px_rgba(147,51,234,0.15)]',
  },
};

export const MODES_LIST = Object.values(MODES_METADATA);

// ============================================================================
// STRATEGY CONFIG (replaces src/lib/strategies/ directory)
// ============================================================================

type ChatMode = 'Lecture Helper' | 'Assignment Coach';

export interface ModeConfig {
  temperature: number;
  ragMatchCount: number;
  knowledgeCards: boolean;
  buildSystemInstruction: (course: { code: string; name: string }) => string;
  preprocessInput?: (input: string) => string;
  postprocessResponse?: (response: string) => string;
}

export const MODE_CONFIGS: Record<ChatMode, ModeConfig> = {
  'Lecture Helper': {
    temperature: 0.7,
    ragMatchCount: 5,
    knowledgeCards: true,
    buildSystemInstruction: (course) =>
      `You are an expert Teaching Assistant for ${course.code}: ${course.name}.

Your role is to help students understand lecture content through:
- Clear, concise explanations of complex concepts
- Breaking down topics into digestible parts
- Providing relevant real-world examples
- Using analogies to connect new ideas to familiar ones
- Encouraging active learning and curiosity

## Response Guidelines

1. **Explain Thoroughly but Concisely**
   - Get to the point quickly
   - Use simple language without dumbing down
   - Build from fundamentals when needed

2. **Use Visual Formatting**
   - Use headers for multi-part answers
   - Use bullet points for lists
   - Use code blocks for formulas or code
   - Format math using LaTeX: $inline$ or $$block$$

3. **Reference Concepts Clearly**
   - Use bold for key terms: **concept name**
   - Define terms inline when first introduced

4. **Encourage Understanding**
   - Ask follow-up questions occasionally
   - Suggest related topics to explore
   - Connect concepts to practical applications

Tone: Friendly, encouraging, patient, and intellectually curious.`,
  },
  'Assignment Coach': {
    temperature: 0.5,
    ragMatchCount: 3,
    knowledgeCards: false,
    buildSystemInstruction: (course) =>
      `You are a knowledgeable Assignment Coach for ${course.code}: ${course.name}.

## Your Core Mission
Guide students to discover answers themselves. NEVER give complete solutions.

## Coaching Approach

1. **Use the Socratic Method**
   - Ask leading questions that guide thinking
   - "What do you think the first step should be?"
   - "How does this relate to [concept] we learned?"
   - "What happens if you try [approach]?"

2. **Break Problems Down**
   - Help identify what the problem is really asking
   - Suggest breaking into smaller sub-problems
   - Guide through one step at a time

3. **Provide Hints, Not Answers**
   - Point towards relevant concepts or formulas
   - Suggest similar examples to review
   - Highlight common mistakes to avoid

4. **Debug and Troubleshoot**
   When students share code or solutions:
   - Ask them to explain their approach
   - Point to the general area of issues
   - Ask "What does this line do?" to find misunderstandings

## Response Guidelines

- Keep responses focused and actionable
- Use bullet points for steps
- Format code properly with syntax highlighting
- Math: $inline$ or $$block$$

## Strict Rules

⚠️ **NEVER provide complete solutions**
⚠️ **NEVER write code that directly answers the assignment**
⚠️ **ALWAYS guide the student to discover the answer**

If pressured for answers, politely redirect:
"I'm here to help you learn, not to do your assignment. Let's work through this together - what part is confusing you?"

Tone: Supportive, patient, thought-provoking, encouraging independence.`,
    preprocessInput: (input: string) =>
      `${input}\n\n[INTERNAL: Remember to guide, not solve. Use questions to lead the student.]`,
    postprocessResponse: (response: string) => response.replace(/\[INTERNAL:.*?\]/g, '').trim(),
  },
};

export const CHAT_MODES = Object.keys(MODE_CONFIGS) as ChatMode[];

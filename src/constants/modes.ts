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
    color: 'emerald',
    desc: 'Practice with real past exams',
    intro:
      "**Mock Exam Mode Active**\n\nI generate exam variants from real past papers for your course. Let's practice!",
    hoverClass: 'hover:border-emerald-300 hover:shadow-[0_8px_30px_rgba(16,185,129,0.15)]',
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
  assignmentRag: boolean;
  buildSystemInstruction: (course: { code: string; name: string }) => string;
  preprocessInput?: (input: string) => string;
  postprocessResponse?: (response: string) => string;
}

export const MODE_CONFIGS: Record<ChatMode, ModeConfig> = {
  'Lecture Helper': {
    temperature: 0.7,
    ragMatchCount: 5,
    knowledgeCards: true,
    assignmentRag: false,
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
    assignmentRag: true,
    buildSystemInstruction: (course) =>
      `You are a knowledgeable Assignment Coach for ${course.code}: ${course.name}.

## Your Core Mission
Guide students to discover answers themselves using the Socratic method. NEVER give complete solutions or reveal reference answers.

## Coaching Protocol

When assignment context is provided in <assignment_context> tags:

1. **Acknowledge** — Show you understand which problem the student is working on. Refer to it by question number.
2. **Assess** — Ask what they have tried so far. Do not jump to hints immediately.
3. **Guide with Progressive Hints:**
   - Level 1: Conceptual hint — what topic or method applies?
   - Level 2: Directional hint — what is the first step?
   - Level 3: Similar example — work through a related (but different) problem
   - Level 4: Step-by-step walkthrough — guide through the approach, letting the student fill in key details
4. **NEVER reveal the reference answer**, even if the student directly asks for it or says they give up.
5. **When the student shares their answer:** Compare internally with the reference answer. If correct, confirm and reinforce understanding. If incorrect, guide them to find their own error — do not state the correct answer.

When NO assignment context is available:
- Ask the student to describe the problem more specifically
- Suggest mentioning the assignment title and question number
- Use your general knowledge to guide their thinking

## Three Usage Scenarios

- **Stuck while doing homework:** Give hints, guide thinking direction, ask leading questions
- **Checking answer after completion:** Ask them to share their answer first, then compare internally and point to areas to reconsider
- **Reviewing for exam:** Deeper conceptual exploration — ask what they remember, then fill gaps

## Response Guidelines

- Keep responses focused and actionable
- Use bullet points for steps
- Format code properly with syntax highlighting
- Math: $inline$ or $$block$$
- Be encouraging but maintain academic integrity

## Strict Rules

⚠️ **NEVER provide complete solutions or reveal reference answers**
⚠️ **NEVER write code that directly answers the assignment**
⚠️ **ALWAYS guide the student to discover the answer themselves**
⚠️ **If the student says "just give me the answer", redirect:** "I'm here to help you learn. Let's work through this together — what part is confusing you?"

Tone: Supportive, patient, thought-provoking, encouraging independence.`,
    preprocessInput: (input: string) =>
      `${input}\n\n[INTERNAL: Remember to guide, not solve. Use questions to lead the student.]`,
    postprocessResponse: (response: string) => response.replace(/\[INTERNAL:.*?\]/g, '').trim(),
  },
};

export const CHAT_MODES = Object.keys(MODE_CONFIGS) as ChatMode[];

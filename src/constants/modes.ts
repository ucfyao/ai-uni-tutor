import type { LucideIcon } from 'lucide-react';
import { getDocColor, getDocIcon } from '@/constants/doc-types';
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

export const SUMMARY_PROMPT = 'Summarize the key concepts of the last lecture';

export const MODES_METADATA: Record<TutoringMode, ModeMetadata> = {
  'Lecture Helper': {
    id: 'lecture',
    label: 'Lecture Helper',
    icon: getDocIcon('lecture'),
    color: getDocColor('lecture'),
    desc: 'Simplify & Explain',
    intro:
      '**Lecture Helper Mode Active**\n\nI break down complex theories into simple, digestible parts using analogies. What concept needs clarifying?',
    hoverClass: 'hover:border-indigo-300 hover:shadow-[0_8px_30px_rgba(79,70,229,0.15)]',
    suggestedPrompts: [
      SUMMARY_PROMPT,
      'Explain this concept like I am 5',
      'Connect this topic to real-world examples',
      'What are the most common misconceptions here?',
    ],
  },
  'Assignment Coach': {
    id: 'assignment',
    label: 'Assignment Coach',
    icon: getDocIcon('assignment'),
    color: getDocColor('assignment'),
    desc: 'Guide & Debug',
    intro:
      "**Assignment Coach Mode Active**\n\nI guide you through code, writing, and analysis without giving direct answers, so you learn the 'why'.",
    hoverClass: 'hover:border-teal-300 hover:shadow-[0_8px_30px_rgba(20,184,166,0.15)]',
    suggestedPrompts: [
      'Check if my answer is correct',
      "I don't understand what this question is asking",
      'How should I approach this problem?',
      '用中文给我解释一下这个概念',
    ],
  },
  'Mock Exam': {
    id: 'exam/mock',
    label: 'Mock Exam',
    icon: getDocIcon('exam'),
    color: getDocColor('exam'),
    desc: 'Practice with real past exams',
    intro:
      "**Mock Exam Mode Active**\n\nI generate exam variants from real past papers for your course. Let's practice!",
    hoverClass: 'hover:border-orange-300 hover:shadow-[0_8px_30px_rgba(249,115,22,0.15)]',
  },
};

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
      `You are an expert tutor for ${course.code}: ${course.name}, helping international students succeed.

## Core Rules

1. **Conclusion First** — Always lead with your verdict or answer. Never start with "Let's think about this..."
2. **Bilingual Terms** — Pair key academic terms in both languages: "特征值 (eigenvalue)", "递归 (recursion)". Match the student's language for the rest.
3. **Be Concise** — Quick check = 2-3 sentences. Guided help = short steps. Deep dive = still under 300 words.
4. **Never Reveal Answers** — If assignment context is provided, use it internally to verify student work. Never quote questions or show reference answers.

## Response Modes

Respond differently based on what the student needs:

### QUICK_CHECK (student submitted an answer)
Format:
✅/⚠️/❌ [One-line verdict]
[If wrong: pinpoint which step/part has the issue — do NOT show the correct answer]
[One specific hint to find the error]

### GUIDED (student is stuck)
Format:
[Name the topic/method in both languages]
[Give the first concrete step clearly]
[One guiding question to keep them moving]

### DEEP_DIVE (student wants understanding)
Format:
[Core concept in simple terms with bilingual key terms]
[One concrete example or analogy]
[Connection to what they're working on]

### ADAPTIVE (default)
Answer directly and concisely. If the question is broad, ask ONE clarifying question.

## Language Behavior
- If the student writes in Chinese → respond primarily in Chinese, English terms in parentheses
- If the student writes in English → respond primarily in English, Chinese terms in parentheses
- Mixed input → follow the dominant language

## Formatting
- Use **bold** for key terms
- Use $inline$ and $$block$$ for math (LaTeX/KaTeX)
- Use code blocks with syntax highlighting for code
- Keep bullet lists short (3-5 items max)

Tone: Direct, supportive, efficient. Like a smart upperclassman who's been through the same course.`,
    preprocessInput: (input: string) => {
      const checkPatterns =
        /检查|check|对[吗不]|is\s*.*(right|correct)|答案|review\s*my|做完|帮我看|result|对不对/i;
      const stuckPatterns =
        /怎么做|how\s*to|从哪|where.*start|approach|stuck|卡住|不会做|hint|提示|第一步|first\s*step/i;
      const explainPatterns = /为什么|why|explain|什么意思|不懂|understand|概念|concept|解释|mean/i;

      let mode = 'ADAPTIVE';
      if (checkPatterns.test(input)) mode = 'QUICK_CHECK';
      else if (stuckPatterns.test(input)) mode = 'GUIDED';
      else if (explainPatterns.test(input)) mode = 'DEEP_DIVE';

      return `${input}\n\n[INTERNAL: ${mode}]`;
    },
    postprocessResponse: (response: string) => response.replace(/\[INTERNAL:.*?\]/g, '').trim(),
  },
};

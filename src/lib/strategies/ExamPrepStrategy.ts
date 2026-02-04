/**
 * Exam Prep Strategy
 *
 * Optimized for efficient exam preparation.
 * - Provides practice questions and explanations
 * - Uses knowledge cards for key exam topics
 * - Maximum RAG context for comprehensive coverage
 */

import { Course } from '@/types';
import type { ITutoringStrategy } from './ITutoringStrategy';

export class ExamPrepStrategy implements ITutoringStrategy {
  getModeName(): string {
    return 'Exam Prep';
  }

  async buildSystemInstruction(course: Course): Promise<string> {
    return `You are an Exam Preparation Tutor for ${course.code}: ${course.name}.

## Your Mission
Help students prepare effectively for exams by identifying key topics, providing practice, and building confidence.

## Exam Prep Approach

1. **Identify Key Topics**
   - Highlight concepts likely to appear on exams
   - Explain common question patterns
   - Point out frequently tested material

2. **Provide Practice Questions**
   When appropriate, create practice problems:
   \`\`\`
   📝 **Practice Question:**
   [Question here]
   
   💡 **Hint:** [Optional hint]
   
   ✅ **Solution:** [Step-by-step solution]
   \`\`\`

3. **Summarize Key Concepts**
   Use knowledge cards for exam-critical topics:
   \`\`\`
   :::card{title="Key Concept: [Name]"}
   - Definition: ...
   - Formula: ...
   - Common mistakes: ...
   - Exam tip: ...
   :::
   \`\`\`

4. **Offer Study Strategies**
   - Time management tips
   - Memory techniques
   - How to approach different question types

## Response Guidelines

- Be efficient and exam-focused
- Use clear formatting for easy review
- Include "Exam Tips" when relevant
- Format math: $inline$ or $$block$$

## Always Remember

- Students are often stressed before exams
- Be encouraging and build confidence
- Focus on high-yield topics
- Explain common mistakes to avoid

Tone: Efficient, focused, encouraging, confidence-building.`;
  }

  getTemperature(): number {
    return 0.6; // Balanced - focused but can provide varied examples
  }

  supportsKnowledgeCards(): boolean {
    return true; // Useful for exam topics
  }

  getRAGMatchCount(): number {
    return 7; // Maximum context for comprehensive exam prep
  }

  postprocessResponse(response: string): string {
    // Add exam tip if not already present for longer responses
    if (response.length > 500 && !response.toLowerCase().includes('exam tip')) {
      return response + '\n\n💡 **Exam Tip**: Review this concept regularly before your exam.';
    }
    return response;
  }
}

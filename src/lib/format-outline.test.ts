import { describe, expect, it } from 'vitest';
import { formatOutlineToMarkdown } from './format-outline';

describe('formatOutlineToMarkdown', () => {
  it('should format a single outline with sections and knowledge points', () => {
    const outline = {
      title: 'Introduction to Algorithms',
      summary: '2 sections, 4 knowledge points.',
      sections: [
        {
          title: 'Sorting Algorithms',
          briefDescription: 'Overview of common sorting techniques',
          knowledgePoints: ['Bubble Sort', 'Merge Sort'],
          knowledgePointDetails: [
            {
              title: 'Bubble Sort',
              content: 'Simple comparison-based sorting algorithm with O(n²) complexity.',
            },
            {
              title: 'Merge Sort',
              content: 'Divide-and-conquer algorithm with O(n log n) complexity.',
            },
          ],
        },
        {
          title: 'Graph Algorithms',
          briefDescription: 'Traversal and shortest path',
          knowledgePoints: ['BFS', 'DFS'],
          knowledgePointDetails: [
            { title: 'BFS', content: 'Breadth-first search explores level by level.' },
            { title: 'DFS', content: 'Depth-first search explores as deep as possible first.' },
          ],
        },
      ],
    };

    const md = formatOutlineToMarkdown(outline);

    expect(md).toContain('## Introduction to Algorithms');
    expect(md).toContain('### Outline');
    expect(md).toContain('**Sorting Algorithms**');
    expect(md).toContain('Overview of common sorting techniques');
    expect(md).toContain('Bubble Sort');
    expect(md).toContain('### Key Concepts');
    expect(md).toContain('Simple comparison-based sorting algorithm');
    expect(md).toContain('**Graph Algorithms**');
  });

  it('should handle outline with no knowledgePointDetails', () => {
    const outline = {
      title: 'Basic Math',
      summary: '1 section, 2 knowledge points.',
      sections: [
        {
          title: 'Arithmetic',
          briefDescription: 'Basic operations',
          knowledgePoints: ['Addition', 'Subtraction'],
        },
      ],
    };

    const md = formatOutlineToMarkdown(outline);

    expect(md).toContain('## Basic Math');
    expect(md).toContain('**Arithmetic**');
    expect(md).toContain('Addition');
    expect(md).not.toContain('### Key Concepts');
  });

  it('should handle empty sections', () => {
    const outline = {
      title: 'Empty Lecture',
      summary: '0 sections.',
      sections: [],
    };

    const md = formatOutlineToMarkdown(outline);

    expect(md).toContain('## Empty Lecture');
  });
});

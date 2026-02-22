import { describe, expect, it } from 'vitest';
import { formatOutlineToMarkdown } from './format-outline';

describe('formatOutlineToMarkdown', () => {
  it('should format outline with sections and knowledge points', () => {
    const outline = {
      sections: [
        {
          title: 'Sorting Algorithms',
          briefDescription: 'Overview of common sorting techniques',
          knowledgePoints: ['Bubble Sort', 'Merge Sort'],
        },
        {
          title: 'Graph Algorithms',
          briefDescription: 'Traversal and shortest path',
          knowledgePoints: ['BFS', 'DFS'],
        },
      ],
    };

    const md = formatOutlineToMarkdown(outline, 'Introduction to Algorithms');

    expect(md).toContain('## Introduction to Algorithms');
    expect(md).toContain('### Outline');
    expect(md).toContain('**Sorting Algorithms**');
    expect(md).toContain('Overview of common sorting techniques');
    expect(md).toContain('Bubble Sort');
    expect(md).toContain('**Graph Algorithms**');
  });

  it('should handle empty sections', () => {
    const outline = { sections: [] };

    const md = formatOutlineToMarkdown(outline, 'Empty Lecture');

    expect(md).toContain('## Empty Lecture');
  });

  it('should work without docName', () => {
    const outline = {
      sections: [
        {
          title: 'Test Section',
          briefDescription: 'A test',
          knowledgePoints: ['Point A'],
        },
      ],
    };

    const md = formatOutlineToMarkdown(outline);

    expect(md).not.toMatch(/^## /m);
    expect(md).toContain('### Outline');
    expect(md).toContain('**Test Section**');
  });
});

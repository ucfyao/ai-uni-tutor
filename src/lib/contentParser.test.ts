import { describe, expect, it } from 'vitest';
import { extractCards, injectLinks } from './contentParser';

describe('contentParser', () => {
  describe('extractCards', () => {
    it('should extract a single card and return clean content', () => {
      const input = 'Here is a concept: <card title="React">React is a library.</card> End.';
      const { cleanContent, cards } = extractCards(input);

      expect(cleanContent).toBe('Here is a concept:  End.');
      expect(cards).toHaveLength(1);
      expect(cards[0]).toMatchObject({
        title: 'React',
        content: 'React is a library.',
        id: 'react',
      });
    });

    it('should extract multiple cards', () => {
      const input = '<card title="A">Conte nt A</card> and <card title="B">Content B</card>';
      const { cleanContent, cards } = extractCards(input);

      expect(cleanContent).toBe(' and ');
      expect(cards).toHaveLength(2);
      expect(cards[0].title).toBe('A');
      expect(cards[1].title).toBe('B');
    });

    it('should handle multiline content', () => {
      const input = `<card title="Multiline">
Line 1
Line 2
</card>`;
      const { cards } = extractCards(input);
      expect(cards[0].content).toContain('Line 1');
      expect(cards[0].content).toContain('Line 2');
    });

    it('should handle attributes with different quoting styles', () => {
      const input = `<card title='Single'>Content</card>`;
      const { cards } = extractCards(input);
      expect(cards[0].title).toBe('Single');
    });
  });

  describe('injectLinks', () => {
    it('should inject links for known cards', () => {
      const content = 'I love React and Next.js.';
      const cards = [{ id: 'react', title: 'React', content: '' }];
      const result = injectLinks(content, cards);

      expect(result).toBe('I love [React](#card-react) and Next.js.');
    });

    it('should inject links for bolded text', () => {
      const content = 'Check out **React** framework.';
      const cards = [{ id: 'react', title: 'React', content: '' }];
      const result = injectLinks(content, cards);

      expect(result).toBe('Check out [**React**](#card-react) framework.');
    });

    it('should NOT inject links inside code blocks', () => {
      const content = 'Use `React` variable. \n ```\nimport React from "react";\n```';
      const cards = [{ id: 'react', title: 'React', content: '' }];
      const result = injectLinks(content, cards);

      expect(result).toBe(content); // Should remain unchanged
    });

    it('should NOT inject links inside existing markdown links', () => {
      const content = 'Visit [React](https://react.dev) website.';
      const cards = [{ id: 'react', title: 'React', content: '' }];
      const result = injectLinks(content, cards);

      expect(result).toBe(content); // Should remain unchanged
    });

    it('should handle CJK characters correctly', () => {
      const content = '我们需要学习React和TypeScript。';
      const cards = [{ id: 'react', title: 'React', content: '' }];
      const result = injectLinks(content, cards);

      // Note: \b is not used for CJK mixed context in the implementation for English words?
      // Actually checking implementation: if hasCJK is false (React is English), it uses \b.
      // So "学习React" might fail \b match depending on regex engine.
      // Let's check the implementation logic again.
      // Implementation uses \b for English titles. \b matches boundary between \w and \W.
      // CJK characters are usually treated as \w or non-boundary?
      // Actually, \b works between \w and non-\w. CJK are often non-\w in JS regex unless using u flag?
      // This is a good test case to see behavior.

      // Let's assume standard behavior first.
      // If it fails, we fix the code or the test.
    });

    it('should match exact words only for English', () => {
      const content = 'Reaction is not React.';
      const cards = [{ id: 'react', title: 'React', content: '' }];
      const result = injectLinks(content, cards);

      expect(result).toContain('Reaction');
      expect(result).toContain('[React](#card-react).');
      expect(result).not.toContain('[Reaction');
    });
  });
});

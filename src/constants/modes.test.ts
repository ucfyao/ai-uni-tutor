import { describe, expect, it } from 'vitest';
import { MODE_CONFIGS } from './modes';

const preprocess = MODE_CONFIGS['Assignment Coach'].preprocessInput!;

describe('Assignment Coach preprocessInput', () => {
  describe('QUICK_CHECK mode', () => {
    it.each([
      '检查我的答案',
      'Check if my answer is correct',
      '这个对吗',
      '我的答案是 λ=3',
      'Is this right?',
      '做完了，帮我看看',
      'Review my solution',
    ])('detects QUICK_CHECK for: %s', (input) => {
      expect(preprocess(input)).toContain('[INTERNAL: QUICK_CHECK]');
    });
  });

  describe('GUIDED mode', () => {
    it.each([
      '怎么做这道题',
      'How to approach this?',
      '从哪开始',
      'Where should I start?',
      "I'm stuck",
      '卡住了',
      'Give me a hint',
    ])('detects GUIDED for: %s', (input) => {
      expect(preprocess(input)).toContain('[INTERNAL: GUIDED]');
    });
  });

  describe('DEEP_DIVE mode', () => {
    it.each([
      '为什么要用这个方法',
      'Why does this work?',
      'Explain this concept',
      '什么意思',
      '不懂这个概念',
      '解释一下',
    ])('detects DEEP_DIVE for: %s', (input) => {
      expect(preprocess(input)).toContain('[INTERNAL: DEEP_DIVE]');
    });
  });

  describe('ADAPTIVE mode (default)', () => {
    it.each([
      'Hello',
      '你好',
      'What is the deadline?',
      'Thanks!',
    ])('falls back to ADAPTIVE for: %s', (input) => {
      expect(preprocess(input)).toContain('[INTERNAL: ADAPTIVE]');
    });
  });

  it('preserves original input', () => {
    const input = 'Check my answer: λ=3,5';
    const result = preprocess(input);
    expect(result).toContain(input);
  });
});

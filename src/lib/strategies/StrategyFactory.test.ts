import { describe, expect, it } from 'vitest';
import { AssignmentCoachStrategy } from './AssignmentCoachStrategy';
import { LectureHelperStrategy } from './LectureHelperStrategy';
import { StrategyFactory } from './StrategyFactory';

describe('StrategyFactory', () => {
  it('should create LectureHelperStrategy for "Lecture Helper" mode', () => {
    const strategy = StrategyFactory.create('Lecture Helper');
    expect(strategy).toBeInstanceOf(LectureHelperStrategy);
    expect(strategy.getModeName()).toBe('Lecture Helper');
    expect(strategy.supportsKnowledgeCards()).toBe(true);
    expect(strategy.getTemperature()).toBe(0.7);
  });

  it('should create AssignmentCoachStrategy for "Assignment Coach" mode', () => {
    const strategy = StrategyFactory.create('Assignment Coach');
    expect(strategy).toBeInstanceOf(AssignmentCoachStrategy);
    expect(strategy.getModeName()).toBe('Assignment Coach');
    expect(strategy.supportsKnowledgeCards()).toBe(false); // Important distinction
    expect(strategy.getTemperature()).toBe(0.5);
  });

  it('should cache strategy instances', () => {
    const strategy1 = StrategyFactory.create('Lecture Helper');
    const strategy2 = StrategyFactory.create('Lecture Helper');
    expect(strategy1).toBe(strategy2); // Same instance reference
  });

  it('should throw error for unknown mode', () => {
    // @ts-expect-error - testing runtime error
    expect(() => StrategyFactory.create('Unknown Mode')).toThrow();
  });

  it('should return all modes including Mock Exam', () => {
    const modes = StrategyFactory.getAllModes();
    expect(modes).toContain('Lecture Helper');
    expect(modes).toContain('Assignment Coach');
    expect(modes).toContain('Mock Exam');
  });

  it('should return only chat modes (excluding Mock Exam)', () => {
    const chatModes = StrategyFactory.getChatModes();
    expect(chatModes).toContain('Lecture Helper');
    expect(chatModes).toContain('Assignment Coach');
    expect(chatModes).not.toContain('Mock Exam');
  });
});

import { describe, expect, it } from 'vitest';
import { AssignmentCoachStrategy } from './AssignmentCoachStrategy';
import { ExamPrepStrategy } from './ExamPrepStrategy';
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

  it('should create ExamPrepStrategy for "Exam Prep" mode', () => {
    const strategy = StrategyFactory.create('Exam Prep');
    expect(strategy).toBeInstanceOf(ExamPrepStrategy);
    expect(strategy.getModeName()).toBe('Exam Prep');
    expect(strategy.supportsKnowledgeCards()).toBe(true);
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
});

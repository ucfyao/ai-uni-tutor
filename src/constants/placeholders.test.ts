import { describe, expect, it } from 'vitest';
import { PLACEHOLDERS } from './placeholders';

describe('PLACEHOLDERS', () => {
  it('should have all required keys', () => {
    expect(PLACEHOLDERS).toHaveProperty('MESSAGE');
    expect(PLACEHOLDERS).toHaveProperty('ASK_CONCEPT');
    expect(PLACEHOLDERS).toHaveProperty('ASK_FOLLOWUP');
    expect(PLACEHOLDERS).toHaveProperty('SELECT_UNIVERSITY');
    expect(PLACEHOLDERS).toHaveProperty('SELECT_COURSE');
  });

  it('should not have empty values', () => {
    Object.values(PLACEHOLDERS).forEach((value) => {
      expect(value).toBeTruthy();
      expect(typeof value).toBe('string');
      expect(value.length).toBeGreaterThan(0);
    });
  });

  it('should use imperative style for actions', () => {
    expect(PLACEHOLDERS.MESSAGE).toMatch(/^Type/);
    expect(PLACEHOLDERS.ENTER_NAME).toMatch(/^Enter/);
    expect(PLACEHOLDERS.SELECT_UNIVERSITY).toMatch(/^Select/);
  });
});

import { describe, expect, it } from 'vitest';
import { COMMANDS } from './commands';

describe('commands', () => {
  it('send-action commands should have requiresContext=true', () => {
    const sendCommands = COMMANDS.filter((c) => c.action === 'send');
    for (const cmd of sendCommands) {
      expect(cmd.requiresContext, `${cmd.id} should require context`).toBe(true);
    }
  });

  it('prefill-action commands should have requiresContext=false', () => {
    const prefillCommands = COMMANDS.filter((c) => c.action === 'prefill');
    for (const cmd of prefillCommands) {
      expect(cmd.requiresContext, `${cmd.id} should not require context`).toBe(false);
    }
  });
});

import type { LucideIcon } from 'lucide-react';
import {
  BookOpen,
  CheckCircle,
  HelpCircle,
  Lightbulb,
  ListChecks,
  MessageCircleQuestion,
  Route,
  Sparkles,
} from 'lucide-react';
import type { TutoringMode } from '@/types';

// ============================================================================
// Command Types
// ============================================================================

export type CommandAction = 'send' | 'prefill';

export interface ChatCommand {
  /** Unique ID, e.g. 'summary' */
  id: string;
  /** Slash command string, e.g. '/summary' */
  command: string;
  /** Lucide icon component */
  icon: LucideIcon;
  /** Mantine color for theming */
  color: string;
  /** i18n key for the label (under `commands.[id].label`) */
  labelKey: string;
  /** i18n key for the description (under `commands.[id].desc`) */
  descKey: string;
  /** Which tutoring modes support this command */
  modes: TutoringMode[];
  /**
   * 'send' = auto-send a predefined prompt immediately.
   * 'prefill' = populate the input and let user add context before sending.
   */
  action: CommandAction;
  /** The prompt text (for 'send') or prefill text (for 'prefill') */
  promptTemplate: string;
  /** Whether this command needs prior context (messages, documents, images) to be useful */
  requiresContext: boolean;
}

// ============================================================================
// Command Definitions
// ============================================================================

export const COMMANDS: ChatCommand[] = [
  // ---- Lecture Helper ----
  {
    id: 'summary',
    command: '/summary',
    icon: ListChecks,
    color: 'indigo',
    labelKey: 'summary',
    descKey: 'summary',
    modes: ['Lecture Helper'],
    action: 'send',
    promptTemplate: 'Summarize the key concepts of the last lecture',
    requiresContext: true,
  },
  {
    id: 'quiz',
    command: '/quiz',
    icon: Sparkles,
    color: 'violet',
    labelKey: 'quiz',
    descKey: 'quiz',
    modes: ['Lecture Helper'],
    action: 'send',
    promptTemplate:
      'Generate 5 quiz questions based on the lecture content to test my understanding',
    requiresContext: true,
  },
  {
    id: 'explain',
    command: '/explain',
    icon: BookOpen,
    color: 'blue',
    labelKey: 'explain',
    descKey: 'explain',
    modes: ['Lecture Helper', 'Assignment Coach'],
    action: 'prefill',
    promptTemplate: 'Explain the concept of: ',
    requiresContext: false,
  },
  {
    id: 'examples',
    command: '/examples',
    icon: Lightbulb,
    color: 'orange',
    labelKey: 'examples',
    descKey: 'examples',
    modes: ['Lecture Helper'],
    action: 'send',
    promptTemplate: 'Connect this topic to real-world examples',
    requiresContext: true,
  },

  // ---- Assignment Coach ----
  {
    id: 'check',
    command: '/check',
    icon: CheckCircle,
    color: 'green',
    labelKey: 'check',
    descKey: 'check',
    modes: ['Assignment Coach'],
    action: 'prefill',
    promptTemplate: 'Check if my answer is correct: ',
    requiresContext: false,
  },
  {
    id: 'approach',
    command: '/approach',
    icon: Route,
    color: 'cyan',
    labelKey: 'approach',
    descKey: 'approach',
    modes: ['Assignment Coach'],
    action: 'send',
    promptTemplate: 'How should I approach this problem?',
    requiresContext: true,
  },
  {
    id: 'hint',
    command: '/hint',
    icon: MessageCircleQuestion,
    color: 'yellow',
    labelKey: 'hint',
    descKey: 'hint',
    modes: ['Assignment Coach'],
    action: 'send',
    promptTemplate: 'Give me a hint for this question',
    requiresContext: true,
  },
];

// ============================================================================
// Helpers
// ============================================================================

/** Get commands available for a specific mode */
export function getCommandsForMode(mode: TutoringMode): ChatCommand[] {
  return COMMANDS.filter((cmd) => cmd.modes.includes(mode));
}

/** Parse a "/command" from user input. Returns the command + remaining text, or null. */
export function parseCommand(
  input: string,
  mode: TutoringMode,
): { command: ChatCommand; args: string } | null {
  const trimmed = input.trim();
  if (!trimmed.startsWith('/')) return null;

  const available = getCommandsForMode(mode);
  // Sort by command length descending to match longest first
  const sorted = [...available].sort((a, b) => b.command.length - a.command.length);

  for (const cmd of sorted) {
    if (trimmed === cmd.command || trimmed.startsWith(cmd.command + ' ')) {
      const args = trimmed.slice(cmd.command.length).trim();
      return { command: cmd, args };
    }
  }
  return null;
}

/** Filter commands by a partial slash input (e.g. "/su" matches "/summary") */
export function filterCommands(partialInput: string, mode: TutoringMode): ChatCommand[] {
  const available = getCommandsForMode(mode);
  if (!partialInput.startsWith('/')) return [];
  const query = partialInput.toLowerCase();
  return available.filter((cmd) => cmd.command.startsWith(query));
}

'use server';

import { GoogleGenAI } from '@google/genai';
import { z } from 'zod';
import { enforceQuota } from '@/app/actions/limits';
import { QuotaExceededError } from '@/lib/errors';
import { appendRagContext, buildSystemInstruction } from '@/lib/prompts';
import { createClient } from '@/lib/supabase/server';
import { ChatMessage, ChatSession, Course, TutoringMode } from '@/types/index';

// Initialize outside to allow env var loading check at runtime if needed, but here it's fine.
// const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const MAX_RETRIES = 3;
const BASE_DELAY = 2000;

type ChatMessageRow = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
  card_id: string | null;
};

const tutoringModeSchema = z.enum(['Lecture Helper', 'Assignment Coach', 'Exam Prep', 'Feedback']);

const courseSchema = z.object({
  id: z.string().min(1),
  universityId: z.string().min(1),
  code: z.string().min(1),
  name: z.string().min(1),
});

const chatMessageSchema = z.object({
  id: z.string().min(1),
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1),
  timestamp: z.number().finite(),
  cardId: z.string().min(1).optional(),
});

const generateChatSchema = z.object({
  course: courseSchema,
  mode: tutoringModeSchema.nullable(),
  history: z.array(chatMessageSchema),
  userInput: z.string().min(1),
});

const sessionIdSchema = z.string().min(1);
const createSessionSchema = z
  .object({
    course: courseSchema,
    mode: tutoringModeSchema.nullable(),
    title: z.string().min(1),
  })
  .passthrough();

const saveMessageSchema = z.object({
  sessionId: sessionIdSchema,
  message: chatMessageSchema,
});

const togglePinSchema = z.object({
  sessionId: sessionIdSchema,
  isPinned: z.boolean(),
});

const updateTitleSchema = z.object({
  sessionId: sessionIdSchema,
  title: z.string().min(1).max(200),
});

const updateModeSchema = z.object({
  sessionId: sessionIdSchema,
  mode: tutoringModeSchema,
});

const toggleShareSchema = z.object({
  sessionId: sessionIdSchema,
  isShared: z.boolean(),
});

const explainConceptSchema = z.object({
  concept: z.string().min(1),
  context: z.string().min(1),
  courseCode: z.string().min(1).optional(),
});

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function assertSessionOwnership(supabase: SupabaseClient, userId: string, sessionId: string) {
  const { data, error } = await supabase
    .from('chat_sessions')
    .select('id')
    .eq('id', sessionId)
    .eq('user_id', userId)
    .single();

  if (error || !data) {
    throw new Error('Unauthorized');
  }
}

// --- Internal Implementation ---
async function _generateChatResponse(
  course: Course,
  mode: TutoringMode | null,
  history: ChatMessage[],
  userInput: string,
) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('Missing GEMINI_API_KEY in environment variables');
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Unauthorized');
  }

  // Unified Quota Check
  await enforceQuota();

  // --- Validation Section ---
  if (!mode) {
    throw new Error('Validation Failed: Tutoring Mode must be selected before starting a chat.');
  }
  if (!course || !course.code) {
    throw new Error('Validation Failed: Invalid Course Context. Please restart the session.');
  }

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  // 1. Prepare contents for Gemini
  const contents = history.map((msg) => ({
    role: msg.role === 'user' ? 'user' : 'model',
    parts: [{ text: msg.content }],
  }));

  contents.push({
    role: 'user',
    parts: [{ text: userInput }],
  });

  // 2. Prepare System Instruction using shared function
  let systemInstruction = buildSystemInstruction(course, mode);

  // 3. RAG Integration
  try {
    const { retrieveContext } = await import('@/lib/rag/retrieval');
    // Filter by course code to implement commercial loop / contextual RAG
    const context = await retrieveContext(userInput, { course: course.code });

    if (context) {
      systemInstruction = appendRagContext(systemInstruction, context);
    }
  } catch (e) {
    console.error('RAG Retrieval Failed', e);
    // Continue without RAG
  }

  let lastError: unknown;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: contents,
        config: {
          systemInstruction,
          temperature: 0.7,
        },
      });

      const text = response.text;
      if (!text) {
        throw new Error('Empty response from AI model.');
      }
      return text;
    } catch (error: unknown) {
      lastError = error;
      // Check for 429 Too Many Requests
      if (
        error instanceof Error &&
        (error.message?.includes('429') || (error as { status?: number }).status === 429)
      ) {
        console.warn(
          `Gemini 429 Rate Limit hit. Retrying attempt ${attempt + 1}/${MAX_RETRIES}...`,
        );
        await delay(BASE_DELAY * Math.pow(2, attempt)); // Exponential backoff: 2s, 4s, 8s
        continue;
      }
      // Other errors, break immediately
      break;
    }
  }

  console.error('Gemini service failed after retries:', lastError);
  if (lastError instanceof Error) {
    throw lastError;
  }
  throw new Error(String(lastError));
}

// --- Exported Wrapper with Error Masking ---
export type ChatActionResponse =
  | { success: true; data: string }
  | { success: false; error: string; isLimitError?: boolean };

export async function generateChatResponse(
  course: Course,
  mode: TutoringMode | null,
  history: ChatMessage[],
  userInput: string,
): Promise<ChatActionResponse> {
  try {
    const parsed = generateChatSchema.safeParse({ course, mode, history, userInput });
    if (!parsed.success) {
      throw new Error('Validation Failed: Invalid chat request payload.');
    }

    return { success: true, data: await _generateChatResponse(course, mode, history, userInput) };
  } catch (error: unknown) {
    // Quota Exceeded: trigger UI Modal
    if (error instanceof QuotaExceededError) {
      return { success: false, error: error.message, isLimitError: true };
    }

    // Business Logic Errors: Propagate message
    const message = error instanceof Error ? error.message : String(error);

    if (
      message.includes('Validation Failed') ||
      message.includes('Unauthorized') ||
      message.includes('Missing GEMINI_API_KEY')
    ) {
      return { success: false, error: message };
    }

    // Technical/Third-Party Errors: Log and Mask
    console.error('Internal/Third-Party Error in generateChatResponse:', error);
    return {
      success: false,
      error: 'An unexpected error occurred with the AI service. Please contact the administrator.',
    };
  }
}

// --- Persistence Actions ---

export async function getChatSession(sessionId: string): Promise<ChatSession | null> {
  const parsed = sessionIdSchema.safeParse(sessionId);
  if (!parsed.success) {
    return null;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: sessionData, error } = await supabase
    .from('chat_sessions')
    .select('*')
    .eq('id', sessionId)
    .eq('user_id', user.id)
    .single();

  if (error || !sessionData) return null;

  const { data: msgData } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true });

  const messages: ChatMessageRow[] = Array.isArray(msgData) ? msgData : [];

  return {
    id: sessionData.id,
    course: sessionData.course,
    mode: sessionData.mode,
    title: sessionData.title,
    messages:
      messages.map((msg) => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        timestamp: new Date(msg.created_at).getTime(),
        cardId: msg.card_id ?? undefined,
      })) || [],
    lastUpdated: new Date(sessionData.updated_at).getTime(),
    isPinned: sessionData.is_pinned,
    isShared: sessionData.is_shared,
  };
}

export async function getChatSessions(): Promise<ChatSession[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('chat_sessions')
    .select('*')
    .eq('user_id', user.id)
    .order('is_pinned', { ascending: false })
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('Error fetching sessions:', error);
    return [];
  }

  // ... (previous code)

  const sessions: ChatSession[] = [];
  for (const row of data) {
    // Optimization: For the sidebar list, we might not need all messages immediately,
    // but the type requires it. Fetching them ensures validity.
    const { data: msgData } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('session_id', row.id)
      .order('created_at', { ascending: true });

    const messages: ChatMessageRow[] = Array.isArray(msgData) ? msgData : [];

    sessions.push({
      id: row.id,
      course: row.course,
      mode: row.mode,
      title: row.title,
      messages:
        messages.map((msg) => ({
          id: msg.id,
          role: msg.role,
          content: msg.content,
          timestamp: new Date(msg.created_at).getTime(),
          cardId: msg.card_id ?? undefined, // Map DB column to type
        })) || [],
      lastUpdated: new Date(row.updated_at).getTime(),
      isPinned: row.is_pinned,
    });
  }

  return sessions;
}

export async function createChatSession(session: Omit<ChatSession, 'id' | 'lastUpdated'>) {
  const parsed = createSessionSchema.safeParse(session);
  if (!parsed.success) {
    throw new Error('Validation Failed: Invalid chat session payload.');
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('chat_sessions')
    .insert({
      user_id: user.id,
      course: session.course,
      mode: session.mode,
      title: session.title,
      is_pinned: false,
    })
    .select()
    .single();

  if (error) throw error;

  return {
    ...session,
    id: data.id,
    messages: [],
    lastUpdated: new Date(data.updated_at).getTime(),
    isPinned: false,
  } as ChatSession;
}

export async function saveChatMessage(sessionId: string, message: ChatMessage) {
  const parsed = saveMessageSchema.safeParse({ sessionId, message });
  if (!parsed.success) {
    throw new Error('Validation Failed: Invalid chat message payload.');
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  await assertSessionOwnership(supabase, user.id, sessionId);

  const { error } = await supabase.from('chat_messages').insert({
    session_id: sessionId,
    role: message.role,
    content: message.content,
    created_at: new Date(message.timestamp).toISOString(),
    card_id: message.cardId || null, // Save cardId
  });

  if (error) throw error;

  await supabase
    .from('chat_sessions')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', sessionId);
}

export async function toggleSessionPin(sessionId: string, isPinned: boolean) {
  const parsed = togglePinSchema.safeParse({ sessionId, isPinned });
  if (!parsed.success) {
    throw new Error('Validation Failed: Invalid pin toggle payload.');
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  await assertSessionOwnership(supabase, user.id, sessionId);

  const { error } = await supabase
    .from('chat_sessions')
    .update({ is_pinned: isPinned })
    .eq('id', sessionId);

  if (error) throw error;
}

export async function deleteChatSession(sessionId: string) {
  const parsed = sessionIdSchema.safeParse(sessionId);
  if (!parsed.success) {
    throw new Error('Validation Failed: Invalid session id.');
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  await assertSessionOwnership(supabase, user.id, sessionId);

  const { error } = await supabase.from('chat_sessions').delete().eq('id', sessionId);

  if (error) throw error;
}

export async function updateChatSessionTitle(sessionId: string, title: string) {
  const parsed = updateTitleSchema.safeParse({ sessionId, title });
  if (!parsed.success) {
    throw new Error('Validation Failed: Invalid title payload.');
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  await assertSessionOwnership(supabase, user.id, sessionId);

  const { error } = await supabase
    .from('chat_sessions')
    .update({ title, updated_at: new Date().toISOString() })
    .eq('id', sessionId);

  if (error) throw error;
}

export async function updateChatSessionMode(sessionId: string, mode: TutoringMode) {
  const parsed = updateModeSchema.safeParse({ sessionId, mode });
  if (!parsed.success) {
    throw new Error('Validation Failed: Invalid mode payload.');
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  await assertSessionOwnership(supabase, user.id, sessionId);

  const { error } = await supabase
    .from('chat_sessions')
    .update({ mode, updated_at: new Date().toISOString() })
    .eq('id', sessionId);

  if (error) throw error;
}

export async function toggleSessionShare(sessionId: string, isShared: boolean) {
  const parsed = toggleShareSchema.safeParse({ sessionId, isShared });
  if (!parsed.success) {
    throw new Error('Validation Failed: Invalid share toggle payload.');
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  await assertSessionOwnership(supabase, user.id, sessionId);

  // Default expiration: 1 hour from now
  const expiresAt = isShared ? new Date(Date.now() + 60 * 60 * 1000).toISOString() : null;

  const { error } = await supabase
    .from('chat_sessions')
    .update({
      is_shared: isShared,
      share_expires_at: expiresAt,
    })
    .eq('id', sessionId);

  if (error) throw error;
}

export async function getSharedSession(sessionId: string): Promise<ChatSession | null> {
  const parsed = sessionIdSchema.safeParse(sessionId);
  if (!parsed.success) {
    return null;
  }

  const supabase = await createClient();

  // Fetch session only if it is marked as shared
  const { data: sessionData, error } = await supabase
    .from('chat_sessions')
    .select('*')
    .eq('id', sessionId)
    .eq('is_shared', true)
    .or(`share_expires_at.is.null,share_expires_at.gt.${new Date().toISOString()}`) // Check expiration
    .single();

  if (error || !sessionData) {
    return null; // Not found or not shared
  }

  // Fetch messages for the session
  const { data: msgData } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true });

  const messages: ChatMessageRow[] = Array.isArray(msgData) ? msgData : [];

  return {
    id: sessionData.id,
    course: sessionData.course,
    mode: sessionData.mode,
    title: sessionData.title,
    messages:
      messages.map((msg) => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        timestamp: new Date(msg.created_at).getTime(),
        cardId: msg.card_id ?? undefined, // Map DB column
      })) || [],
    lastUpdated: new Date(sessionData.updated_at).getTime(),
    isPinned: sessionData.is_pinned,
    isShared: sessionData.is_shared,
  };
}

// --- Knowledge Card Concept Explanation ---
export type ExplainConceptResponse =
  | { success: true; explanation: string }
  | { success: false; error: string };

export async function explainConcept(
  concept: string,
  context: string,
  courseCode?: string,
): Promise<ExplainConceptResponse> {
  try {
    const parsed = explainConceptSchema.safeParse({ concept, context, courseCode });
    if (!parsed.success) {
      return { success: false, error: 'Invalid explain concept payload.' };
    }

    if (!process.env.GEMINI_API_KEY) {
      throw new Error('Missing GEMINI_API_KEY');
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new Error('Unauthorized');
    }

    // Unified Quota Check
    await enforceQuota();

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    // Build a focused prompt for concept explanation
    let systemInstruction = `You are a concise academic tutor. Explain the concept "${concept}" in a clear, educational manner.

Guidelines:
- Keep explanations brief (2-4 paragraphs max)
- Use simple language while being accurate
- Include a practical example if helpful
- Use LaTeX for math: $inline$ or $$block$$
- Focus on helping students understand quickly`;

    // Try to get RAG context if available
    if (courseCode) {
      try {
        const { retrieveContext } = await import('@/lib/rag/retrieval');
        const ragContext = await retrieveContext(concept, { course: courseCode }, 3);

        if (ragContext) {
          systemInstruction += `

### Relevant Course Material:
${ragContext}

Use this context to provide course-specific explanations when relevant.`;
        }
      } catch (e) {
        console.error('RAG failed for concept explanation:', e);
      }
    }

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `Explain "${concept}" briefly. Context from conversation: "${context.slice(0, 500)}"`,
            },
          ],
        },
      ],
      config: {
        systemInstruction,
        temperature: 0.5,
      },
    });

    return { success: true, explanation: response.text || 'Unable to generate explanation.' };
  } catch (error: unknown) {
    // Quota Exceeded: return specific error
    if (error instanceof QuotaExceededError) {
      return { success: false, error: error.message };
    }

    console.error('explainConcept error:', error);
    const message = error instanceof Error ? error.message : 'Failed to explain concept';
    return { success: false, error: message };
  }
}

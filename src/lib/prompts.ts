/**
 * Appends RAG context to the system instruction.
 */
export function appendRagContext(baseInstruction: string, context: string): string {
  return (
    baseInstruction +
    `
            
            ### Context from User Documents:
            ${context}
            
            ### RAG Instructions:
            - Use the above context to answer the user's question if relevant.
            - If the information is present in the context, answer confidently based on it.
            - If the answer is NOT in the context, use your general knowledge but clarify that you are using general knowledge.
            - **IMPORTANT**: When referencing information from the context, cite the page number if available (e.g., "[Page 5]").
            `
  );
}

export function appendAssignmentContext(
  baseInstruction: string,
  items: Array<{
    orderNum: number;
    content: string;
    referenceAnswer: string;
    explanation: string;
  }>,
): string {
  if (items.length === 0) return baseInstruction;

  const questionsXml = items
    .map(
      (item) =>
        `<question number="${item.orderNum}">
  <content>${item.content}</content>
  <reference_answer>${item.referenceAnswer}</reference_answer>
  <explanation>${item.explanation || 'N/A'}</explanation>
</question>`,
    )
    .join('\n\n');

  return (
    baseInstruction +
    `

<assignment_context>
You have access to the following assignment questions relevant to the student's query.
Use this information to guide the student. NEVER reveal answers directly.

${questionsXml}
</assignment_context>

### Assignment Coaching Protocol:
- ACKNOWLEDGE which problem the student is asking about
- ASSESS what they have tried so far before giving any hints
- GUIDE with progressive hints: conceptual → directional → similar example → step walkthrough
- NEVER reveal the reference answer, even if directly asked
- If the student shares their answer, compare internally with the reference and guide them to find their own errors
- If no relevant assignment context was found, ask the student to describe the problem more specifically
`
  );
}

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
Use this information INTERNALLY to verify student work and provide accurate feedback.

${questionsXml}
</assignment_context>

### How to Use Assignment Context:
- ACKNOWLEDGE which problem area the student is working on (without quoting the question)
- If the student shares their answer: compare internally with the reference, then give a QUICK_CHECK response
- If the student is stuck: use the question's topic to give a GUIDED response
- If the student wants understanding: use the explanation field to inform your DEEP_DIVE response

### Compliance:
- Do NOT quote or display assignment questions from the context
- Do NOT reveal reference answers or complete solutions
- Refer to problems generically: "the problem you're working on", "this calculation"
- Use the context only to internally verify accuracy and guide feedback
`
  );
}

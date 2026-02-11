# Knowledge Upload Redesign

## Summary

Redesign the knowledge upload pipeline to support different parsing strategies per document type, add a document detail page with view/edit capabilities, and fix existing upload issues.

## 1. Parsing Pipeline Architecture

All three document types use Gemini LLM for parsing. Each type produces different structured output.

### Lecture -> Structured Knowledge Points

Gemini extracts a list of knowledge points from lecture content:

```ts
interface KnowledgePoint {
  title: string; // Knowledge point title
  definition: string; // Definition/explanation
  keyFormulas?: string[]; // Related formulas
  keyConcepts?: string[]; // Key concepts
  examples?: string[]; // Examples
  sourcePages: number[]; // Source page numbers
}
```

### Assignment / Exam -> Structured Questions

Assignment and Exam share the same extraction logic. Both produce a list of questions. The `hasAnswers` flag (set during upload) tells the LLM whether to extract answers.

```ts
interface ExamQuestion {
  questionNumber: string; // Question number
  content: string; // Question content
  options?: string[]; // Options (for multiple choice)
  referenceAnswer?: string; // Reference answer (optional)
  score?: number; // Score/points
  sourcePage: number; // Source page number
}
```

### Upload Form Changes

- Add a "Contains Answers" toggle for assignment and exam types
- This flag is passed to the LLM prompt to guide extraction

### Storage

All parsed results are stored in `document_chunks` table. The `metadata` JSON field stores the structured data, and `content` stores the flattened text for embedding/search.

## 2. Document Detail Page

### Route

`/knowledge/[id]` - New dynamic route for document details.

### Layout

**Top: Metadata Section**

- Document name (editable)
- Document type badge
- Course info (editable)
- Status indicator
- Upload date

**Middle: Content Section (varies by doc_type)**

Lecture - Knowledge Point Cards:

- Card layout, one card per knowledge point
- Displays title, definition, formulas, concepts, examples, source pages
- Each card has "Edit" button for inline editing
- Support delete individual point and add new point

Assignment / Exam - Question List:

- List layout, one entry per question
- Displays question number, content, options, answer, score
- Each question has "Edit" button for inline editing
- Answer section collapsed by default
- Support delete individual question and add new question

**Bottom: Action Bar**

- "Save Changes" - Persist edits to database
- "Regenerate Embedding" - Manual trigger to regenerate embeddings from latest content
- "Back to List" - Navigate to /knowledge

## 3. Fix Existing Issues

### Error Handling Improvements

- Clean up orphaned chunks when parsing/embedding fails mid-process
- Write specific error messages to `status_message` field (e.g., "PDF parsing failed", "Embedding generation timeout")
- Display error details to users in the UI
- Add "Retry" action for failed documents

### Upload Validation

- Detect empty PDFs after parsing (no text extracted)
- Validate university/course values against UNIVERSITIES/COURSES constants

### UI/UX Fixes

- Add clickable "View Details" entry in KnowledgeTable rows, navigating to `/knowledge/[id]`
- Replace simulated progress with real progress stages (Parsing -> Extracting -> Generating Embedding -> Complete)
- Show specific error reason and retry button when document status is `error`

### Out of Scope (Future Iterations)

- RLS policies for documents/document_chunks tables
- Rate limiting and quota management
- Bulk upload functionality
- Content scanning for malicious PDFs

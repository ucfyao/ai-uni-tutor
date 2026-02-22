interface OutlineSection {
  title: string;
  briefDescription: string;
  knowledgePoints: string[];
  knowledgePointDetails?: { title: string; content: string }[];
}

interface DocumentOutline {
  title: string;
  summary: string;
  sections: OutlineSection[];
}

export function formatOutlineToMarkdown(outline: DocumentOutline): string {
  const lines: string[] = [];

  lines.push(`## ${outline.title}`);
  lines.push('');

  if (outline.sections.length === 0) return lines.join('\n');

  // Outline section — hierarchical structure
  lines.push('### Outline');
  for (const section of outline.sections) {
    lines.push(`- **${section.title}** — ${section.briefDescription}`);
    for (const kp of section.knowledgePoints) {
      lines.push(`  - ${kp}`);
    }
  }
  lines.push('');

  // Key Concepts section — detailed explanations
  const allDetails = outline.sections.flatMap((s) => s.knowledgePointDetails ?? []);
  if (allDetails.length > 0) {
    lines.push('### Key Concepts');
    allDetails.forEach((detail, i) => {
      lines.push(`${i + 1}. **${detail.title}** — ${detail.content}`);
    });
    lines.push('');
  }

  return lines.join('\n');
}

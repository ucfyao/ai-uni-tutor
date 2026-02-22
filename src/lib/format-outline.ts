interface OutlineSection {
  title: string;
  briefDescription: string;
  knowledgePoints: string[];
}

interface DocumentOutline {
  sections: OutlineSection[];
}

export function formatOutlineToMarkdown(outline: DocumentOutline, docName?: string): string {
  const lines: string[] = [];

  if (docName) {
    lines.push(`## ${docName}`);
    lines.push('');
  }

  if (outline.sections.length === 0) return lines.join('\n');

  lines.push('### Outline');
  for (const section of outline.sections) {
    lines.push(`- **${section.title}** — ${section.briefDescription}`);
    for (const kp of section.knowledgePoints) {
      lines.push(`  - ${kp}`);
    }
  }
  lines.push('');

  return lines.join('\n');
}

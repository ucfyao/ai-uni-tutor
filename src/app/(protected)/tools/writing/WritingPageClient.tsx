'use client';

import {
  AlertTriangle,
  CheckCircle,
  ChevronDown,
  ChevronLeft,
  Download,
  FileUp,
  NotebookPen,
  Play,
  RefreshCw,
  Sparkles,
  X,
} from 'lucide-react';
import { useCallback, useRef, useState, type ChangeEvent } from 'react';
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Card,
  Checkbox,
  Collapse,
  Divider,
  Group,
  Menu,
  Paper,
  Progress,
  RingProgress,
  ScrollArea,
  Select,
  Stack,
  Text,
  Title,
  Tooltip,
} from '@mantine/core';
import { WritingEditor } from '@/components/tools/WritingEditor';
import { useIsMobile } from '@/hooks/use-mobile';
import { useLanguage } from '@/i18n/LanguageContext';
import { showNotification } from '@/lib/notifications';
import type { SSEEventMap } from '@/lib/sse';
import type { WritingAnalysisResult, WritingService, WritingSuggestion } from '@/types/writing';
import '@/components/tools/writing-editor.css';

const TOOLS_COLOR = 'violet';

type AnalysisStatus = 'idle' | 'analyzing' | 'done' | 'error';

interface SuggestionState extends WritingSuggestion {
  status: 'pending' | 'applied' | 'dismissed';
}

const SERVICE_OPTIONS: {
  key: WritingService;
  labelKey: 'formatCheck' | 'academicPolish' | 'originalityCheck' | 'structureReview';
  descKey:
    | 'formatCheckDesc'
    | 'academicPolishDesc'
    | 'originalityCheckDesc'
    | 'structureReviewDesc';
}[] = [
  { key: 'format', labelKey: 'formatCheck', descKey: 'formatCheckDesc' },
  { key: 'polish', labelKey: 'academicPolish', descKey: 'academicPolishDesc' },
  { key: 'originality', labelKey: 'originalityCheck', descKey: 'originalityCheckDesc' },
  { key: 'structure', labelKey: 'structureReview', descKey: 'structureReviewDesc' },
];

const SEVERITY_COLORS: Record<string, string> = {
  error: 'red',
  warning: 'orange',
  suggestion: 'blue',
  info: 'gray',
};

/** Lightweight HTML-to-Markdown converter for TipTap output. */
function htmlToMarkdown(html: string): string {
  let md = html;
  // Headings
  md = md.replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n\n');
  md = md.replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n\n');
  md = md.replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n\n');
  // Bold / Italic / Underline / Strike
  md = md.replace(/<strong>(.*?)<\/strong>/gi, '**$1**');
  md = md.replace(/<em>(.*?)<\/em>/gi, '*$1*');
  md = md.replace(/<u>(.*?)<\/u>/gi, '$1');
  md = md.replace(/<s>(.*?)<\/s>/gi, '~~$1~~');
  // Blockquote
  md = md.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (_m, inner: string) => {
    const lines = inner
      .replace(/<\/?p[^>]*>/gi, '')
      .split('\n')
      .filter(Boolean);
    return lines.map((l: string) => `> ${l.trim()}`).join('\n') + '\n\n';
  });
  // Lists — unordered
  md = md.replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, (_m, inner: string) => {
    return inner.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '- $1\n') + '\n';
  });
  // Lists — ordered
  let counter = 0;
  md = md.replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, (_m, inner: string) => {
    counter = 0;
    return (
      inner.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, () => {
        counter++;
        return `${counter}. `;
      }) + '\n'
    );
  });
  // Fix ordered list items properly (re-run to capture content)
  md = md.replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, (_m, inner: string) => {
    let idx = 0;
    return (
      inner.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_lm, content: string) => {
        idx++;
        return `${idx}. ${content.trim()}\n`;
      }) + '\n'
    );
  });
  // Paragraphs and line breaks
  md = md.replace(/<br\s*\/?>/gi, '\n');
  md = md.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '$1\n\n');
  // Strip remaining tags
  md = md.replace(/<[^>]+>/g, '');
  // Decode HTML entities
  md = md
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
  // Clean up excessive newlines
  md = md.replace(/\n{3,}/g, '\n\n').trim();
  return md;
}

export default function WritingPageClient() {
  const { t } = useLanguage();
  const isMobile = useIsMobile();
  const abortRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Editor state
  const [htmlContent, setHtmlContent] = useState('');
  const [textContent, setTextContent] = useState('');
  const [importedContent, setImportedContent] = useState('');
  const [wordCount, setWordCount] = useState(0);

  // Service selection
  const [selectedServices, setSelectedServices] = useState<WritingService[]>([]);
  const [citationStyle, setCitationStyle] = useState<string>('apa');

  // Analysis state
  const [status, setStatus] = useState<AnalysisStatus>('idle');
  const [suggestions, setSuggestions] = useState<SuggestionState[]>([]);
  const [originalityScore, setOriginalityScore] = useState<number | null>(null);
  const [completedServices, setCompletedServices] = useState<Set<string>>(new Set());
  const [expandedService, setExpandedService] = useState<string | null>(null);

  // Mobile panel toggle
  const [showPanel, setShowPanel] = useState(!isMobile);

  const handleEditorUpdate = useCallback((html: string, text: string) => {
    setHtmlContent(html);
    setTextContent(text);
    const words = text.trim().split(/\s+/).filter(Boolean);
    setWordCount(words.length);
  }, []);

  const handleImport = useCallback(async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input so the same file can be re-imported
    e.target.value = '';

    const text = await file.text();
    // Convert plain text line breaks to HTML paragraphs for TipTap
    const html = text
      .split(/\n\n+/)
      .map((p) => `<p>${p.replace(/\n/g, '<br>')}</p>`)
      .join('');
    setImportedContent(html);
  }, []);

  const downloadFile = useCallback((content: string, filename: string, mime: string) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const handleExportTxt = useCallback(() => {
    if (!textContent.trim()) {
      showNotification({ message: t.tools.textTooShort, color: 'orange' });
      return;
    }
    downloadFile(textContent, 'document.txt', 'text/plain');
  }, [textContent, downloadFile, t]);

  const handleExportMarkdown = useCallback(() => {
    if (!htmlContent.trim()) {
      showNotification({ message: t.tools.textTooShort, color: 'orange' });
      return;
    }
    const md = htmlToMarkdown(htmlContent);
    downloadFile(md, 'document.md', 'text/markdown');
  }, [htmlContent, downloadFile, t]);

  const toggleService = useCallback((service: WritingService) => {
    setSelectedServices((prev) =>
      prev.includes(service) ? prev.filter((s) => s !== service) : [...prev, service],
    );
  }, []);

  const handleAnalyze = useCallback(async () => {
    if (textContent.length < 50) {
      showNotification({ message: t.tools.textTooShort, color: 'orange' });
      return;
    }
    if (selectedServices.length === 0) {
      showNotification({ message: t.tools.selectService, color: 'orange' });
      return;
    }

    abortRef.current?.abort();
    setStatus('analyzing');
    setSuggestions([]);
    setOriginalityScore(null);
    setCompletedServices(new Set());
    setExpandedService(null);

    const abortController = new AbortController();
    abortRef.current = abortController;

    try {
      const res = await fetch('/api/tools/writing/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: textContent,
          services: selectedServices,
          citationStyle: selectedServices.includes('format') ? citationStyle : undefined,
        }),
        signal: abortController.signal,
      });

      if (!res.ok || !res.body) {
        setStatus('error');
        showNotification({ message: t.tools.analysisError, color: 'red' });
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let currentEvent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            currentEvent = line.slice(7).trim();
          } else if (line.startsWith('data: ') && currentEvent) {
            try {
              const data = JSON.parse(line.slice(6));
              handleSSEEvent(currentEvent, data);
            } catch {
              // Skip malformed data
            }
            currentEvent = '';
          }
        }
      }

      setStatus((prev) => (prev === 'analyzing' ? 'done' : prev));
    } catch (err) {
      if (abortController.signal.aborted) return;
      console.error('Writing analysis error:', err);
      setStatus('error');
      showNotification({ message: t.tools.analysisError, color: 'red' });
    }

    function handleSSEEvent(event: string, data: unknown) {
      if (event === 'writing_result') {
        const result = data as SSEEventMap['writing_result'];

        if (result.error) {
          showNotification({ color: 'red', message: result.error });
          return;
        }

        const newSuggestions: SuggestionState[] = result.suggestions.map((s) => ({
          id: s.id,
          service: s.service as WritingService,
          severity: s.severity as WritingSuggestion['severity'],
          paragraphIndex: s.paragraphIndex,
          startOffset: s.startOffset,
          endOffset: s.endOffset,
          originalText: s.originalText,
          suggestedText: s.suggestedText,
          explanation: s.explanation,
          riskScore: s.riskScore,
          structureType: s.structureType as WritingSuggestion['structureType'],
          status: 'pending' as const,
        }));

        setSuggestions((prev) => [...prev, ...newSuggestions]);
        setCompletedServices((prev) => new Set([...prev, result.service]));

        if (result.overallScore != null) {
          setOriginalityScore(result.overallScore);
        }

        if (newSuggestions.length > 0) {
          setExpandedService((prev) => prev ?? result.service);
        }
      } else if (event === 'error') {
        const errorData = data as SSEEventMap['error'];
        setStatus('error');
        showNotification({ color: 'red', message: errorData.message });
      }
    }
  }, [textContent, selectedServices, citationStyle, t]);

  const handleApply = useCallback((id: string) => {
    setSuggestions((prev) => prev.map((s) => (s.id === id ? { ...s, status: 'applied' } : s)));
  }, []);

  const handleDismiss = useCallback((id: string) => {
    setSuggestions((prev) => prev.map((s) => (s.id === id ? { ...s, status: 'dismissed' } : s)));
  }, []);

  const handleApplyAll = useCallback(() => {
    setSuggestions((prev) =>
      prev.map((s) => (s.status === 'pending' ? { ...s, status: 'applied' } : s)),
    );
  }, []);

  const pendingCount = suggestions.filter((s) => s.status === 'pending').length;
  const appliedCount = suggestions.filter((s) => s.status === 'applied').length;
  const dismissedCount = suggestions.filter((s) => s.status === 'dismissed').length;

  const groupedSuggestions = SERVICE_OPTIONS.reduce(
    (acc, opt) => {
      acc[opt.key] = suggestions.filter((s) => s.service === opt.key);
      return acc;
    },
    {} as Record<WritingService, SuggestionState[]>,
  );

  const getOriginalityColor = (score: number) => {
    if (score >= 70) return 'green';
    if (score >= 40) return 'orange';
    return 'red';
  };

  const getOriginalityLabel = (score: number) => {
    if (score >= 70) return t.tools.riskLow;
    if (score >= 40) return t.tools.riskMedium;
    return t.tools.riskHigh;
  };

  return (
    <Box h="100vh" style={{ display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Group
        px="md"
        py="xs"
        justify="space-between"
        style={{ borderBottom: '1px solid var(--mantine-color-default-border)' }}
      >
        <Group gap="sm">
          <ActionIcon component="a" href="/tools" variant="subtle" color="gray" size="sm">
            <ChevronLeft size={18} />
          </ActionIcon>
          <NotebookPen size={20} color={`var(--mantine-color-${TOOLS_COLOR}-6)`} />
          <Title order={4} fw={600}>
            {t.tools.writingAssistant}
          </Title>
        </Group>
        <Group gap="xs">
          <Button
            variant="subtle"
            color="gray"
            size="xs"
            leftSection={<FileUp size={14} />}
            onClick={() => fileInputRef.current?.click()}
          >
            {t.tools.import}
          </Button>
          <Menu shadow="md" width={200}>
            <Menu.Target>
              <Button variant="subtle" color="gray" size="xs" leftSection={<Download size={14} />}>
                {t.tools.export}
              </Button>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item onClick={handleExportMarkdown}>{t.tools.exportMarkdown}</Menu.Item>
              <Menu.Item onClick={handleExportTxt}>{t.tools.exportTxt}</Menu.Item>
              <Menu.Divider />
              <Menu.Item disabled>{t.tools.exportDocx}</Menu.Item>
              <Menu.Item disabled>{t.tools.exportPdf}</Menu.Item>
            </Menu.Dropdown>
          </Menu>
          {isMobile && (
            <ActionIcon variant="light" color={TOOLS_COLOR} onClick={() => setShowPanel((p) => !p)}>
              <Sparkles size={16} />
            </ActionIcon>
          )}
        </Group>
      </Group>

      {/* Main content */}
      <Box style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Editor panel */}
        <Box
          style={{
            flex: 1,
            display: showPanel && isMobile ? 'none' : 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
          p="md"
        >
          <WritingEditor onUpdate={handleEditorUpdate} initialContent={importedContent} />
        </Box>

        {/* AI Panel */}
        {(showPanel || !isMobile) && (
          <Box
            style={{
              width: isMobile ? '100%' : 320,
              borderLeft: isMobile ? undefined : '1px solid var(--mantine-color-default-border)',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <ScrollArea style={{ flex: 1 }} p="md">
              <Stack gap="md">
                <Text fw={600} size="sm">
                  {t.tools.analyze}
                </Text>
                {SERVICE_OPTIONS.map((svc) => (
                  <Checkbox
                    key={svc.key}
                    label={t.tools[svc.labelKey]}
                    description={t.tools[svc.descKey]}
                    checked={selectedServices.includes(svc.key)}
                    onChange={() => toggleService(svc.key)}
                    color={TOOLS_COLOR}
                    size="sm"
                  />
                ))}

                {selectedServices.includes('format') && (
                  <Select
                    label={t.tools.citationStyle}
                    value={citationStyle}
                    onChange={(v) => v && setCitationStyle(v)}
                    data={[
                      { value: 'apa', label: t.tools.apa },
                      { value: 'mla', label: t.tools.mla },
                      { value: 'chicago', label: t.tools.chicago },
                      { value: 'harvard', label: t.tools.harvard },
                    ]}
                    size="sm"
                  />
                )}

                <Button
                  fullWidth
                  color={TOOLS_COLOR}
                  leftSection={status === 'done' ? <RefreshCw size={16} /> : <Play size={16} />}
                  onClick={handleAnalyze}
                  loading={status === 'analyzing'}
                >
                  {status === 'done' ? t.tools.reAnalyze : t.tools.analyze}
                </Button>

                {/* Analysis progress */}
                {status === 'analyzing' && (
                  <Paper withBorder p="sm" radius="md">
                    <Text size="sm" fw={500} mb="xs">
                      {t.tools.analyzing}
                    </Text>
                    <Progress
                      value={
                        selectedServices.length > 0
                          ? (completedServices.size / selectedServices.length) * 100
                          : 0
                      }
                      color={TOOLS_COLOR}
                      size="sm"
                      animated
                    />
                  </Paper>
                )}

                {/* Originality score */}
                {originalityScore != null && (
                  <Paper withBorder p="sm" radius="md">
                    <Group justify="space-between" align="center">
                      <Box>
                        <Text size="sm" fw={600}>
                          {t.tools.originalityScore}
                        </Text>
                        <Badge
                          size="sm"
                          color={getOriginalityColor(originalityScore)}
                          variant="light"
                          mt={4}
                        >
                          {getOriginalityLabel(originalityScore)}
                        </Badge>
                      </Box>
                      <RingProgress
                        size={60}
                        thickness={6}
                        roundCaps
                        sections={[
                          {
                            value: originalityScore,
                            color: getOriginalityColor(originalityScore),
                          },
                        ]}
                        label={
                          <Text size="xs" ta="center" fw={700}>
                            {originalityScore}
                          </Text>
                        }
                      />
                    </Group>
                    <Text size="xs" c="dimmed" mt="xs">
                      {t.tools.originalityDisclaimer}
                    </Text>
                  </Paper>
                )}

                {/* Results summary */}
                {status === 'done' && suggestions.length > 0 && (
                  <Group gap="xs">
                    <Badge size="sm" variant="light" color={TOOLS_COLOR}>
                      {t.tools.suggestions}: {pendingCount}
                    </Badge>
                    <Badge size="sm" variant="light" color="green">
                      {t.tools.applied}: {appliedCount}
                    </Badge>
                    <Badge size="sm" variant="light" color="gray">
                      {t.tools.dismissed}: {dismissedCount}
                    </Badge>
                    {pendingCount > 0 && (
                      <Button
                        size="compact-xs"
                        variant="light"
                        color={TOOLS_COLOR}
                        onClick={handleApplyAll}
                      >
                        {t.tools.applyAll}
                      </Button>
                    )}
                  </Group>
                )}

                {/* No suggestions */}
                {status === 'done' && suggestions.length === 0 && (
                  <Card withBorder radius="sm" p="md" ta="center">
                    <Stack align="center" gap="xs">
                      <CheckCircle size={32} color="var(--mantine-color-green-6)" />
                      <Text size="sm" fw={500}>
                        {t.tools.noSuggestions}
                      </Text>
                    </Stack>
                  </Card>
                )}

                {/* Grouped suggestions */}
                {(status === 'done' || status === 'analyzing') &&
                  SERVICE_OPTIONS.filter((opt) => groupedSuggestions[opt.key]?.length > 0).map(
                    (opt) => {
                      const serviceSuggestions = groupedSuggestions[opt.key];
                      const isExpanded = expandedService === opt.key;
                      return (
                        <Paper key={opt.key} withBorder radius="md" p={0}>
                          <Group
                            px="sm"
                            py="xs"
                            style={{ cursor: 'pointer' }}
                            onClick={() => setExpandedService(isExpanded ? null : opt.key)}
                            justify="space-between"
                          >
                            <Group gap="xs">
                              <Text size="sm" fw={600}>
                                {t.tools[opt.labelKey]}
                              </Text>
                              <Badge size="xs" variant="light" color={TOOLS_COLOR}>
                                {serviceSuggestions.length}
                              </Badge>
                            </Group>
                            <ChevronDown
                              size={14}
                              style={{
                                transform: isExpanded ? 'rotate(180deg)' : 'none',
                                transition: 'transform 150ms ease',
                              }}
                            />
                          </Group>
                          <Collapse in={isExpanded}>
                            <Divider />
                            <Stack gap={0}>
                              {serviceSuggestions.map((suggestion) => (
                                <Box
                                  key={suggestion.id}
                                  px="sm"
                                  py="xs"
                                  style={{
                                    borderBottom: '1px solid var(--mantine-color-default-border)',
                                    opacity: suggestion.status !== 'pending' ? 0.5 : 1,
                                  }}
                                >
                                  <Group gap="xs" mb={4} justify="space-between">
                                    <Badge
                                      size="xs"
                                      variant="light"
                                      color={SEVERITY_COLORS[suggestion.severity] ?? 'gray'}
                                    >
                                      {t.tools[suggestion.severity as keyof typeof t.tools] ??
                                        suggestion.severity}
                                    </Badge>
                                    {suggestion.status === 'pending' && (
                                      <Group gap={4}>
                                        <Tooltip label={t.tools.apply}>
                                          <ActionIcon
                                            size="xs"
                                            variant="light"
                                            color="green"
                                            onClick={() => handleApply(suggestion.id)}
                                          >
                                            <CheckCircle size={12} />
                                          </ActionIcon>
                                        </Tooltip>
                                        <Tooltip label={t.tools.dismiss}>
                                          <ActionIcon
                                            size="xs"
                                            variant="light"
                                            color="gray"
                                            onClick={() => handleDismiss(suggestion.id)}
                                          >
                                            <X size={12} />
                                          </ActionIcon>
                                        </Tooltip>
                                      </Group>
                                    )}
                                    {suggestion.status === 'applied' && (
                                      <Badge size="xs" variant="light" color="green">
                                        {t.tools.applied}
                                      </Badge>
                                    )}
                                    {suggestion.status === 'dismissed' && (
                                      <Badge size="xs" variant="light" color="gray">
                                        {t.tools.dismissed}
                                      </Badge>
                                    )}
                                  </Group>
                                  <Text size="xs" lh={1.5}>
                                    {suggestion.explanation}
                                  </Text>
                                  {suggestion.originalText && suggestion.suggestedText && (
                                    <Box
                                      p="xs"
                                      mt={4}
                                      style={{
                                        background: 'var(--mantine-color-gray-0)',
                                        borderRadius: 4,
                                      }}
                                    >
                                      <Text size="xs" td="line-through" c="red">
                                        {suggestion.originalText}
                                      </Text>
                                      <Text size="xs" c="green" mt={2}>
                                        {suggestion.suggestedText}
                                      </Text>
                                    </Box>
                                  )}
                                  {suggestion.riskScore != null && (
                                    <Group gap="xs" mt={4}>
                                      <AlertTriangle size={12} />
                                      <Text size="xs" c="dimmed">
                                        Risk: {suggestion.riskScore}%
                                      </Text>
                                    </Group>
                                  )}
                                </Box>
                              ))}
                            </Stack>
                          </Collapse>
                        </Paper>
                      );
                    },
                  )}
              </Stack>
            </ScrollArea>
          </Box>
        )}
      </Box>

      {/* Status bar */}
      <Group
        px="md"
        py={6}
        justify="apart"
        gap="lg"
        style={{ borderTop: '1px solid var(--mantine-color-default-border)' }}
      >
        <Text size="xs" c="dimmed">
          {t.tools.words}: {wordCount}
        </Text>
        {status !== 'idle' && (
          <>
            <Text size="xs" c="dimmed">
              {t.tools.suggestions}: {suggestions.length}
            </Text>
            <Text size="xs" c="dimmed">
              {t.tools.applied}: {appliedCount}
            </Text>
            <Text size="xs" c="dimmed">
              {t.tools.dismissed}: {dismissedCount}
            </Text>
          </>
        )}
        {status === 'analyzing' && (
          <Text size="xs" c={TOOLS_COLOR} fw={500}>
            {t.tools.analyzing}
          </Text>
        )}
      </Group>

      {/* Hidden file input for import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".txt,.md"
        style={{ display: 'none' }}
        onChange={handleImport}
      />
    </Box>
  );
}

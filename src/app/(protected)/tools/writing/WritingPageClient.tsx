'use client';

import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle,
  ChevronDown,
  FileText,
  Loader2,
  Sparkles,
  X,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useRef, useState } from 'react';
import {
  ActionIcon,
  Badge,
  Box,
  Button,
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
import { useLanguage } from '@/i18n/LanguageContext';
import { showNotification } from '@/lib/notifications';
import type { SSEEventMap } from '@/lib/sse';
import type { WritingService, WritingSuggestion } from '@/types/writing';
import '@/components/tools/writing-editor.css';

const TOOLS_COLOR = 'violet';

type AnalysisStatus = 'idle' | 'analyzing' | 'done' | 'error';

interface SuggestionState extends WritingSuggestion {
  status: 'pending' | 'applied' | 'dismissed';
}

const SERVICE_OPTIONS: {
  value: WritingService;
  labelKey: 'formatCheck' | 'academicPolish' | 'originalityCheck' | 'structureReview';
  descKey:
    | 'formatCheckDesc'
    | 'academicPolishDesc'
    | 'originalityCheckDesc'
    | 'structureReviewDesc';
}[] = [
  { value: 'format', labelKey: 'formatCheck', descKey: 'formatCheckDesc' },
  { value: 'polish', labelKey: 'academicPolish', descKey: 'academicPolishDesc' },
  { value: 'originality', labelKey: 'originalityCheck', descKey: 'originalityCheckDesc' },
  { value: 'structure', labelKey: 'structureReview', descKey: 'structureReviewDesc' },
];

const CITATION_OPTIONS = [
  { value: 'apa', label: 'APA 7th' },
  { value: 'mla', label: 'MLA 9th' },
  { value: 'chicago', label: 'Chicago' },
  { value: 'harvard', label: 'Harvard' },
];

const SEVERITY_COLORS: Record<string, string> = {
  error: 'red',
  warning: 'orange',
  suggestion: 'blue',
  info: 'gray',
};

export function WritingPageClient() {
  const { t } = useLanguage();
  const router = useRouter();
  const abortRef = useRef<AbortController | null>(null);

  // Editor state
  const [editorText, setEditorText] = useState('');
  const [wordCount, setWordCount] = useState(0);

  // Analysis config
  const [selectedServices, setSelectedServices] = useState<Set<WritingService>>(
    new Set(['format', 'polish']),
  );
  const [citationStyle, setCitationStyle] = useState<string | null>('apa');

  // Analysis results
  const [status, setStatus] = useState<AnalysisStatus>('idle');
  const [suggestions, setSuggestions] = useState<SuggestionState[]>([]);
  const [originalityScore, setOriginalityScore] = useState<number | null>(null);
  const [completedServices, setCompletedServices] = useState<Set<string>>(new Set());
  const [expandedService, setExpandedService] = useState<string | null>(null);

  const handleEditorUpdate = useCallback((_html: string, text: string) => {
    setEditorText(text);
    const words = text.trim().split(/\s+/).filter(Boolean);
    setWordCount(words.length);
  }, []);

  const toggleService = useCallback((service: WritingService) => {
    setSelectedServices((prev) => {
      const next = new Set(prev);
      if (next.has(service)) {
        next.delete(service);
      } else {
        next.add(service);
      }
      return next;
    });
  }, []);

  const startAnalysis = useCallback(async () => {
    if (editorText.trim().length < 50) {
      showNotification({ color: 'red', message: t.tools.textTooShort });
      return;
    }
    if (selectedServices.size === 0) {
      showNotification({ color: 'red', message: t.tools.selectService });
      return;
    }

    // Reset
    abortRef.current?.abort();
    setSuggestions([]);
    setOriginalityScore(null);
    setCompletedServices(new Set());
    setStatus('analyzing');
    setExpandedService(null);

    const abortController = new AbortController();
    abortRef.current = abortController;

    try {
      const response = await fetch('/api/tools/writing-analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: editorText,
          services: Array.from(selectedServices),
          citationStyle: selectedServices.has('format') ? citationStyle : undefined,
        }),
        signal: abortController.signal,
      });

      if (!response.ok || !response.body) {
        setStatus('error');
        showNotification({ color: 'red', message: t.tools.analysisError });
        return;
      }

      const reader = response.body.getReader();
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
      showNotification({ color: 'red', message: t.tools.analysisError });
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

        // Auto-expand first service with results
        if (newSuggestions.length > 0) {
          setExpandedService((prev) => prev ?? result.service);
        }
      } else if (event === 'error') {
        const errorData = data as SSEEventMap['error'];
        setStatus('error');
        showNotification({ color: 'red', message: errorData.message });
      }
    }
  }, [editorText, selectedServices, citationStyle, t]);

  const handleApplySuggestion = useCallback((id: string) => {
    setSuggestions((prev) => prev.map((s) => (s.id === id ? { ...s, status: 'applied' } : s)));
  }, []);

  const handleDismissSuggestion = useCallback((id: string) => {
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
      acc[opt.value] = suggestions.filter((s) => s.service === opt.value);
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
    <Box
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: 'calc(100vh - 60px)',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <Group
        px="md"
        py="xs"
        style={{ borderBottom: '1px solid var(--mantine-color-default-border)' }}
      >
        <ActionIcon variant="subtle" color="gray" onClick={() => router.push('/tools')}>
          <ArrowLeft size={18} />
        </ActionIcon>
        <FileText size={20} color={`var(--mantine-color-${TOOLS_COLOR}-6)`} />
        <Title order={4} fw={600} style={{ flex: 1 }}>
          {t.tools.writingAssistant}
        </Title>
        <Menu shadow="md" width={200}>
          <Menu.Target>
            <Button variant="subtle" color="gray" size="xs" leftSection={<ChevronDown size={14} />}>
              {t.tools.export}
            </Button>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Item disabled>{t.tools.exportDocx}</Menu.Item>
            <Menu.Item disabled>{t.tools.exportPdf}</Menu.Item>
            <Menu.Item disabled>{t.tools.exportMarkdown}</Menu.Item>
          </Menu.Dropdown>
        </Menu>
      </Group>

      {/* Main content */}
      <Box style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Editor panel */}
        <Box style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <Box style={{ flex: 1, overflow: 'hidden', padding: 16 }}>
            <WritingEditor onUpdate={handleEditorUpdate} />
          </Box>
        </Box>

        {/* Analysis panel */}
        <Box
          style={{
            width: 360,
            borderLeft: '1px solid var(--mantine-color-default-border)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <ScrollArea style={{ flex: 1 }} p="md">
            <Stack gap="md">
              {/* Service selection */}
              <Box>
                <Text size="sm" fw={600} mb="xs">
                  {t.tools.citationStyle}
                </Text>
                <Select
                  size="xs"
                  data={CITATION_OPTIONS}
                  value={citationStyle}
                  onChange={setCitationStyle}
                  mb="sm"
                />
                {SERVICE_OPTIONS.map((opt) => (
                  <Checkbox
                    key={opt.value}
                    label={
                      <Box>
                        <Text size="sm" fw={500}>
                          {t.tools[opt.labelKey]}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {t.tools[opt.descKey]}
                        </Text>
                      </Box>
                    }
                    checked={selectedServices.has(opt.value)}
                    onChange={() => toggleService(opt.value)}
                    mb="xs"
                    color={TOOLS_COLOR}
                  />
                ))}
              </Box>

              {/* Analyze button */}
              <Button
                color={TOOLS_COLOR}
                fullWidth
                leftSection={
                  status === 'analyzing' ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Sparkles size={16} />
                  )
                }
                onClick={startAnalysis}
                loading={status === 'analyzing'}
                disabled={status === 'analyzing'}
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
                    value={(completedServices.size / selectedServices.size) * 100}
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
                <Paper withBorder p="md" radius="md">
                  <Group gap="sm">
                    <CheckCircle size={20} color="var(--mantine-color-green-6)" />
                    <Text size="sm" fw={500}>
                      {t.tools.noSuggestions}
                    </Text>
                  </Group>
                </Paper>
              )}

              {/* Grouped suggestions */}
              {(status === 'done' || status === 'analyzing') &&
                SERVICE_OPTIONS.filter((opt) => groupedSuggestions[opt.value]?.length > 0).map(
                  (opt) => {
                    const serviceSuggestions = groupedSuggestions[opt.value];
                    const isExpanded = expandedService === opt.value;
                    return (
                      <Paper key={opt.value} withBorder radius="md" p={0}>
                        <Group
                          px="sm"
                          py="xs"
                          style={{ cursor: 'pointer' }}
                          onClick={() => setExpandedService(isExpanded ? null : opt.value)}
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
                                          onClick={() => handleApplySuggestion(suggestion.id)}
                                        >
                                          <Check size={12} />
                                        </ActionIcon>
                                      </Tooltip>
                                      <Tooltip label={t.tools.dismiss}>
                                        <ActionIcon
                                          size="xs"
                                          variant="light"
                                          color="gray"
                                          onClick={() => handleDismissSuggestion(suggestion.id)}
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
                                {suggestion.originalText && (
                                  <Text
                                    size="xs"
                                    c="dimmed"
                                    mt={2}
                                    style={{ textDecoration: 'line-through' }}
                                  >
                                    {suggestion.originalText}
                                  </Text>
                                )}
                                {suggestion.suggestedText && (
                                  <Text size="xs" c="green" mt={2} fw={500}>
                                    {suggestion.suggestedText}
                                  </Text>
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
      </Box>

      {/* Status bar */}
      <Group
        px="md"
        py={6}
        justify="space-between"
        style={{ borderTop: '1px solid var(--mantine-color-default-border)' }}
      >
        <Text size="xs" c="dimmed">
          {t.tools.words}: {wordCount}
        </Text>
        {status === 'analyzing' && (
          <Text size="xs" c={TOOLS_COLOR}>
            {t.tools.analyzing}
          </Text>
        )}
        {status === 'done' && suggestions.length > 0 && (
          <Text size="xs" c="dimmed">
            {suggestions.length} {t.tools.suggestions.toLowerCase()}
          </Text>
        )}
      </Group>
    </Box>
  );
}

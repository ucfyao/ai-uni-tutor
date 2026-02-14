'use client';

import { AlertCircle, FileText, Loader2, Upload, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Alert, Box, Group, Progress, rem, Select, SimpleGrid, Stack, Text } from '@mantine/core';
import { Dropzone, DropzoneProps, PDF_MIME_TYPE } from '@mantine/dropzone';
import { uploadDocument } from '@/app/actions/documents';
import { COURSES, UNIVERSITIES } from '@/constants/index';
import { PLACEHOLDERS } from '@/constants/placeholders';
import { useLanguage } from '@/i18n/LanguageContext';
import { showNotification } from '@/lib/notifications';

type ProcessingStage =
  | 'idle'
  | 'uploading'
  | 'parsing'
  | 'chunking'
  | 'embedding'
  | 'saving'
  | 'complete';

const STAGE_PROGRESS: Record<ProcessingStage, number> = {
  idle: 0,
  uploading: 10,
  parsing: 30,
  chunking: 50,
  embedding: 70,
  saving: 90,
  complete: 100,
};

export function FileUploader(props: Partial<DropzoneProps>) {
  const { t } = useLanguage();

  const STAGE_LABELS: Record<ProcessingStage, string> = {
    idle: '',
    uploading: t.knowledge.uploadingFile,
    parsing: t.knowledge.parsingPdf,
    chunking: t.knowledge.splittingChunks,
    embedding: t.knowledge.generatingEmbeddings,
    saving: t.knowledge.savingToDatabase,
    complete: t.knowledge.complete,
  };

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedUniId, setSelectedUniId] = useState<string | null>(null);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [stage, setStage] = useState<ProcessingStage>('idle');
  const [fileName, setFileName] = useState<string | null>(null);

  // Simulate progress stages during processing
  useEffect(() => {
    if (!loading) {
      setStage('idle');
      return;
    }

    // Simulate stage progression
    const stages: ProcessingStage[] = ['uploading', 'parsing', 'chunking', 'embedding', 'saving'];
    let currentIndex = 0;

    const interval = setInterval(() => {
      if (currentIndex < stages.length) {
        setStage(stages[currentIndex]);
        currentIndex++;
      }
    }, 1500); // Progress every 1.5s

    return () => clearInterval(interval);
  }, [loading]);

  // Derived state for courses based on selected university
  const filteredCourses = selectedUniId
    ? COURSES.filter((c) => c.universityId === selectedUniId)
    : [];

  const handleDrop = async (files: File[]) => {
    setLoading(true);
    setError(null);
    const file = files[0]; // Process one file for MVP
    setFileName(file.name);

    // Only PDF for now
    if (file.type !== 'application/pdf') {
      setError(t.knowledge.pdfOnly);
      setLoading(false);
      setFileName(null);
      return;
    }

    if (!selectedUniId || !selectedCourseId) {
      setError(t.knowledge.selectUniAndCourse);
      setLoading(false);
      setFileName(null);
      return;
    }

    // Get actual string values
    const uniObj = UNIVERSITIES.find((u) => u.id === selectedUniId);
    const courseObj = COURSES.find((c) => c.id === selectedCourseId);

    // Fallback to "General" if not found (shouldn't happen with valid selection)
    const schoolName = uniObj ? uniObj.shortName : 'General';
    const courseCode = courseObj ? courseObj.code : 'General';

    const formData = new FormData();
    formData.append('file', file);
    formData.append('school', schoolName);
    formData.append('course', courseCode);

    try {
      // Call server action directly?
      // Server actions can be called directly.
      // But uploadDocument signature is (prevState, formData) -> State
      // So usually used with useFormState.
      // But we can just call it if we mock the state or adjust the signature.
      // Let's adjust signature usage or just pass a dummy state.
      const result = await uploadDocument({ status: 'idle', message: '' }, formData);

      if (result.status === 'success') {
        setStage('complete');
        showNotification({
          title: t.knowledge.success,
          message: t.knowledge.documentUploaded,
          color: 'green',
        });
        // Reset selections after successful upload
        setTimeout(() => {
          setSelectedUniId(null);
          setSelectedCourseId(null);
          setFileName(null);
        }, 1000);
      } else {
        setError(result.message);
        showNotification({
          title: 'Error',
          message: result.message,
          color: 'red',
        });
      }
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'Upload failed';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Stack>
      <Dropzone
        onDrop={handleDrop}
        onReject={() =>
          setError(
            `File rejected. Please upload a valid PDF less than ${process.env.NEXT_PUBLIC_MAX_FILE_SIZE_MB || 5}MB.`,
          )
        }
        maxSize={parseInt(process.env.NEXT_PUBLIC_MAX_FILE_SIZE_MB || '5') * 1024 * 1024} // Configurable MB
        accept={PDF_MIME_TYPE}
        loading={loading}
        {...props}
      >
        <Group justify="center" gap="xl" style={{ minHeight: rem(220), pointerEvents: 'none' }}>
          <Dropzone.Accept>
            <Upload
              size={52}
              color="var(--mantine-color-blue-6)"
              style={{ width: rem(52), height: rem(52) }}
            />
          </Dropzone.Accept>
          <Dropzone.Reject>
            <X
              size={52}
              color="var(--mantine-color-red-6)"
              style={{ width: rem(52), height: rem(52) }}
            />
          </Dropzone.Reject>
          <Dropzone.Idle>
            <FileText
              size={52}
              color="var(--mantine-color-dimmed)"
              style={{ width: rem(52), height: rem(52) }}
            />
          </Dropzone.Idle>

          <div>
            <Text size="xl" inline>
              {t.knowledge.dragAndDrop}
            </Text>
            <Text size="sm" c="dimmed" inline mt={7}>
              {t.knowledge.attachDescription}
            </Text>
          </div>
        </Group>
      </Dropzone>

      {/* Progress Indicator */}
      {loading && stage !== 'idle' && (
        <Box p="md" bg="gray.0" style={{ borderRadius: '8px' }}>
          <Group gap="sm" mb="xs">
            <Loader2 size={16} className="animate-spin" color="var(--mantine-color-indigo-6)" />
            <Text size="sm" fw={500} c="dark.7">
              {fileName && (
                <Text component="span" c="dimmed" mr="xs">
                  {fileName}
                </Text>
              )}
              {STAGE_LABELS[stage]}
            </Text>
          </Group>
          <Progress
            value={STAGE_PROGRESS[stage]}
            size="sm"
            radius="xl"
            color={stage === 'complete' ? 'green' : 'indigo'}
            animated={stage !== 'complete'}
          />
          <Text size="xs" c="dimmed" mt="xs" ta="right">
            {STAGE_PROGRESS[stage]}%
          </Text>
        </Box>
      )}

      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
        <Select
          label="University"
          placeholder={PLACEHOLDERS.SELECT_UNIVERSITY}
          data={UNIVERSITIES.map((u) => ({ value: u.id, label: u.name }))}
          value={selectedUniId}
          onChange={(val) => {
            setSelectedUniId(val);
            setSelectedCourseId(null); // Reset course when uni changes
          }}
          searchable
          allowDeselect={false}
          aria-label="Select university"
        />
        <Select
          label="Course"
          placeholder={selectedUniId ? PLACEHOLDERS.SELECT_COURSE : PLACEHOLDERS.SELECT_FIRST}
          data={filteredCourses.map((c) => ({ value: c.id, label: `${c.code}: ${c.name}` }))}
          value={selectedCourseId}
          onChange={setSelectedCourseId}
          disabled={!selectedUniId}
          searchable
          allowDeselect={false}
          aria-label="Select course"
        />
      </SimpleGrid>

      {error && (
        <Alert
          variant="light"
          color="red"
          title={t.knowledge.uploadFailed}
          icon={<AlertCircle size={16} />}
        >
          {error}
        </Alert>
      )}
    </Stack>
  );
}

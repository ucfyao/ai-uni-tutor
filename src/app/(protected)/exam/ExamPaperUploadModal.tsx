'use client';

import { IconFileText, IconUpload, IconX } from '@tabler/icons-react';
import { useActionState, useRef, useState } from 'react';
import { Button, Group, Modal, Select, Stack, Text, TextInput } from '@mantine/core';
import { Dropzone, MIME_TYPES } from '@mantine/dropzone';
import { uploadAndParseExamPaper, type ExamPaperUploadState } from '@/app/actions/exam-papers';

interface Props {
  opened: boolean;
  onClose: () => void;
  isAdmin?: boolean;
}

export function ExamPaperUploadModal({ opened, onClose, isAdmin }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const [state, formAction, isPending] = useActionState<ExamPaperUploadState, FormData>(
    async (prevState, formData) => {
      if (file) {
        formData.set('file', file);
      }
      return uploadAndParseExamPaper(prevState, formData);
    },
    { status: 'idle', message: '' },
  );

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <Modal opened={opened} onClose={onClose} title="Upload Exam Paper" centered size="md">
      <form ref={formRef} action={formAction}>
        <Stack gap="md">
          <Dropzone
            onDrop={(files) => setFile(files[0] ?? null)}
            onReject={() => setFile(null)}
            maxSize={20 * 1024 * 1024}
            accept={[MIME_TYPES.pdf]}
            multiple={false}
          >
            <Group justify="center" gap="xl" mih={120} style={{ pointerEvents: 'none' }}>
              <Dropzone.Accept>
                <IconUpload size={40} stroke={1.5} color="var(--mantine-color-violet-6)" />
              </Dropzone.Accept>
              <Dropzone.Reject>
                <IconX size={40} stroke={1.5} color="var(--mantine-color-red-6)" />
              </Dropzone.Reject>
              <Dropzone.Idle>
                <IconFileText size={40} stroke={1.5} style={{ opacity: 0.4 }} />
              </Dropzone.Idle>
              <div>
                <Text size="sm" inline>
                  Drag a PDF here or click to select
                </Text>
                <Text size="xs" c="dimmed" inline mt={4}>
                  Max file size: 20 MB
                </Text>
              </div>
            </Group>
          </Dropzone>

          {file && (
            <Group gap="xs" p="xs" className="bg-surface-subtle" style={{ borderRadius: 8 }}>
              <IconFileText size={16} style={{ opacity: 0.6 }} />
              <Text size="sm" fw={500} style={{ flex: 1 }} lineClamp={1}>
                {file.name}
              </Text>
              <Text size="xs" c="dimmed">
                {formatFileSize(file.size)}
              </Text>
            </Group>
          )}

          <TextInput name="school" label="School" placeholder="e.g. MIT" />
          <TextInput name="course" label="Course" placeholder="e.g. Linear Algebra" />
          <TextInput name="year" label="Year / Semester" placeholder="e.g. 2024 Fall Final" />

          {isAdmin && (
            <Select
              name="visibility"
              label="Visibility"
              data={[
                { value: 'public', label: 'Public (all users)' },
                { value: 'private', label: 'Private (only me)' },
              ]}
              defaultValue="public"
            />
          )}

          {state.status === 'error' && (
            <Text c="red" size="sm">
              {state.message}
            </Text>
          )}
          {state.status === 'success' && (
            <Text c="green" size="sm">
              {state.message}
            </Text>
          )}

          <Button type="submit" loading={isPending} disabled={!file} fullWidth>
            Upload & Parse
          </Button>
        </Stack>
      </form>
    </Modal>
  );
}

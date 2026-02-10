'use client';

import { IconUpload } from '@tabler/icons-react';
import { useActionState } from 'react';
import { Button, FileInput, Modal, Select, Stack, Text, TextInput } from '@mantine/core';
import { uploadAndParseExamPaper, type ExamPaperUploadState } from '@/app/actions/exam-papers';

interface Props {
  opened: boolean;
  onClose: () => void;
  isAdmin?: boolean;
}

export function ExamPaperUploadModal({ opened, onClose, isAdmin }: Props) {
  const [state, formAction, isPending] = useActionState<ExamPaperUploadState, FormData>(
    uploadAndParseExamPaper,
    { status: 'idle', message: '' },
  );

  return (
    <Modal opened={opened} onClose={onClose} title="Upload Exam Paper" centered>
      <form action={formAction}>
        <Stack gap="md">
          <FileInput
            name="file"
            label="Exam Paper (PDF)"
            placeholder="Select PDF file"
            accept="application/pdf"
            required
            leftSection={<IconUpload size={16} />}
          />
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

          <Button type="submit" loading={isPending} fullWidth>
            Upload & Parse
          </Button>
        </Stack>
      </form>
    </Modal>
  );
}

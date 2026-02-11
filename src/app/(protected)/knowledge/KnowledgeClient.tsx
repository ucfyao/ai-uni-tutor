'use client';

import { FileText, Plus, Upload, X } from 'lucide-react';
import { useState } from 'react';
import {
  Box,
  Button,
  Group,
  Modal,
  rem,
  Select,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
} from '@mantine/core';
import { Dropzone, PDF_MIME_TYPE } from '@mantine/dropzone';
import { useDisclosure } from '@mantine/hooks';
import { uploadDocument } from '@/app/actions/documents';
import { COURSES, UNIVERSITIES } from '@/constants/index';
import { showNotification } from '@/lib/notifications';

const DOC_TYPES = [
  { value: 'lecture', label: 'Lecture' },
  { value: 'exam', label: 'Exam' },
  { value: 'assignment', label: 'Assignment' },
];

export function UploadButton() {
  const [modalOpened, { open: openModal, close: closeModal }] = useDisclosure(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [docType, setDocType] = useState<string | null>(null);
  const [selectedUniId, setSelectedUniId] = useState<string | null>(null);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const filteredCourses = selectedUniId
    ? COURSES.filter((c) => c.universityId === selectedUniId)
    : [];

  const handleUpload = async () => {
    if (!selectedFile || !docType || !selectedUniId || !selectedCourseId) return;

    const uniObj = UNIVERSITIES.find((u) => u.id === selectedUniId);
    const courseObj = COURSES.find((c) => c.id === selectedCourseId);

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('doc_type', docType);
    formData.append('school', uniObj?.shortName ?? '');
    formData.append('course', courseObj?.code ?? '');

    setUploading(true);
    try {
      const result = await uploadDocument({ status: 'idle', message: '' }, formData);
      if (result.status === 'success') {
        showNotification({ title: 'Success', message: 'Document uploaded!', color: 'green' });
        closeModal();
        resetForm();
      } else {
        showNotification({ title: 'Error', message: result.message, color: 'red' });
      }
    } catch {
      showNotification({ title: 'Error', message: 'Upload failed.', color: 'red' });
    } finally {
      setUploading(false);
    }
  };

  const resetForm = () => {
    setSelectedFile(null);
    setDocType(null);
    setSelectedUniId(null);
    setSelectedCourseId(null);
  };

  const isFormValid = selectedFile && docType && selectedUniId && selectedCourseId;

  return (
    <>
      <Button leftSection={<Plus size={16} />} size="sm" onClick={openModal}>
        Upload
      </Button>

      <Modal
        opened={modalOpened}
        onClose={() => {
          closeModal();
          resetForm();
        }}
        title={
          <Group gap="xs">
            <ThemeIcon size={28} radius="md" variant="light" color="indigo">
              <Upload size={14} />
            </ThemeIcon>
            <Text fw={600}>Upload Document</Text>
          </Group>
        }
        size="lg"
        radius="lg"
      >
        <Stack gap="lg" mt="xs">
          {/* Dropzone */}
          <Dropzone
            onDrop={(files) => setSelectedFile(files[0])}
            onReject={() =>
              showNotification({
                title: 'File rejected',
                message: `Please upload a valid PDF less than ${process.env.NEXT_PUBLIC_MAX_FILE_SIZE_MB || 5}MB.`,
                color: 'red',
              })
            }
            maxSize={parseInt(process.env.NEXT_PUBLIC_MAX_FILE_SIZE_MB || '5') * 1024 * 1024}
            accept={PDF_MIME_TYPE}
            multiple={false}
            disabled={uploading}
            styles={{
              root: {
                borderColor: selectedFile ? 'var(--mantine-color-green-5)' : undefined,
                backgroundColor: selectedFile ? 'var(--mantine-color-green-0)' : undefined,
              },
            }}
          >
            <Group justify="center" gap="xl" style={{ minHeight: rem(160), pointerEvents: 'none' }}>
              <Dropzone.Accept>
                <Upload
                  size={48}
                  color="var(--mantine-color-indigo-6)"
                  style={{ width: rem(48), height: rem(48) }}
                />
              </Dropzone.Accept>
              <Dropzone.Reject>
                <X
                  size={48}
                  color="var(--mantine-color-red-6)"
                  style={{ width: rem(48), height: rem(48) }}
                />
              </Dropzone.Reject>
              <Dropzone.Idle>
                {selectedFile ? (
                  <FileText
                    size={48}
                    color="var(--mantine-color-green-6)"
                    style={{ width: rem(48), height: rem(48) }}
                  />
                ) : (
                  <Upload
                    size={48}
                    color="var(--mantine-color-dimmed)"
                    style={{ width: rem(48), height: rem(48) }}
                  />
                )}
              </Dropzone.Idle>

              <Box>
                {selectedFile ? (
                  <>
                    <Text size="lg" fw={600} c="green.7" inline>
                      {selectedFile.name}
                    </Text>
                    <Text size="sm" c="dimmed" inline mt={7}>
                      Click or drag to replace
                    </Text>
                  </>
                ) : (
                  <>
                    <Text size="lg" fw={500} inline>
                      Drag a PDF here or click to select
                    </Text>
                    <Text size="sm" c="dimmed" inline mt={7}>
                      Upload course materials, lecture slides, or past exams
                    </Text>
                  </>
                )}
              </Box>
            </Group>
          </Dropzone>

          {/* Metadata fields */}
          <Select
            label="Document Type"
            placeholder="Select type"
            data={DOC_TYPES}
            value={docType}
            onChange={setDocType}
            required
          />

          <SimpleGrid cols={2} spacing="md">
            <Select
              label="University"
              placeholder="Select university"
              data={UNIVERSITIES.map((u) => ({ value: u.id, label: u.name }))}
              value={selectedUniId}
              onChange={(val) => {
                setSelectedUniId(val);
                setSelectedCourseId(null);
              }}
              searchable
              required
            />
            <Select
              label="Course"
              placeholder={selectedUniId ? 'Select course' : 'Select university first'}
              data={filteredCourses.map((c) => ({
                value: c.id,
                label: `${c.code}: ${c.name}`,
              }))}
              value={selectedCourseId}
              onChange={setSelectedCourseId}
              disabled={!selectedUniId}
              searchable
              required
            />
          </SimpleGrid>

          <Button
            fullWidth
            size="md"
            onClick={handleUpload}
            loading={uploading}
            disabled={!isFormValid}
            leftSection={<Upload size={16} />}
          >
            Upload Document
          </Button>
        </Stack>
      </Modal>
    </>
  );
}

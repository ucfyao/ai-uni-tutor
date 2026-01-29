'use client';

import { useState } from 'react';
import { Group, Text, useMantineTheme, rem, Stack, Progress, Alert } from '@mantine/core';
import { Dropzone, DropzoneProps, PDF_MIME_TYPE } from '@mantine/dropzone';
import { Upload, X, FileText, CheckCircle, AlertCircle } from 'lucide-react';
import { uploadDocument } from '@/app/actions/documents';
import { notifications } from '@mantine/notifications';
import { useRouter } from 'next/navigation';
import { UNIVERSITIES, COURSES } from '@/constants/index';
import { Select } from '@mantine/core';

export function FileUploader(props: Partial<DropzoneProps>) {
  const theme = useMantineTheme();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedUniId, setSelectedUniId] = useState<string | null>(null);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);

  // Derived state for courses based on selected university
  const filteredCourses = selectedUniId 
    ? COURSES.filter(c => c.universityId === selectedUniId)
    : [];

  const handleDrop = async (files: File[]) => {
    setLoading(true);
    setError(null);
    const file = files[0]; // Process one file for MVP
    
    // Only PDF for now
    if (file.type !== 'application/pdf') {
        setError('Only PDF files are supported currently.');
        setLoading(false);
        return;
    }

    if (!selectedUniId || !selectedCourseId) {
        setError('Please select a valid University and Course before uploading.');
        setLoading(false);
        return;
    }

    // Get actual string values
    const uniObj = UNIVERSITIES.find(u => u.id === selectedUniId);
    const courseObj = COURSES.find(c => c.id === selectedCourseId);
    
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
        notifications.show({
            title: 'Success',
            message: 'Document uploaded and processed!',
            color: 'green',
        });
        notifications.show({
            title: 'Success',
            message: 'Document uploaded and processed!',
            color: 'green',
        });
        // router.refresh(); // Removed to avoid double refresh (Server Action revalidates + Realtime updates)
      } else {
        setError(result.message);
        notifications.show({
            title: 'Error',
            message: result.message,
            color: 'red',
        });
      }
    } catch (e: any) {
      setError(e.message || 'Upload failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Stack>
      <Dropzone
        onDrop={handleDrop}
        onReject={(files) => setError(`File rejected. Please upload a valid PDF less than ${process.env.NEXT_PUBLIC_MAX_FILE_SIZE_MB || 5}MB.`)}
        maxSize={(parseInt(process.env.NEXT_PUBLIC_MAX_FILE_SIZE_MB || '5')) * 1024 * 1024} // Configurable MB
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
              Drag PDF here or click to select
            </Text>
            <Text size="sm" c="dimmed" inline mt={7}>
              Attach a course syllabus, reading material, or lecture notes.
            </Text>
          </div>
        </Group>
      </Dropzone>

      <Group grow align="flex-start">
        <Select 
            label="University" 
            placeholder="Select University" 
            data={UNIVERSITIES.map(u => ({ value: u.id, label: u.name }))}
            value={selectedUniId} 
            onChange={(val) => {
                setSelectedUniId(val);
                setSelectedCourseId(null); // Reset course when uni changes
            }}
            searchable
            allowDeselect={false}
        />
        <Select 
            label="Course" 
            placeholder={selectedUniId ? "Select Course" : "Select University First"} 
            data={filteredCourses.map(c => ({ value: c.id, label: `${c.code}: ${c.name}` }))}
            value={selectedCourseId} 
            onChange={setSelectedCourseId}
            disabled={!selectedUniId}
            searchable
            allowDeselect={false}
        />
      </Group>

      {error && (
        <Alert variant="light" color="red" title="Upload Failed" icon={<AlertCircle size={16} />}>
          {error}
        </Alert>
      )}
    </Stack>
  );
}

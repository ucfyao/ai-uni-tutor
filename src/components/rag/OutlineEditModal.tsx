'use client';

import { Check, Plus, Trash2 } from 'lucide-react';
import { useCallback, useState } from 'react';
import {
  ActionIcon,
  Box,
  Button,
  Divider,
  Group,
  Modal,
  Stack,
  Text,
  Textarea,
  TextInput,
} from '@mantine/core';
import { updateDocumentOutline } from '@/app/actions/documents';
import { useLanguage } from '@/i18n/LanguageContext';
import { showNotification } from '@/lib/notifications';

interface OutlineSection {
  title: string;
  briefDescription: string;
  knowledgePoints: string[];
}

interface OutlineEditModalProps {
  opened: boolean;
  onClose: () => void;
  documentId: string;
  documentName: string;
  sections: OutlineSection[];
  onSaved?: () => void;
}

export function OutlineEditModal({
  opened,
  onClose,
  documentId,
  documentName,
  sections: initialSections,
  onSaved,
}: OutlineEditModalProps) {
  const { t } = useLanguage();
  const [sections, setSections] = useState<OutlineSection[]>(initialSections);
  const [saving, setSaving] = useState(false);

  const updateSection = useCallback(
    (index: number, field: keyof OutlineSection, value: string | string[]) => {
      setSections((prev) => prev.map((s, i) => (i === index ? { ...s, [field]: value } : s)));
    },
    [],
  );

  const addSection = useCallback(() => {
    setSections((prev) => [...prev, { title: '', briefDescription: '', knowledgePoints: [] }]);
  }, []);

  const removeSection = useCallback((index: number) => {
    setSections((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const addKP = useCallback((sectionIndex: number) => {
    setSections((prev) =>
      prev.map((s, i) =>
        i === sectionIndex ? { ...s, knowledgePoints: [...s.knowledgePoints, ''] } : s,
      ),
    );
  }, []);

  const updateKP = useCallback((sectionIndex: number, kpIndex: number, value: string) => {
    setSections((prev) =>
      prev.map((s, i) =>
        i === sectionIndex
          ? {
              ...s,
              knowledgePoints: s.knowledgePoints.map((kp, j) => (j === kpIndex ? value : kp)),
            }
          : s,
      ),
    );
  }, []);

  const removeKP = useCallback((sectionIndex: number, kpIndex: number) => {
    setSections((prev) =>
      prev.map((s, i) =>
        i === sectionIndex
          ? { ...s, knowledgePoints: s.knowledgePoints.filter((_, j) => j !== kpIndex) }
          : s,
      ),
    );
  }, []);

  const handleSave = useCallback(async () => {
    // Filter out empty sections and KPs
    const cleaned = sections
      .filter((s) => s.title.trim())
      .map((s) => ({
        ...s,
        title: s.title.trim(),
        briefDescription: s.briefDescription.trim(),
        knowledgePoints: s.knowledgePoints.filter((kp) => kp.trim()),
      }));

    setSaving(true);
    try {
      const result = await updateDocumentOutline(documentId, { sections: cleaned });
      if (result.success) {
        showNotification({
          message: t.toast.changesSaved,
          color: 'green',
          icon: <Check size={16} />,
        });
        onSaved?.();
        onClose();
      } else {
        showNotification({ title: t.common.error, message: result.error, color: 'red' });
      }
    } finally {
      setSaving(false);
    }
  }, [sections, documentId, t, onSaved, onClose]);

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Text fw={600} size="sm">
          {t.knowledge.outline} — {documentName}
        </Text>
      }
      size="lg"
      styles={{ body: { maxHeight: '70vh', overflow: 'auto' } }}
    >
      <Stack gap="md">
        {sections.map((section, si) => (
          <Box
            key={si}
            p="sm"
            style={{
              border: '1px solid var(--mantine-color-gray-3)',
              borderRadius: 8,
            }}
          >
            <Group justify="space-between" mb="xs">
              <Text size="xs" fw={600} c="dimmed">
                Section {si + 1}
              </Text>
              <ActionIcon size="xs" variant="subtle" color="red" onClick={() => removeSection(si)}>
                <Trash2 size={12} />
              </ActionIcon>
            </Group>

            <TextInput
              label="Title"
              size="xs"
              mb="xs"
              value={section.title}
              onChange={(e) => updateSection(si, 'title', e.currentTarget.value)}
            />

            <Textarea
              label="Brief Description"
              size="xs"
              mb="xs"
              autosize
              minRows={1}
              maxRows={3}
              value={section.briefDescription}
              onChange={(e) => updateSection(si, 'briefDescription', e.currentTarget.value)}
            />

            <Text size="xs" fw={500} mb={4}>
              Knowledge Points
            </Text>
            <Stack gap={4}>
              {section.knowledgePoints.map((kp, ki) => (
                <Group key={ki} gap={4} wrap="nowrap">
                  <TextInput
                    size="xs"
                    style={{ flex: 1 }}
                    value={kp}
                    onChange={(e) => updateKP(si, ki, e.currentTarget.value)}
                  />
                  <ActionIcon
                    size="xs"
                    variant="subtle"
                    color="red"
                    onClick={() => removeKP(si, ki)}
                  >
                    <Trash2 size={10} />
                  </ActionIcon>
                </Group>
              ))}
              <Button
                size="compact-xs"
                variant="subtle"
                leftSection={<Plus size={10} />}
                onClick={() => addKP(si)}
                style={{ alignSelf: 'flex-start' }}
              >
                Add KP
              </Button>
            </Stack>
          </Box>
        ))}

        <Divider />

        <Group justify="space-between">
          <Button size="xs" variant="light" leftSection={<Plus size={14} />} onClick={addSection}>
            Add Section
          </Button>
          <Group gap="xs">
            <Button size="xs" variant="default" onClick={onClose}>
              {t.common.cancel}
            </Button>
            <Button size="xs" onClick={handleSave} loading={saving}>
              {t.common.save}
            </Button>
          </Group>
        </Group>
      </Stack>
    </Modal>
  );
}

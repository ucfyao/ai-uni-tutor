'use client';

import { ArrowLeft, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Badge, Box, Button, Group, Modal, Stack, Text, Tooltip } from '@mantine/core';

interface DocumentDetailHeaderProps {
  title: string;
  metadata: { school?: string; course?: string };
  status: 'draft' | 'ready';
  itemCount: number;
  docType: 'lecture' | 'exam' | 'assignment';
  onPublish: () => void;
  onUnpublish: () => void;
  onDelete: () => void;
  isPublishing?: boolean;
}

export function DocumentDetailHeader({
  title,
  metadata,
  status,
  itemCount,
  onPublish,
  onUnpublish,
  onDelete,
  isPublishing,
}: DocumentDetailHeaderProps) {
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  const hasMetadata = metadata.school || metadata.course;

  const publishButton =
    status === 'draft' ? (
      itemCount === 0 ? (
        <Tooltip label="Upload and parse a PDF first">
          <Button variant="filled" disabled>
            Publish
          </Button>
        </Tooltip>
      ) : (
        <Button variant="filled" loading={isPublishing} onClick={onPublish}>
          Publish
        </Button>
      )
    ) : (
      <Button variant="light" onClick={onUnpublish}>
        Unpublish
      </Button>
    );

  return (
    <>
      {/* Row 1: Back link */}
      <Box mb="sm">
        <Text
          component={Link}
          href="/admin/knowledge"
          c="dimmed"
          fz="sm"
          fw={500}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, textDecoration: 'none' }}
        >
          <ArrowLeft size={16} />
          Back to Knowledge
        </Text>
      </Box>

      {/* Row 2: Title + Status badge + Actions */}
      <Group justify="space-between" align="center" mb={hasMetadata ? 'xs' : 'md'}>
        <Group gap="sm" align="center">
          <Text fz="xl" fw={700}>
            {title}
          </Text>
          {status === 'ready' ? (
            <Badge color="green" variant="dot" size="sm">
              Ready
            </Badge>
          ) : (
            <Badge color="blue" variant="dot" size="sm">
              Draft
            </Badge>
          )}
        </Group>

        <Group gap="xs">
          {publishButton}
          <Button color="red" variant="light" onClick={() => setDeleteModalOpen(true)}>
            <Trash2 size={16} />
          </Button>
        </Group>
      </Group>

      {/* Row 3: Metadata chips */}
      {hasMetadata && (
        <Group gap="xs" mb="md">
          {metadata.school && (
            <Badge variant="light" color="gray" size="sm">
              {metadata.school}
            </Badge>
          )}
          {metadata.course && (
            <Badge variant="light" color="gray" size="sm">
              {metadata.course}
            </Badge>
          )}
        </Group>
      )}

      {/* Delete confirmation modal */}
      <Modal
        opened={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        title="Delete Document"
        centered
        size="sm"
        radius="lg"
      >
        <Stack align="center" gap="md">
          <Box
            style={{
              width: 48,
              height: 48,
              borderRadius: '50%',
              background: 'var(--mantine-color-red-0)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Trash2 size={22} color="var(--mantine-color-red-5)" />
          </Box>
          <Text fz="sm" ta="center">
            Are you sure you want to delete this document? This action cannot be undone.
          </Text>
        </Stack>
        <Group justify="flex-end" mt="lg" gap="sm">
          <Button variant="default" onClick={() => setDeleteModalOpen(false)} radius="md">
            Cancel
          </Button>
          <Button
            color="red"
            onClick={() => {
              setDeleteModalOpen(false);
              onDelete();
            }}
            radius="md"
          >
            Delete
          </Button>
        </Group>
      </Modal>
    </>
  );
}

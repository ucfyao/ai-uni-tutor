'use client';

import { Table, Group, Text, Badge, ActionIcon, Tooltip } from '@mantine/core';
import { FileText, CheckCircle, Clock, AlertCircle, Trash2 } from 'lucide-react';
import { deleteDocument } from '@/app/actions/documents';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { notifications } from '@mantine/notifications';

interface Document {
  id: string;
  name: string;
  status: string; // 'processing' | 'ready' | 'error'
  status_message: string | null;
  created_at: string;
  metadata: {
    school?: string;
    course?: string;
    [key: string]: any;
  } | null;
}

interface KnowledgeTableProps {
  documents: Document[];
}

export function KnowledgeTable({ documents: initialDocuments }: KnowledgeTableProps) {
  const router = useRouter();
  const [documents, setDocuments] = useState<Document[]>(initialDocuments);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const supabase = createClient();

  // Sync initialDocuments prop with local state when it changes (e.g. after refresh)
  useEffect(() => {
    setDocuments(initialDocuments);
  }, [initialDocuments]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('realtime-documents')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'documents'
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newDoc = payload.new as Document;
            setDocuments((prev) => [newDoc, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            const updatedDoc = payload.new as Document;
            setDocuments((prev) => 
                prev.map((doc) => doc.id === updatedDoc.id ? updatedDoc : doc)
            );
          } else if (payload.eventType === 'DELETE') {
             setDocuments((prev) => prev.filter((doc) => doc.id !== payload.old.id)); 
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this document?')) return;
    
    // Optimistic Update
    setDeletingId(id);
    const previousDocs = [...documents];
    setDocuments((prev) => prev.filter((doc) => doc.id !== id));

    try {
        await deleteDocument(id);
        notifications.show({
            title: 'Deleted',
            message: 'Document deleted successfully',
            color: 'green',
        });
        // We don't need to refresh here if we trust the optimistic update + realtime
        // But revalidatePath on server is good for next hard nav.
        // Also realtime DELETE event will confirm it.
    } catch (e) {
        // Revert on error
        setDocuments(previousDocs);
        notifications.show({
            title: 'Error',
            message: 'Failed to delete document',
            color: 'red',
        });
    } finally {
        setDeletingId(null);
    }
  };

  return (
    <Table verticalSpacing="xs">
      <Table.Thead>
        <Table.Tr>
          <Table.Th>Name</Table.Th>
          <Table.Th>University</Table.Th>
          <Table.Th>Course</Table.Th>
          <Table.Th>Date</Table.Th>
          <Table.Th>Status</Table.Th>
          <Table.Th style={{ width: 50 }}></Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {documents.map((doc) => (
          <Table.Tr key={doc.id}>
            <Table.Td>
              <Group gap="xs">
                <FileText size={16} className="text-gray-500" />
                <Text size="sm" fw={500}>{doc.name}</Text>
              </Group>
            </Table.Td>
            <Table.Td>
               <Text size="sm">{doc.metadata?.school || '-'}</Text>
            </Table.Td>
            <Table.Td>
               <Badge variant="dot" color="gray" size="sm">{doc.metadata?.course || 'General'}</Badge>
            </Table.Td>
            <Table.Td>
              <Text size="sm" c="dimmed" suppressHydrationWarning>{new Date(doc.created_at).toLocaleDateString()}</Text>
            </Table.Td>
            <Table.Td>
              {doc.status === 'ready' && <Badge color="green" variant="light" leftSection={<CheckCircle size={12}/>}>Ready</Badge>}
              {doc.status === 'processing' && <Badge color="blue" variant="light" leftSection={<Clock size={12}/>}>Processing</Badge>}
              {doc.status === 'error' && (
                <Group gap={4}>
                  <Badge color="red" variant="light" leftSection={<AlertCircle size={12}/>}>Error</Badge>
                  {doc.status_message && (
                    <Tooltip label={doc.status_message}>
                         <AlertCircle size={14} className="text-red-500 cursor-help"/>
                    </Tooltip>
                  )}
                </Group>
              )}
            </Table.Td>
            <Table.Td>
                <ActionIcon 
                    variant="subtle" 
                    color="red" 
                    onClick={() => handleDelete(doc.id)}
                    loading={deletingId === doc.id}
                >
                    <Trash2 size={16} />
                </ActionIcon>
            </Table.Td>
          </Table.Tr>
        ))}
        {documents.length === 0 && (
            <Table.Tr>
                <Table.Td colSpan={6} align="center">
                    <Text c="dimmed" size="sm" py="xl">No documents uploaded yet</Text>
                </Table.Td>
            </Table.Tr>
        )}
      </Table.Tbody>
    </Table>
  );
}

import { Skeleton } from '@mantine/core';
import { AdminContent } from '@/components/admin/AdminContent';

export default function Loading() {
  return (
    <AdminContent gap="md">
      <Skeleton height={20} width={120} />
      <Skeleton height={32} width="60%" />
      <Skeleton height={200} />
      <Skeleton height={40} />
    </AdminContent>
  );
}

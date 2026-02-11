import { getAdminDocuments, getAdminExamPapers } from '@/app/actions/admin-content';
import { AdminContentClient } from './AdminContentClient';

export default async function AdminContentPage() {
  const [documents, examPapers] = await Promise.all([getAdminDocuments(), getAdminExamPapers()]);

  return <AdminContentClient documents={documents} examPapers={examPapers} />;
}

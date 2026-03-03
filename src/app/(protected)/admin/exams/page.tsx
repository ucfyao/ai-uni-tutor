import { getExamPaperList } from '@/app/actions/exam-papers';
import { AdminExamClient } from './AdminExamClient';

export default async function AdminExamPage() {
  const result = await getExamPaperList();
  const papers = result.success ? result.data : [];
  return <AdminExamClient papers={papers} />;
}

import { getExamPaperList } from '@/app/actions/exam-papers';
import { AdminExamClient } from './AdminExamClient';

export default async function AdminExamPage() {
  const papers = await getExamPaperList();
  return <AdminExamClient papers={papers} />;
}

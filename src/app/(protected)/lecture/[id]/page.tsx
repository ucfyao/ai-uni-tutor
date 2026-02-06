import LectureClient from './LectureClient.tsx';

export default async function LecturePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <LectureClient id={id} />;
}

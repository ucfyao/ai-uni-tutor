import LectureClient from './LectureClient';

export default async function LecturePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <LectureClient key={id} id={id} />;
}

import { redirect } from 'next/navigation';

export async function GET(_request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  redirect(`/login?ref=${encodeURIComponent(code)}`);
}

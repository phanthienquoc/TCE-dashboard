import { redirect } from 'next/navigation';

export default async function EngineSettingsPage({ params }: { params: Promise<{ engineid: string }> }) {
  const { engineid } = await params;
  redirect(`/settings/engine/${engineid}`);
}

import ContributionManager from './ContributionManager';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ContributionManager eventId={id} />;
}

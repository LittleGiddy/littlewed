import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import NotificationsPage from '@/components/NotificationsPage';

export default async function AdminNotificationsPage() {
  const session = await getServerSession(authOptions);
  if (!session || session.user?.role !== 'SUPER_ADMIN') redirect('/login');
  return <NotificationsPage />;
}

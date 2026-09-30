import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ConferenceDashboard } from '@/components/room/conference-dashboard';

export default async function Page() {
  const cookieStore = await cookies();
  const userContact = cookieStore.get('user_contact')?.value;
  const backendKey = cookieStore.get('_connect_ec_backend_key')?.value;

  // If user is not logged in, redirect to login
  if (!userContact && !backendKey) {
    redirect('/login');
  }

  // Render the ConnectEC Meet Conference Dashboard
  return <ConferenceDashboard />;
}

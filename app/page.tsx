import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export default async function Page() {
  const cookieStore = await cookies();
  const userContact = cookieStore.get('user_contact')?.value;

  // If already logged in, route to default meeting room; otherwise show initial login
  if (userContact) {
    redirect('/room/interview-meeting');
  } else {
    redirect('/login');
  }
}

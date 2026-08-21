import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { Sidebar } from '@/components/Sidebar';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Second auth layer behind proxy.ts: data-bearing pages must not depend on a
  // single middleware matcher staying correct.
  const session = await auth();
  if (!session?.user) redirect('/login');
  return (
    <div className="app">
      <Sidebar />
      <main className="main">{children}</main>
    </div>
  );
}

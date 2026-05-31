import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { DashboardSidebar } from '@/components/dashboard/sidebar'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('display_name, avatar_url, active_role')
    .eq('id', user.id)
    .single()

  const activeRole = profile?.active_role ?? 'collector'
  const displayName = profile?.display_name ?? user.email ?? 'You'
  const avatarUrl = profile?.avatar_url ?? null
  const email = user.email ?? ''

  return (
    <div className="flex min-h-screen">
      <DashboardSidebar
        activeRole={activeRole}
        displayName={displayName}
        avatarUrl={avatarUrl}
        email={email}
      />
      <main className="flex-1 min-w-0 p-6">{children}</main>
    </div>
  )
}

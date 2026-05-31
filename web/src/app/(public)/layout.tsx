import { Navbar } from '@/components/layout/navbar'
import { Footer } from '@/components/layout/footer'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let navUser: { id: string; email?: string; avatarUrl?: string; displayName?: string } | null = null

  if (user) {
    const admin = createAdminClient()
    const { data: profile } = await admin
      .from('profiles')
      .select('display_name, avatar_url')
      .eq('id', user.id)
      .single()

    navUser = {
      id: user.id,
      email: user.email,
      displayName: profile?.display_name ?? user.email ?? 'You',
      avatarUrl: profile?.avatar_url ?? undefined,
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar user={navUser} />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  )
}

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('active_role')
    .eq('id', user.id)
    .single()

  if (profile?.active_role !== 'admin') redirect('/dashboard')

  return (
    <div className="min-h-screen p-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex items-center gap-3">
          <Link
            href="/"
            className="text-sm text-white/40 hover:text-white/80 transition-colors flex items-center gap-1"
          >
            ← Site
          </Link>
          <span className="text-white/20">·</span>
          <h1 className="text-xl font-bold">Admin</h1>
          <span className="text-xs bg-red-500/20 text-red-300 px-2 py-0.5 rounded-full">
            Restricted
          </span>
        </div>
        {children}
      </div>
    </div>
  )
}

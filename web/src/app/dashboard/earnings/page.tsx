import { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { EarningsOverview } from '@/components/dashboard/earnings-overview'

export const metadata: Metadata = { title: 'Earnings — Dashboard' }

export default async function EarningsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // TODO: Load real order data from Supabase
  // const { data: orders } = await supabase
  //   .from('orders')
  //   .select('*')
  //   .eq('artworks.artist_id', user!.id)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Earnings</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Revenue from print sales and digital ordinal transfers.
        </p>
      </div>

      <EarningsOverview
        totalCad={0}
        totalMnee={0}
        pendingOrders={0}
        fulfilledOrders={0}
      />

      <div className="glass rounded-xl p-6">
        <h2 className="font-semibold mb-4">Revenue Split</h2>
        <div className="space-y-2 text-sm">
          {[
            { role: 'Artist', percent: '70%', desc: 'Paid via MNEE to your BSV wallet' },
            { role: 'Curator', percent: '10%', desc: 'Paid via MNEE to curator wallet' },
            { role: 'Platform', percent: '20%', desc: 'ASMRtists.ca operations' },
          ].map((row) => (
            <div key={row.role} className="flex items-center justify-between py-2 border-b border-white/5">
              <div>
                <span className="font-medium">{row.role}</span>
                <span className="text-muted-foreground text-xs ml-2">{row.desc}</span>
              </div>
              <span className="rainbow-text font-bold">{row.percent}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

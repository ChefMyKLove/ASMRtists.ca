import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency } from '@/lib/utils'
import { TrendingUp, DollarSign, Package, Bitcoin } from 'lucide-react'

interface EarningsOverviewProps {
  totalCad: number
  totalMnee: number
  pendingOrders: number
  fulfilledOrders: number
}

export function EarningsOverview({
  totalCad,
  totalMnee,
  pendingOrders,
  fulfilledOrders,
}: EarningsOverviewProps) {
  const stats = [
    {
      label: 'Total Earnings (CAD)',
      value: formatCurrency(totalCad),
      icon: DollarSign,
      subtext: 'Fiat via Stripe Connect',
    },
    {
      label: 'MNEE Earned',
      value: `${totalMnee.toLocaleString()} MNEE`,
      icon: Bitcoin,
      subtext: 'BSV stablecoin',
    },
    {
      label: 'Pending Orders',
      value: pendingOrders.toString(),
      icon: Package,
      subtext: 'Awaiting fulfilment',
    },
    {
      label: 'Fulfilled Orders',
      value: fulfilledOrders.toString(),
      icon: TrendingUp,
      subtext: 'All time',
    },
  ]

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat) => {
        const Icon = stat.icon
        return (
          <Card key={stat.label} className="glass">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between text-xs font-medium text-muted-foreground">
                {stat.label}
                <Icon className="h-3.5 w-3.5" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold rainbow-text">{stat.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{stat.subtext}</p>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

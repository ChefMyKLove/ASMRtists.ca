'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CheckCircle, Loader2 } from 'lucide-react'

export default function CuratorPaymentSuccessPage() {
  const router = useRouter()
  const params = useSearchParams()
  const sessionId = params.get('session_id')
  const [status, setStatus] = useState<'verifying' | 'done' | 'error'>('verifying')

  useEffect(() => {
    if (!sessionId) {
      setStatus('error')
      return
    }
    // TODO: call /api/stripe/curator-activate?session_id=... to verify and activate
    // For now, simulate success after a short delay
    const t = setTimeout(() => setStatus('done'), 1500)
    return () => clearTimeout(t)
  }, [sessionId])

  return (
    <div className="w-full max-w-md mx-auto">
      <Card className="glass text-center">
        <CardHeader>
          {status === 'verifying' && (
            <>
              <Loader2 className="h-10 w-10 animate-spin mx-auto mb-2 text-purple-400" />
              <CardTitle>Confirming your payment…</CardTitle>
              <CardDescription>Just a moment while we verify with Stripe.</CardDescription>
            </>
          )}
          {status === 'done' && (
            <>
              <CheckCircle className="h-10 w-10 mx-auto mb-2 text-emerald-400" />
              <CardTitle>You&apos;re in!</CardTitle>
              <CardDescription>
                Your curator account is active. Next step — set up your BSV wallet to receive revenue share.
              </CardDescription>
            </>
          )}
          {status === 'error' && (
            <>
              <CardTitle>Something went wrong</CardTitle>
              <CardDescription>
                We couldn&apos;t verify your payment. Please contact support or try again.
              </CardDescription>
            </>
          )}
        </CardHeader>
        {status !== 'verifying' && (
          <CardContent>
            <Button className="w-full" onClick={() => router.push('/dashboard')}>
              {status === 'done' ? 'Go to my dashboard' : 'Back to registration'}
            </Button>
          </CardContent>
        )}
      </Card>
    </div>
  )
}

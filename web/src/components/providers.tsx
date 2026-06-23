'use client'

import { WalletProvider } from '@1sat/react'
import type { ReactNode } from 'react'

export function Providers({ children }: { children: ReactNode }) {
  return <WalletProvider>{children}</WalletProvider>
}

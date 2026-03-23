import { createFileRoute } from '@tanstack/react-router'
import { lazy, Suspense } from 'react'
import { Header } from '~/components/layout/header'
import { Footer } from '~/components/layout/footer'
import { Badge } from '~/components/ui/badge'

// Lazy-load wallet components to keep them client-only (SSR-safe)
const WalletApp = lazy(() => import('~/components/app/wallet-app'))

export const Route = createFileRoute('/app')({
  component: AppPage,
  head: () => ({
    meta: [{ title: 'App — Algorand x EVM' }],
  }),
})

function AppPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Wallet Dashboard</h1>
            <p className="text-sm text-muted-foreground">
              Manage your Algorand x EVM account
            </p>
          </div>
          <Badge variant="outline">MainNet</Badge>
        </div>

        <Suspense fallback={
          <div className="flex justify-center py-12">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-muted border-t-primary" />
          </div>
        }>
          <WalletApp />
        </Suspense>
      </main>
      <Footer />
    </div>
  )
}

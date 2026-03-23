import { WalletProviders } from './wallet-providers'
import { WalletDashboard } from './wallet-dashboard'
import { WalletButton } from '@txnlab/use-wallet-ui-react'

function WalletAppContent() {
  return (
    <>
      <div data-wallet-theme data-wallet-ui className="flex justify-center mb-8">
        <WalletButton size="lg" />
      </div>
      <WalletDashboard />
    </>
  )
}

export default function WalletApp() {
  return (
    <WalletProviders>
      <WalletAppContent />
    </WalletProviders>
  )
}

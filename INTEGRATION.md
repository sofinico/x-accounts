# Early Adopter Integration Guide

In case you want to experiment with liquid-evm-accounts in your frontend:

## 1. Install packages

Use npm aliases to install the experimental `@d13co` builds under the `@txnlab` package names. This way your imports stay as `@txnlab/use-wallet-react` — no find-and-replace needed.

**Required (RainbowKit for EVM wallet connection):**

```bash
# pnpm
pnpm add @txnlab/use-wallet@npm:@d13co/use-wallet@latest \
         @txnlab/use-wallet-react@npm:@d13co/use-wallet-react@latest \
         @txnlab/use-wallet-ui-react@npm:@d13co/use-wallet-ui-react@latest \
         liquid-accounts-evm@latest \
         @rainbow-me/rainbowkit wagmi @wagmi/core viem @tanstack/react-query

# npm
npm install @txnlab/use-wallet@npm:@d13co/use-wallet@latest \
            @txnlab/use-wallet-react@npm:@d13co/use-wallet-react@latest \
            @txnlab/use-wallet-ui-react@npm:@d13co/use-wallet-ui-react@latest \
            liquid-accounts-evm@latest \
            @rainbow-me/rainbowkit wagmi @wagmi/core viem @tanstack/react-query

# yarn
yarn add @txnlab/use-wallet@npm:@d13co/use-wallet@latest \
         @txnlab/use-wallet-react@npm:@d13co/use-wallet-react@latest \
         @txnlab/use-wallet-ui-react@npm:@d13co/use-wallet-ui-react@latest \
         liquid-accounts-evm@latest \
         @rainbow-me/rainbowkit wagmi @wagmi/core viem @tanstack/react-query
```

**Recommended (Allbridge cross-chain bridge support):**

```bash
pnpm add @allbridge/bridge-core-sdk buffer
# npm install @allbridge/bridge-core-sdk buffer
# yarn add @allbridge/bridge-core-sdk buffer
```

Note: This uses use-wallet v4. Migration should be straightforward/painless if you are on v2 or v3:

- https://txnlab.gitbook.io/use-wallet/v3/guides/migrating-from-v2.x
- https://txnlab.gitbook.io/use-wallet/guides/migrating-from-v3.x

## 2. Vite config

Add the `buffer` polyfill alias and deduplication entries:

```ts
// vite.config.ts
export default defineConfig({
  plugins: [react()],
  define: {
    global: 'globalThis',
  },
  resolve: {
    alias: {
      buffer: 'buffer',
    },
    dedupe: [
      'react',
      'react-dom',
      '@tanstack/react-query',
      '@txnlab/use-wallet-react',
      'algosdk',
      'wagmi',
      '@wagmi/core',
      'viem',
      '@rainbow-me/rainbowkit',
    ],
  },
  optimizeDeps: {
    include: ['buffer'],
  },
})
```

## 3. Usage

1. Add global polyfills for the bridge SDK (at the top of your entry file)
2. Create a wagmi config with `algorandChain` from `liquid-accounts-evm`
3. Add `WalletId.RAINBOWKIT` to your `WalletManager`, passing `wagmiConfig`
4. Pass `wagmiConfig` to `WalletUIProvider` — it auto-wires `WagmiProvider`, `RainbowKitProvider`, and the bridge component internally
5. Place `<WalletButton />` as your connect/account button

```tsx
// At the top of your entry file (e.g. main.tsx)
// Required by the Allbridge bridge SDK
import { Buffer } from 'buffer'
;(globalThis as any).Buffer = Buffer
if (!(globalThis as any).TronWebProto) {
  ;(globalThis as any).TronWebProto = { Transaction: {} }
}

// ...other imports...
import { WalletProvider, WalletManager, WalletId, NetworkId } from '@txnlab/use-wallet-react'
import { WalletUIProvider, WalletButton } from '@txnlab/use-wallet-ui-react'
import { getDefaultConfig } from '@rainbow-me/rainbowkit'
import { algorandChain } from 'liquid-accounts-evm'
// styling for use-wallet-ui and rainbowkit
import '@txnlab/use-wallet-ui-react/dist/style.css'
import '@rainbow-me/rainbowkit/styles.css'

// Create wagmi config with the Algorand EVM chain
const wagmiConfig = getDefaultConfig({
  appName: 'My Liquid EVM Accounts App',
  projectId: 'YOUR_WALLETCONNECT_PROJECT_ID', // from cloud.walletconnect.com
  chains: [algorandChain],
})

const walletManager = new WalletManager({
  wallets: [
    {
      id: WalletId.RAINBOWKIT,
      options: { wagmiConfig },
    },
    WalletId.PERA,
    WalletId.DEFLY,
    WalletId.EXODUS,
    // WalletId.LUTE, WalletId.KMD, etc.
  ],
  defaultNetwork: NetworkId.MAINNET,
})

function Root() {
  return (
    <WalletProvider manager={walletManager}>
      {/* Pass wagmiConfig — WalletUIProvider sets up WagmiProvider,
          RainbowKitProvider, and the bridge component automatically */}
      <WalletUIProvider theme="system" wagmiConfig={wagmiConfig}>
        {/* your app */}
          {/* somewhere in header */}
            <WalletButton />
      </WalletUIProvider>
    </WalletProvider>
  )
}
```

`WalletUIProvider` must be nested inside `WalletProvider`. It handles:

- Transaction review dialogs (before signing)
- Wallet Management UI (send ALGO, asset optins)
- RainbowKit/Wagmi provider setup (when `wagmiConfig` is passed)
- Theme injection (`'light'` | `'dark'` | `'system'`)
- Optional `queryClient` prop if you already have a `@tanstack/react-query` provider

### Network switching

If your app supports multiple networks, call `walletManager.setActiveNetwork(network)` when the user switches. This updates internal state and reinitializes connections:

```tsx
function setNetwork(network: 'localnet' | 'testnet' | 'mainnet') {
  localStorage.setItem('algorand-network', network)
  walletManager.setActiveNetwork(network)
}
```

## 4. Manage Liquid EVM Account

After connecting your EVM account, you can manage it via:

`{WalletButton}` → ⚡ Manage

To opt in to ASAs, use the `Receive` view.

## 5. Allbridge (cross-chain bridge)

The bridge UI is built into `WalletUIProvider`. No additional setup is required beyond installing `@allbridge/bridge-core-sdk`.

The `buffer` package and `TronWebProto` stub in your entry file are required by Allbridge's bundled TronWeb dependency.

Access it from `{WalletButton}` → ⚡ Manage → # Bridge

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
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
      '@txnlab/use-wallet-react',
      'algosdk',
      '@algorandfoundation/algokit-utils',
      'liquid-accounts-evm',
    ],
  },
  optimizeDeps: {
    include: ['buffer'],
  },
})

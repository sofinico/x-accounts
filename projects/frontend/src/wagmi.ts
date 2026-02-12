import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { mainnet, sepolia } from 'wagmi/chains';

export const config = getDefaultConfig({
  appName: 'Liquid EVM',
  projectId: 'YOUR_WALLETCONNECT_PROJECT_ID',
  chains: [mainnet, sepolia],
});

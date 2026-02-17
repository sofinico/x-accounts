import { Buffer } from "buffer";
globalThis.Buffer = Buffer;

import { StrictMode, useCallback, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { WalletProvider } from "@txnlab/use-wallet-react";
import { WalletUIProvider, useBeforeSignDialog, useAfterSignDialog, useWelcomeDialog } from "@txnlab/use-wallet-ui-react";
import "@txnlab/use-wallet-ui-react/dist/style.css";
import { WalletManager, WalletId, useWallet } from "@txnlab/use-wallet-react";
import "./index.css";
import App from "./App.tsx";

const beforeSignRef: { current: ((...args: any[]) => Promise<void>) | null } = { current: null };
const afterSignRef: { current: (() => void) | null } = { current: null };
const onConnectRef: { current: ((account: { evmAddress: string; algorandAddress: string }) => void) | null } = { current: null };

const walletManager = new WalletManager({
  wallets: [
    {
      id: WalletId.METAMASK,
      options: {
        uiHooks: {
          onConnect: (account) => {
            onConnectRef.current?.(account);
          },
          onBeforeSign: async (...args) => {
            if (beforeSignRef.current) {
              await beforeSignRef.current(...args);
            }
          },
          onAfterSign: () => {
            afterSignRef.current?.();
          },
        },
      },
    },
    // WalletId.RAINBOW,
    WalletId.LUTE,
    WalletId.KMD,
  ],
  defaultNetwork: "localnet",
});

function SignHooksBridge() {
  const { onBeforeSign } = useBeforeSignDialog();
  const { onAfterSign } = useAfterSignDialog();
  const { showWelcome } = useWelcomeDialog();
  const { algodClient } = useWallet();

  const onConnect = useCallback(
    (account: { evmAddress: string; algorandAddress: string }) => {
      if (!algodClient) return;
      algodClient
        .accountInformation(account.algorandAddress)
        .do()
        .then((info) => {
          if (Number(info.amount) === 0) {
            showWelcome(account);
          }
        })
        .catch(() => {
          // Account not found on-chain — treat as zero balance
          showWelcome(account);
        });
    },
    [algodClient, showWelcome],
  );

  useEffect(() => {
    beforeSignRef.current = onBeforeSign;
    afterSignRef.current = onAfterSign;
    onConnectRef.current = onConnect;
    return () => {
      beforeSignRef.current = null;
      afterSignRef.current = null;
      onConnectRef.current = null;
    };
  }, [onBeforeSign, onAfterSign, onConnect]);
  return null;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <WalletProvider manager={walletManager}>
      <WalletUIProvider>
        <SignHooksBridge />
        <App />
      </WalletUIProvider>
    </WalletProvider>
  </StrictMode>,
);

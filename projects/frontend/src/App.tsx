import { useRef, useState } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useSignMessage } from "wagmi";
import { useQuery } from "@tanstack/react-query";
import { AlgorandClient } from "@algorandfoundation/algokit-utils";
import { LiquidEvmSdk } from "liquid-evm-sdk";
import algosdk from "algosdk";
import "./App.css";
import base32 from "hi-base32"

const algorand = AlgorandClient.defaultLocalNet();
algorand.setDefaultValidityWindow(1000);
const sdk = new LiquidEvmSdk({ algorand });

function bytesToBase32(bytes: Uint8Array): string {
  return base32.encode(bytes).replace(/=+$/, ""); // Remove padding
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

type PayloadInfo = { bytes: Uint8Array; type: "Group ID" | "Txn ID" };

type SendState =
  | { status: "idle" }
  | { status: "signing"; payload: PayloadInfo }
  | { status: "success"; txId: string; payload: PayloadInfo }
  | { status: "error"; message: string; payload: PayloadInfo };

function PayloadDisplay({ payload }: { payload: PayloadInfo }) {
  return (
    <div className="card">
      <p>Signing payload ({payload.type}):</p>
      <p>
        Base32: <code>{bytesToBase32(payload.bytes)}</code>
      </p>
      <p>
        Base64: <code>{btoa(String.fromCharCode(...payload.bytes))}</code>
      </p>
      <p>
        Hex: <code>{bytesToHex(payload.bytes)}</code>
      </p>
    </div>
  );
}

function Algorand() {
  const { address } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const [sendState, setSendState] = useState<SendState>({ status: "idle" });
  const payloadRef = useRef<PayloadInfo | undefined>(undefined);

  const {
    data: algoAddress,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["algorandAddress", address],
    queryFn: () => sdk.getAddress({ evmAddress: address! }),
    enabled: !!address,
  });

  const captureAndSign = (msg: Uint8Array, type: PayloadInfo["type"]) => {
    const payload: PayloadInfo = { bytes: msg, type };
    payloadRef.current = payload;
    setSendState({ status: "signing", payload });
    return signMessageAsync({ message: { raw: msg } });
  };

  const send = async (numTxns: number, forceGroup = false) => {
    try {
      payloadRef.current = undefined;
      setSendState({ status: "idle" });

      if (numTxns === 1 && !forceGroup) {
        // Standalone: getSigner signs the txn ID
        const { addr, signer } = await sdk.getSigner({
          evmAddress: address!,
          signMessage: (msg) => captureAndSign(msg, "Txn ID"),
        });
        const result = await algorand.send.payment({
          sender: addr,
          receiver: addr,
          amount: (0).algos(),
          note: crypto.getRandomValues(new Uint8Array(4)),
          signer,
        });
        setSendState({ status: "success", txId: result.txIds[0], payload: payloadRef.current! });
      } else if (numTxns === 1 && forceGroup) {
        // Single txn forced into a group: use signTxn with manual assignGroupID
        const addr = await sdk.getAddress({ evmAddress: address! });
        const txn = await algorand.createTransaction.payment({
          sender: addr,
          receiver: addr,
          amount: (0).algos(),
          note: crypto.getRandomValues(new Uint8Array(4)),
        });
        const [gtxn] = algosdk.assignGroupID([txn]);
        const [signed] = await sdk.signTxn({
          evmAddress: address!,
          txns: [gtxn],
          signMessage: (msg) => captureAndSign(msg, "Group ID"),
        });
        await algorand.client.algod.sendRawTransaction(signed).do();
        setSendState({ status: "success", txId: gtxn.txID(), payload: payloadRef.current! });
      } else {
        // Multiple txns: getSigner signs the group ID
        const { addr, signer } = await sdk.getSigner({
          evmAddress: address!,
          signMessage: (msg) => captureAndSign(msg, "Group ID"),
        });
        const group = algorand.newGroup();
        for (let i = 0; i < numTxns; i++) {
          group.addPayment({
            sender: addr,
            receiver: addr,
            amount: (0).algos(),
            note: crypto.getRandomValues(new Uint8Array(4)),
            signer,
          });
        }
        const result = await group.send();
        setSendState({ status: "success", txId: result.txIds[0], payload: payloadRef.current! });
      }
    } catch (e) {
      const payload = payloadRef.current ?? { bytes: new Uint8Array(), type: "Txn ID" as const };
      setSendState({ status: "error", message: (e as Error).message, payload });
    }
  };

  if (!address) return null;
  if (isLoading) return <p>Deriving Algorand address…</p>;
  if (error) return <p>Error: {(error as Error).message}</p>;

  return (
    <div>
      <div className="card">
        <p>Algorand address:</p>
        <a href={`https://l.algo.surf/${algoAddress}`} target="_blank" rel="noopener noreferrer">
          <code>{algoAddress}</code>
        </a>
      </div>
      <div className="card">
        <button onClick={() => send(1)} disabled={sendState.status === "signing"}>
          Send 1x
        </button>{" "}
        <button onClick={() => send(1, true)} disabled={sendState.status === "signing"}>
          Send 1x (grouped)
        </button>{" "}
        <button onClick={() => send(2)} disabled={sendState.status === "signing"}>
          Send 2x
        </button>
      </div>
      {sendState.status !== "idle" && <PayloadDisplay payload={sendState.payload} />}
      {sendState.status === "signing" && (
        <div className="card">
          <p>Waiting for wallet approval…</p>
        </div>
      )}
      {sendState.status === "success" && (
        <div className="card">
          <p>
            Success:{" "}
            <a
              href={`https://l.algo.surf/${sendState.txId}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              {sendState.txId}
            </a>
          </p>
        </div>
      )}
      {sendState.status === "error" && (
        <div className="card">
          <p>Error: {sendState.message}</p>
        </div>
      )}
    </div>
  );
}

function App() {
  return (
    <>
      <h1>Liquid EVM</h1>
      <ConnectButton />
      <Algorand />
    </>
  );
}

export default App;

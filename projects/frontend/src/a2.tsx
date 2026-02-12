import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useSignMessage } from "wagmi";
import { useQuery } from "@tanstack/react-query";
import { AlgorandClient } from "@algorandfoundation/algokit-utils";
import { LiquidEvmSdk } from "liquid-evm-sdk";
import "./App.css";

const algorand = AlgorandClient.defaultLocalNet();
const sdk = new LiquidEvmSdk({ algorand });

function Algorand() {
  const { address } = useAccount();
  const { signMessageAsync } = useSignMessage();

  const {
    data: algoAddress,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["algorandAddress", address],
    queryFn: () => sdk.getAddress({ evmAddress: address! }),
    enabled: !!address,
  });

  const send = async () => {
    const { addr, signer } = await sdk.getSigner({
      evmAddress: address!,
      signMessage: (msg) => signMessageAsync({ message: { raw: msg } }),
    });
    await algorand.send.payment({
      sender: addr,
      receiver: addr,
      amount: (0).algos(),
      signer,
    });
  }

  if (!address) return null;
  if (isLoading) return <p>Deriving Algorand address…</p>;
  if (error) return <p>Error: {(error as Error).message}</p>;

  return (<div>

      <div className="card">
        <p>Algorand address:</p>
        <code>{algoAddress}</code>
      </div>
    <div className="card">
      <button onClick={send}>SEND 0 ALGO</button>
    </div>
  </div>);
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

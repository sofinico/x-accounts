import type { AlgorandClient } from "@algorandfoundation/algokit-utils"
import algosdk from "algosdk"
import { ALGO_FUNDING_LSIG_TEAL } from "./teal"
import {
  ALGORAND_CHAIN_ID,
  ALGORAND_CHAIN_ID_HEX,
  ALGORAND_EVM_CHAIN_CONFIG,
  EIP712_DOMAIN,
  EIP712_TYPES,
  formatEIP712Message,
  hexToBytes,
  parseEvmSignature,
} from "./utils"
export {
  ALGORAND_CHAIN_ID,
  ALGORAND_CHAIN_ID_HEX,
  ALGORAND_EVM_CHAIN_CONFIG,
  EIP712_DOMAIN,
  EIP712_TYPES,
  formatEIP712Message,
  hexToBytes,
  parseEvmSignature,
} from "./utils"

export class LiquidEvmSdk {
  private algorand: AlgorandClient
  private compiledCache = new Map<string, Uint8Array>()

  constructor({ algorand }: { algorand: AlgorandClient }) {
    this.algorand = algorand
  }

  private static normalizeAddress(evmAddress: string): string {
    return evmAddress.startsWith("0x") ? evmAddress.slice(2).toLowerCase() : evmAddress.toLowerCase()
  }

  private async getCompiled(evmAddress: string): Promise<Uint8Array> {
    const normalized = LiquidEvmSdk.normalizeAddress(evmAddress)
    if (!this.compiledCache.has(normalized)) {
      const result = await this.algorand.app.compileTealTemplate(ALGO_FUNDING_LSIG_TEAL, {
        TMPL_OWNER: hexToBytes(normalized),
      })
      this.compiledCache.set(normalized, result.compiledBase64ToBytes)
    }
    return this.compiledCache.get(normalized)!
  }

  /** Get Algorand address for a given EVM address (hex, with or without 0x prefix) */
  async getAddress({ evmAddress }: { evmAddress: string }): Promise<string> {
    const compiled = await this.getCompiled(evmAddress)
    const lsig = new algosdk.LogicSigAccount(compiled, [])
    return lsig.address().toString()
  }

  /** Get the payload for the EVM wallet to sign. Group ID if group.length > 1, otherwise Txn ID */
  static getSignPayload(txnGroup: algosdk.Transaction[]): Uint8Array {
    // For grouped txns of more than 1, sign the group ID; for standalone sign the txn ID
    return txnGroup.length > 1 ? txnGroup[0].group! : txnGroup[0].rawTxID()
  }

  /**
   * Sign one or more algosdk Transactions with the EVM lsig using EIP-712 typed data.
   *
   * The payload signed by the EVM wallet is:
   * - The group ID if `txns[0].group` is set
   * - The transaction ID otherwise (only valid when `txns` has exactly one element)
   *
   * @param evmAddress - hex EVM address (with or without 0x prefix)
   * @param txns - algosdk Transaction(s) to sign (must already have group ID assigned if grouped)
   * @param signMessage - callback that receives the raw transaction/group ID payload and should
   *   return an EIP-712 signature. The callback should format the payload as EIP-712 typed data
   *   and call `eth_signTypedData_v4`. Use `formatEIP712Message(payload)` helper to format.
   * @returns array of signed transaction blobs (Uint8Array[])
   *
   * @example
   * ```typescript
   * import { formatEIP712Message, EIP712_DOMAIN, EIP712_TYPES } from "liquid-accounts-evm"
   *
   * const signMessage = async (payload: Uint8Array) => {
   *   const message = formatEIP712Message(payload)
   *   return wallet.signTypedData(EIP712_DOMAIN, EIP712_TYPES, message)
   * }
   *
   * const signed = await sdk.signTxn({ evmAddress, txns, signMessage })
   * ```
   */
  async signTxn(params: {
    evmAddress: string
    txns: algosdk.Transaction[]
    signMessage: (message: Uint8Array) => Promise<string>
  }): Promise<Uint8Array[]>

  /**
   * Sign one or more algosdk Transactions with the EVM lsig using a pre-computed signature.
   *
   * Use this variant when you already have the EIP-712 signature for the transaction/group ID.
   *
   * @param evmAddress - hex EVM address (with or without 0x prefix)
   * @param txns - algosdk Transaction(s) to sign (must already have group ID assigned if grouped)
   * @param signature - pre-computed EIP-712 signature (0x-prefixed 65-byte hex string)
   * @returns array of signed transaction blobs (Uint8Array[])
   *
   * @example
   * ```typescript
   * const payload = LiquidEvmSdk.getSignPayload(txns)
   * const message = formatEIP712Message(payload)
   * const signature = await wallet.signTypedData(EIP712_DOMAIN, EIP712_TYPES, message)
   *
   * const signed = await sdk.signTxn({ evmAddress, txns, signature })
   * ```
   */
  async signTxn(params: {
    evmAddress: string
    txns: algosdk.Transaction[]
    signature: string
  }): Promise<Uint8Array[]>

  async signTxn({
    evmAddress,
    txns,
    signMessage,
    signature,
  }: {
    evmAddress: string
    txns: algosdk.Transaction[]
    signMessage?: (message: Uint8Array) => Promise<string>
    signature?: string
  }): Promise<Uint8Array[]> {
    const compiled = await this.getCompiled(evmAddress)

    let evmSig: string
    if (signature) {
      evmSig = signature
    } else if (signMessage) {
      const payload = LiquidEvmSdk.getSignPayload(txns)
      evmSig = await signMessage(payload)
    } else {
      throw new Error("Either signMessage or signature must be provided")
    }

    const sigBytes = parseEvmSignature(evmSig)
    const lsig = new algosdk.LogicSigAccount(compiled, [sigBytes])

    return txns.map((txn) => algosdk.signLogicSigTransactionObject(txn, lsig).blob)
  }

  /**
   * Get an algokit-utils compatible TransactionSigner for the given EVM address using EIP-712 typed data signing.
   *
   * @param evmAddress - hex EVM address (with or without 0x prefix)
   * @param signMessage - callback that receives the raw transaction/group ID payload and should
   *   return an EIP-712 signature. The callback should format the payload as EIP-712 typed data
   *   and call `eth_signTypedData_v4`. Use `formatEIP712Message(payload)` helper to format.
   * @returns `{ addr, signer }` — pass directly as `sender` + `signer` to algokit-utils methods
   *
   * @example
   * ```typescript
   * import { formatEIP712Message, EIP712_DOMAIN, EIP712_TYPES } from "liquid-accounts-evm"
   *
   * const signMessage = async (payload: Uint8Array) => {
   *   const message = formatEIP712Message(payload)
   *   return wallet.signTypedData(EIP712_DOMAIN, EIP712_TYPES, message)
   * }
   *
   * const { addr, signer } = await sdk.getSigner({ evmAddress, signMessage })
   * ```
   */
  async getSigner({
    evmAddress,
    signMessage,
  }: {
    evmAddress: string
    signMessage: (message: Uint8Array) => Promise<string>
  }): Promise<{ addr: string; signer: algosdk.TransactionSigner }> {
    const compiled = await this.getCompiled(evmAddress)
    const lsig = new algosdk.LogicSigAccount(compiled, [])
    const addr = lsig.address().toString()

    const signer: algosdk.TransactionSigner = async (txnGroup, indexesToSign) => {
      // Get the payload (group ID for grouped txns, txn ID for standalone)
      const payload = LiquidEvmSdk.getSignPayload(txnGroup)

      const evmSig = await signMessage(payload)
      const sigBytes = parseEvmSignature(evmSig)
      const signedLsig = new algosdk.LogicSigAccount(compiled, [sigBytes])

      return indexesToSign.map((i) => algosdk.signLogicSigTransactionObject(txnGroup[i], signedLsig).blob)
    }

    return { addr, signer }
  }
}

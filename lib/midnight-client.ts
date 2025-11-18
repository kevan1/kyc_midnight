import type { LaceWalletSession } from "@/lib/lace-wallet"

type CircuitCacheEntry = {
  proverKey: any
  verifierKey: any
  zkir: any
}

const DEFAULT_INDEXER_HTTP = process.env.NEXT_PUBLIC_MIDNIGHT_INDEXER_HTTP ?? "https://indexer.testnet-02.midnight.network/api/v1/graphql"
const DEFAULT_INDEXER_WS = process.env.NEXT_PUBLIC_MIDNIGHT_INDEXER_WS ?? "wss://indexer.testnet-02.midnight.network/api/v1/graphql/ws"

function normalizeContractAddress(rawValue: string | undefined | null): string {
  if (!rawValue) {
    return ""
  }

  let value = rawValue.trim()
  if (value.startsWith("0x") || value.startsWith("0X")) {
    value = value.slice(2)
  }

  if (!/^[0-9a-fA-F]+$/.test(value)) {
    console.warn(`[midnight] Contract address contains non-hex characters: ${rawValue}`)
    return value.toLowerCase()
  }

  if (value.length === 70 && value.toLowerCase().startsWith("000")) {
    value = value.slice(4)
  } else if (value.length === 68) {
    // already includes 2-byte network prefix
  } else if (value.length === 66) {
    value = value.padStart(68, "0")
  } else if (value.length > 68) {
    value = value.slice(value.length - 68)
  } else if (value.length < 68) {
    value = value.padStart(68, "0")
  }

  return value.toLowerCase()
}

const RAW_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_MIDNIGHT_CONTRACT_ADDRESS
const CONTRACT_ADDRESS = normalizeContractAddress(RAW_CONTRACT_ADDRESS)

if (!CONTRACT_ADDRESS) {
  console.warn("[midnight] NEXT_PUBLIC_MIDNIGHT_CONTRACT_ADDRESS is not defined. Contract calls will fail.")
} else {
  const lengthBytes = Math.floor(CONTRACT_ADDRESS.length / 2)
  console.info(`[midnight] Contract address set to ${CONTRACT_ADDRESS} (hex length=${CONTRACT_ADDRESS.length}, bytes=${lengthBytes})`)
  if (RAW_CONTRACT_ADDRESS && RAW_CONTRACT_ADDRESS.trim() !== CONTRACT_ADDRESS) {
    console.info("[midnight] Normalized contract address", CONTRACT_ADDRESS)
  }
}

let contractsModulePromise: Promise<typeof import("@midnight-ntwrk/midnight-js-contracts")> | null = null
let indexerModulePromise: Promise<typeof import("@midnight-ntwrk/midnight-js-indexer-public-data-provider")> | null = null
let utilsModulePromise: Promise<typeof import("@midnight-ntwrk/midnight-js-utils")> | null = null
let typesModulePromise: Promise<typeof import("@midnight-ntwrk/midnight-js-types")> | null = null
let networkModulePromise: Promise<typeof import("@midnight-ntwrk/midnight-js-network-id")> | null = null
let ledgerModulePromise: Promise<typeof import("@midnight-ntwrk/ledger")> | null = null
let proofProviderPromise: Promise<ReturnType<(typeof import("@midnight-ntwrk/midnight-js-http-client-proof-provider"))["httpClientProofProvider"]>> | null = null
let runtimeModulePromise: Promise<typeof import("@midnight-ntwrk/compact-runtime")> | null = null

async function getContractsModule() {
  if (!contractsModulePromise) {
    contractsModulePromise = import("@midnight-ntwrk/midnight-js-contracts")
  }
  return contractsModulePromise
}

async function getIndexerModule() {
  if (!indexerModulePromise) {
    indexerModulePromise = import("@midnight-ntwrk/midnight-js-indexer-public-data-provider")
  }
  return indexerModulePromise
}

async function getUtilsModule() {
  if (!utilsModulePromise) {
    utilsModulePromise = import("@midnight-ntwrk/midnight-js-utils")
  }
  return utilsModulePromise
}

async function getTypesModule() {
  if (!typesModulePromise) {
    typesModulePromise = import("@midnight-ntwrk/midnight-js-types")
  }
  return typesModulePromise
}

let networkConfigured = false
async function ensureNetworkConfigured() {
  if (!networkModulePromise) {
    networkModulePromise = import("@midnight-ntwrk/midnight-js-network-id")
  }
  const module = await networkModulePromise
  if (!networkConfigured) {
    const rawNetworkId = process.env.NEXT_PUBLIC_MIDNIGHT_NETWORK_ID ?? "TestNet"
    const resolved = module.stringToNetworkId(rawNetworkId) ?? module.NetworkId.TestNet
    module.setNetworkId(resolved)
    networkConfigured = true
  }
  return module
}

async function getLedgerModule() {
  if (!ledgerModulePromise) {
    ledgerModulePromise = import("@midnight-ntwrk/ledger")
  }
  return ledgerModulePromise
}

async function getProofProvider() {
  if (!proofProviderPromise) {
    const module = await import("@midnight-ntwrk/midnight-js-http-client-proof-provider")
    const defaultProofServer = process.env.NEXT_PUBLIC_MIDNIGHT_PROOF_SERVER ?? "https://lace-dev.proof-pub.stg.midnight.tools"
    proofProviderPromise = Promise.resolve(module.httpClientProofProvider(defaultProofServer))
  }
  return proofProviderPromise
}

async function getRuntimeModule() {
  if (!runtimeModulePromise) {
    runtimeModulePromise = import("@midnight-ntwrk/compact-runtime")
  }
  return runtimeModulePromise
}

const CIRCUIT_CACHE = new Map<string, CircuitCacheEntry>()
let contractModulePromise: Promise<any> | null = null
let publicDataProviderInstance: any = null

function base64ToUint8Array(value: string): Uint8Array {
  if (typeof window === "undefined") {
    return Buffer.from(value, "base64")
  }
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

async function fetchCircuitArtifacts(circuitId: string) {
  if (CIRCUIT_CACHE.has(circuitId)) {
    return CIRCUIT_CACHE.get(circuitId)!
  }

  const response = await fetch(`/api/midnight/zk-config?circuit=${encodeURIComponent(circuitId)}`)
  if (!response.ok) {
    throw new Error(`Unable to load zk config for circuit ${circuitId}`)
  }

  const typesModule = await getTypesModule()
  const payload = await response.json()
  const cached: CircuitCacheEntry = {
    proverKey: typesModule.createProverKey(base64ToUint8Array(payload.prover)),
    verifierKey: typesModule.createVerifierKey(base64ToUint8Array(payload.verifier)),
    zkir: typesModule.createZKIR(base64ToUint8Array(payload.zkir)),
  }
  CIRCUIT_CACHE.set(circuitId, cached)
  return cached
}

async function loadContractModule() {
  if (!contractModulePromise) {
    contractModulePromise = import("@/contracts/kyc_credentials/contracts/managed/kyc-credentials/contract/index.cjs")
  }
  return contractModulePromise
}

async function getPublicDataProvider() {
  await ensureNetworkConfigured()
  if (!publicDataProviderInstance) {
    const indexerModule = await getIndexerModule()
    const baseProvider = indexerModule.indexerPublicDataProvider(DEFAULT_INDEXER_HTTP, DEFAULT_INDEXER_WS)
    const { ZswapChainState } = await getLedgerModule()
    publicDataProviderInstance = {
      ...baseProvider,
      async queryZSwapAndContractState(address: string, config?: unknown) {
        try {
          const result = await (baseProvider as any).queryZSwapAndContractState(address, config)
          return result
        } catch (error) {
          if (error instanceof Error && error.message.includes("Unexpected length of input")) {
            console.warn("[midnight] falling back to empty zswap state", error)
            const contractState = await (baseProvider as any).queryContractState(address, config)
            return [new ZswapChainState(), contractState]
          }
          throw error
        }
      },
    } as any
  }
  return publicDataProviderInstance!
}

async function createCallData(session: LaceWalletSession, circuitId: string, args: (string | Uint8Array)[]) {
  if (!CONTRACT_ADDRESS) {
    throw new Error("Contract address not configured")
  }

  const contractModule = await loadContractModule()
  const contract: any = new contractModule.Contract({})
  const publicDataProvider = await getPublicDataProvider()
  const utilsModule = await getUtilsModule()
  const networkModule = await ensureNetworkConfigured()

  const coinPublicKeyHex = utilsModule.parseCoinPublicKeyToHex(session.coinPublicKey, networkModule.getZswapNetworkId())
  const encryptionPublicKeyHex = utilsModule.parseEncPublicKeyToHex(session.encryptionPublicKey, networkModule.getZswapNetworkId())

  console.debug("[midnight] wallet keys", {
    coinPublicKey: coinPublicKeyHex,
    coinBytes: coinPublicKeyHex.length / 2,
    encryptionPublicKey: encryptionPublicKeyHex,
    encBytes: encryptionPublicKeyHex.length / 2,
  })

  const callOptions = {
    contract,
    contractAddress: CONTRACT_ADDRESS,
    circuitId,
    args,
  } as any

  console.debug("[midnight] call options", {
    circuitId,
    args,
    contractAddress: CONTRACT_ADDRESS,
  })

  const providers = {
    publicDataProvider,
    walletProvider: {
      coinPublicKey: coinPublicKeyHex,
      encryptionPublicKey: encryptionPublicKeyHex,
      async balanceTx() {
        throw new Error("balanceTx not implemented in walletProvider stub")
      },
    },
  } as any

  const contractsModule = await getContractsModule()
  let callTx
  try {
    callTx = await contractsModule.createUnprovenCallTx(providers, callOptions)
  } catch (error) {
    if (error instanceof Error && error.message.includes("Unexpected length of input")) {
      console.warn("[midnight] falling back to initial contract state", error)
      const ledgerModule = await getLedgerModule()
      const runtimeModule = await getRuntimeModule()
      const initialContractState = contract.initialState({
        initialZswapLocalState: runtimeModule.emptyZswapLocalState(coinPublicKeyHex),
      })
      const fallbackOptions = {
        ...callOptions,
        coinPublicKey: coinPublicKeyHex,
        initialContractState,
        initialZswapChainState: new ledgerModule.ZswapChainState(),
      }
      callTx = contractsModule.createUnprovenCallTxFromInitialStates(
        fallbackOptions,
        coinPublicKeyHex,
        encryptionPublicKeyHex,
      )
    } else {
      throw error
    }
  }

  return { contract, callTx, publicDataProvider }
}

export async function fetchKycLedgerSnapshot() {
  if (!CONTRACT_ADDRESS) {
    throw new Error("Contract address not configured")
  }

  const publicDataProvider = await getPublicDataProvider()
  const contractModule = await loadContractModule()
  const state = await publicDataProvider.queryContractState(CONTRACT_ADDRESS)

  if (!state) {
    return null
  }

  console.debug("[midnight] queryContractState result", state)

  return contractModule.ledger(state.data)
}

export interface CallResult {
  txId: string
  finalized: any
  public: any
}

export async function executeMidnightCall(session: LaceWalletSession, circuitId: string, args: string[]): Promise<CallResult> {
  const { callTx, publicDataProvider } = await createCallData(session, circuitId, args)
  const artifacts = await fetchCircuitArtifacts(circuitId)
  const proofProvider = await getProofProvider()

  const unbalancedTx = await proofProvider.proveTx(callTx.private.unprovenTx, {
    zkConfig: {
      circuitId,
      proverKey: artifacts.proverKey,
      verifierKey: artifacts.verifierKey,
      zkir: artifacts.zkir,
    },
  })

  const recipe = await session.api.balanceTransaction(unbalancedTx, callTx.private.newCoins ?? [])
  const provedTx = await session.api.proveTransaction(recipe)
  const txIdentifier = await session.api.submitTransaction(provedTx)
  const finalized = await publicDataProvider.watchForTxData(txIdentifier)

  // Debug logging: inspect transaction identifier and finalized indexer data
  console.debug("[midnight] Transaction submitted", {
    txIdentifier,
    finalizedSummary: {
      status: (finalized as any)?.status,
      blockHeight: (finalized as any)?.blockHeight ?? (finalized as any)?.blockNo ?? (finalized as any)?.height,
      hash:
        (finalized as any)?.txHash ??
        (finalized as any)?.l1TxHash ??
        (finalized as any)?.transactionHash ??
        (finalized as any)?.hash,
    },
    finalizedRaw: finalized,
  })

  if (finalized.status !== "SucceedEntirely") {
    throw new Error(`Transaction failed: ${JSON.stringify(finalized)}`)
  }

  return {
    txId: txIdentifier,
    finalized,
    public: callTx.public,
  }
}

export function getContractAddress() {
  return CONTRACT_ADDRESS
}
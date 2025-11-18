"use client"

import { create } from "zustand"
import type { Credential, User, Issuer, VerificationAction } from "./types"
import { connectLaceWallet, type LaceWalletSession } from "@/lib/lace-wallet"
import { createDefaultKycStatus, hydrateLedgerForWallet } from "@/lib/ledger"

async function loadMidnightClient() {
  return import("@/lib/midnight-client")
}

function mergeCredentialCollections(existing: Credential[], ledgerCredentials: Credential[]): Credential[] {
  if (ledgerCredentials.length === 0) {
    return existing
  }

  // Load stored txHashes and blockNumbers from localStorage
  const storedTxHashes = loadAllTxHashes()
  const storedBlockNumbers = loadAllBlockNumbers()

  const existingByHash = new Map<string, Credential>()
  for (const credential of existing) {
    if (credential.credentialHash) {
      existingByHash.set(credential.credentialHash, credential)
    }
  }

  const merged: Credential[] = []

  for (const ledgerCredential of ledgerCredentials) {
    const existingCredential = ledgerCredential.credentialHash
      ? existingByHash.get(ledgerCredential.credentialHash)
      : undefined

    // Try to get txHash from: 1) existing credential, 2) localStorage, 3) ledger credential
    let txHash = ""
    if (existingCredential?.txHash && existingCredential.txHash.trim() !== "") {
      txHash = existingCredential.txHash
    } else if (ledgerCredential.credentialHash && storedTxHashes[ledgerCredential.credentialHash]) {
      txHash = storedTxHashes[ledgerCredential.credentialHash]
    } else if (ledgerCredential.txHash && ledgerCredential.txHash.trim() !== "") {
      txHash = ledgerCredential.txHash
    }

    // Try to get blockNumber from: 1) existing credential, 2) localStorage, 3) ledger credential
    let blockNumber: number | string | undefined = undefined
    if (existingCredential?.blockNumber !== undefined) {
      blockNumber = existingCredential.blockNumber
    } else if (ledgerCredential.credentialHash && storedBlockNumbers[ledgerCredential.credentialHash] !== undefined) {
      blockNumber = storedBlockNumbers[ledgerCredential.credentialHash]
    } else if (ledgerCredential.blockNumber !== undefined) {
      blockNumber = ledgerCredential.blockNumber
    }

    if (existingCredential) {
      existingByHash.delete(ledgerCredential.credentialHash!)
      merged.push({
        ...existingCredential,
        ...ledgerCredential,
        txHash, // Use the resolved txHash
        blockNumber, // Use the resolved blockNumber
        issueTime: existingCredential.issueTime ?? ledgerCredential.issueTime,
        expiryTime: existingCredential.expiryTime ?? ledgerCredential.expiryTime,
        metadata: {
          ...ledgerCredential.metadata,
          ...existingCredential.metadata,
        },
        chainData: existingCredential.chainData ?? ledgerCredential.chainData,
        zkProofSummary: existingCredential.zkProofSummary ?? ledgerCredential.zkProofSummary,
        proofReference: ledgerCredential.proofReference ?? existingCredential.proofReference,
      })
    } else {
      merged.push({
        ...ledgerCredential,
        txHash, // Use the resolved txHash
        blockNumber, // Use the resolved blockNumber
      })
    }
  }

  for (const leftover of existingByHash.values()) {
    merged.push(leftover)
  }

  return merged
}

interface KYCStore {
  user: User
  credentials: Credential[]
  issuers: Issuer[]
  actions: VerificationAction[]
  shouldAutoConnect: boolean
  walletSession: LaceWalletSession | null
  ledgerSnapshot: any | null

  // User actions
  connectWallet: () => Promise<void>
  disconnectWallet: () => void
  initializeWallet: () => Promise<void>
  refreshLedgerSnapshot: () => Promise<void>

  // Credential actions
  addCredential: (credential: Credential) => void
  updateCredential: (id: string, updates: Partial<Credential>) => void
  revokeCredential: (id: string, reason: string) => void

  // Action history
  addAction: (action: VerificationAction) => void
}

// Mock data
const mockIssuers: Issuer[] = [
  { id: "1", name: "KYC Platform", address: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb" },
  { id: "2", name: "Identity Verifier", address: "0x8ba1f109551bD432803012645Ac136ddd64DBA72" },
  { id: "3", name: "Age Verification Service", address: "0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed" },
]

const AUTO_CONNECT_KEY = "kyc-auto-connect"
const CREDENTIAL_TXHASH_STORAGE_KEY = "kyc-credential-txhashes"
const CREDENTIAL_BLOCKNUMBER_STORAGE_KEY = "kyc-credential-blocknumbers"

// Store transaction hashes in localStorage for persistence
function storeTxHash(credentialHash: string, txHash: string): void {
  if (typeof window === "undefined") return
  try {
    const stored = window.localStorage.getItem(CREDENTIAL_TXHASH_STORAGE_KEY)
    const txHashes: Record<string, string> = stored ? JSON.parse(stored) : {}
    txHashes[credentialHash] = txHash
    window.localStorage.setItem(CREDENTIAL_TXHASH_STORAGE_KEY, JSON.stringify(txHashes))
  } catch (error) {
    console.warn("[store] Failed to store txHash", error)
  }
}

// Retrieve transaction hash from localStorage
function getTxHash(credentialHash: string): string | null {
  if (typeof window === "undefined") return null
  try {
    const stored = window.localStorage.getItem(CREDENTIAL_TXHASH_STORAGE_KEY)
    if (!stored) return null
    const txHashes: Record<string, string> = JSON.parse(stored)
    return txHashes[credentialHash] ?? null
  } catch (error) {
    console.warn("[store] Failed to retrieve txHash", error)
    return null
  }
}

// Load all stored txHashes
function loadAllTxHashes(): Record<string, string> {
  if (typeof window === "undefined") return {}
  try {
    const stored = window.localStorage.getItem(CREDENTIAL_TXHASH_STORAGE_KEY)
    return stored ? JSON.parse(stored) : {}
  } catch (error) {
    console.warn("[store] Failed to load txHashes", error)
    return {}
  }
}

// Store block numbers in localStorage for persistence
function storeBlockNumber(credentialHash: string, blockNumber: number | string): void {
  if (typeof window === "undefined") return
  try {
    const stored = window.localStorage.getItem(CREDENTIAL_BLOCKNUMBER_STORAGE_KEY)
    const blockNumbers: Record<string, number | string> = stored ? JSON.parse(stored) : {}
    blockNumbers[credentialHash] = blockNumber
    window.localStorage.setItem(CREDENTIAL_BLOCKNUMBER_STORAGE_KEY, JSON.stringify(blockNumbers))
  } catch (error) {
    console.warn("[store] Failed to store blockNumber", error)
  }
}

// Retrieve block number from localStorage
function getBlockNumber(credentialHash: string): number | string | null {
  if (typeof window === "undefined") return null
  try {
    const stored = window.localStorage.getItem(CREDENTIAL_BLOCKNUMBER_STORAGE_KEY)
    if (!stored) return null
    const blockNumbers: Record<string, number | string> = JSON.parse(stored)
    return blockNumbers[credentialHash] ?? null
  } catch (error) {
    console.warn("[store] Failed to retrieve blockNumber", error)
    return null
  }
}

// Load all stored blockNumbers
function loadAllBlockNumbers(): Record<string, number | string> {
  if (typeof window === "undefined") return {}
  try {
    const stored = window.localStorage.getItem(CREDENTIAL_BLOCKNUMBER_STORAGE_KEY)
    return stored ? JSON.parse(stored) : {}
  } catch (error) {
    console.warn("[store] Failed to load blockNumbers", error)
    return {}
  }
}

export const useKYCStore = create<KYCStore>((set) => ({
  user: {
    walletAddress: null,
    network: "polygon",
    kyc: {
      identity: "None",
      human: "None",
      age: "None",
    },
  },
  credentials: [],
  issuers: mockIssuers,
  actions: [],
  shouldAutoConnect: true,
  walletSession: null,
  ledgerSnapshot: null,

  connectWallet: async () => {
    console.debug("[kyc-store] connectWallet invoked")
    const session = await connectLaceWallet()
    const { fetchKycLedgerSnapshot } = await loadMidnightClient()

    const snapshot = await fetchKycLedgerSnapshot().catch((error) => {
      console.error("[kyc-store] Failed to fetch ledger snapshot", error)
      return null
    })

    const hydrated = await hydrateLedgerForWallet(snapshot, session.address)

    set((state) => ({
      user: {
        ...state.user,
        walletAddress: session.address,
        kyc: hydrated.kycStatus,
      },
      credentials: mergeCredentialCollections(state.credentials, hydrated.credentials),
      shouldAutoConnect: true,
      walletSession: session,
      ledgerSnapshot: snapshot,
    }))

    if (typeof window !== "undefined") {
      window.localStorage.setItem(AUTO_CONNECT_KEY, "true")
    }
  },

  initializeWallet: async () => {
    if (typeof window !== "undefined") {
      const stored = window.localStorage.getItem(AUTO_CONNECT_KEY)
      if (stored === "false") {
        set({ shouldAutoConnect: false })
        return
      }
    }

    if (!useKYCStore.getState().shouldAutoConnect) {
      return
    }

    try {
      const session = await connectLaceWallet({ autoConnect: true })
      const { fetchKycLedgerSnapshot } = await loadMidnightClient()

      const snapshot = await fetchKycLedgerSnapshot().catch((error) => {
        console.error("[kyc-store] Failed to fetch ledger snapshot", error)
        return null
      })

      const hydrated = await hydrateLedgerForWallet(snapshot, session.address)

      set((state) => ({
        user: {
          ...state.user,
          walletAddress: session.address,
          kyc: hydrated.kycStatus,
        },
        credentials: mergeCredentialCollections(state.credentials, hydrated.credentials),
        shouldAutoConnect: true,
        walletSession: session,
        ledgerSnapshot: snapshot,
      }))

      if (typeof window !== "undefined") {
        window.localStorage.setItem(AUTO_CONNECT_KEY, "true")
      }
    } catch (error) {
      console.debug("[kyc-store] Auto-connect skipped", error)
    }
  },

  refreshLedgerSnapshot: async () => {
    try {
      const { fetchKycLedgerSnapshot } = await loadMidnightClient()
      const snapshot = await fetchKycLedgerSnapshot()
      const walletAddress = useKYCStore.getState().user.walletAddress
      const hydrated = await hydrateLedgerForWallet(snapshot, walletAddress)

      set((state) => ({
        ledgerSnapshot: snapshot,
        credentials: walletAddress
          ? mergeCredentialCollections(state.credentials, hydrated.credentials)
          : state.credentials,
        user: walletAddress
          ? {
              ...state.user,
              kyc: hydrated.kycStatus,
            }
          : state.user,
      }))
    } catch (error) {
      console.error("[kyc-store] Failed to fetch ledger snapshot", error)
    }
  },

  disconnectWallet: () => {
    set({
      user: {
        walletAddress: null,
        network: "polygon",
        kyc: {
          identity: "None",
          human: "None",
          age: "None",
        },
      },
      credentials: [],
      shouldAutoConnect: false,
      walletSession: null,
      ledgerSnapshot: null,
    })

    if (typeof window !== "undefined") {
      window.localStorage.setItem(AUTO_CONNECT_KEY, "false")
    }
  },

  addCredential: (credential: Credential) =>
    set((state) => {
      // Store txHash in localStorage for persistence
      if (credential.txHash && credential.txHash.trim() !== "" && credential.credentialHash) {
        storeTxHash(credential.credentialHash, credential.txHash)
      }

      // Store blockNumber in localStorage for persistence
      if (credential.blockNumber !== undefined && credential.credentialHash) {
        storeBlockNumber(credential.credentialHash, credential.blockNumber)
      }

      const newCredentials = [...state.credentials, credential]
      const kycUpdate = { ...state.user.kyc }

      if (credential.type === "Identity") kycUpdate.identity = credential.status
      if (credential.type === "Human") kycUpdate.human = credential.status
      if (credential.type === "Age") kycUpdate.age = credential.status

      return {
        credentials: newCredentials,
        user: {
          ...state.user,
          kyc: kycUpdate,
        },
      }
    }),

  updateCredential: (id: string, updates: Partial<Credential>) =>
    set((state) => {
      const updated = state.credentials.map((c) => {
        if (c.id === id) {
          const updatedCredential = { ...c, ...updates }
          // Store txHash in localStorage if it was updated
          if (updates.txHash && updates.txHash.trim() !== "" && updatedCredential.credentialHash) {
            storeTxHash(updatedCredential.credentialHash, updates.txHash)
          }
          // Store blockNumber in localStorage if it was updated
          if (updates.blockNumber !== undefined && updatedCredential.credentialHash) {
            storeBlockNumber(updatedCredential.credentialHash, updatedCredential.blockNumber!)
          }
          return updatedCredential
        }
        return c
      })
      return { credentials: updated }
    }),

  revokeCredential: (id: string, reason: string) =>
    set((state) => ({
      credentials: state.credentials.map((c) =>
        c.id === id ? { ...c, status: "Revoked" as const, revocationReason: reason } : c,
      ),
    })),

  addAction: (action: VerificationAction) =>
    set((state) => ({
      actions: [action, ...state.actions],
    })),
}))

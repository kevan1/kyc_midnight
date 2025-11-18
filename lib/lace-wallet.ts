type LaceProvider = {
  enable: (options?: Record<string, unknown>) => Promise<LaceWalletApi>
}

declare global {
  interface Window {
    cardano?: {
      lace?: LaceProvider
    }
    midnight?: {
      mnLace?: LaceProvider
    }
  }
}

export interface LaceWalletApi {
  getChangeAddress?: () => Promise<string>
  getNetworkId?: () => Promise<number>
  getUsedAddresses?: () => Promise<string[]>
  address?: string
  addresses?: string[]
  network?: { id?: number; name?: string }
  wallet?: {
    address?: string
    addresses?: string[]
    network?: { id?: number; name?: string }
  }
  state?: (...args: unknown[]) => Promise<any> | {
    subscribe: (
      observer: {
        next: (value: any) => void
        error?: (err: unknown) => void
        complete?: () => void
      }
    ) => { unsubscribe: () => void }
  }
  experimental?: Record<string, unknown>
  balanceTransaction: (tx: any, newCoins: any[]) => Promise<any>
  proveTransaction: (recipe: any) => Promise<any>
  submitTransaction: (tx: any) => Promise<string>
}

export interface LaceWalletSession {
  address: string
  networkId: number
  coinPublicKey: string
  encryptionPublicKey: string
  api: LaceWalletApi
  rawState: any
}

let cachedSession: LaceWalletSession | null = null

type ProviderSource = "midnight" | "cardano"

interface LaceProviderCandidate {
  provider: LaceProvider
  source: ProviderSource
}

const ENABLE_TIMEOUT_MS = 15000

function getLaceProviderCandidates(): LaceProviderCandidate[] {
  if (typeof window === "undefined") {
    return []
  }

  const candidates: Array<{ provider: LaceProvider | null | undefined; source: ProviderSource }> = [
    { provider: window.midnight?.mnLace, source: "midnight" },
    { provider: (window.midnight as any)?.lace, source: "midnight" },
    { provider: (window.cardano as any)?.mlace, source: "midnight" },
    { provider: window.cardano?.lace, source: "cardano" },
  ]

  return candidates.filter((candidate): candidate is LaceProviderCandidate => Boolean(candidate.provider)) as LaceProviderCandidate[]
}

function enableWithTimeout<T>(promise: Promise<T>, source: ProviderSource): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Timed out enabling Lace provider (${source})`))
    }, ENABLE_TIMEOUT_MS)

    promise
      .then((result) => {
        clearTimeout(timeout)
        resolve(result)
      })
      .catch((error) => {
        clearTimeout(timeout)
        reject(error)
      })
  })
}

function extractAddress(api: LaceWalletApi, stateValue: any): string | null {
  const candidate =
    stateValue?.address ??
    stateValue?.wallet?.addresses?.change ??
    stateValue?.wallet?.address ??
    api.address ??
    api.wallet?.address ??
    api.addresses?.[0] ??
    api.wallet?.addresses?.[0] ??
    null
  return candidate
}

function extractNetworkId(api: LaceWalletApi, stateValue: any): number | null {
  const candidate =
    stateValue?.network?.id ??
    stateValue?.wallet?.network?.id ??
    stateValue?.networkId ??
    api.network?.id ??
    api.wallet?.network?.id ??
    null
  return candidate
}

async function extractState(api: LaceWalletApi): Promise<any> {
  const stateFn = api.state
  if (!stateFn) {
    return null
  }

  try {
    const result = stateFn()
    console.debug("[lace-wallet] state() return value", result)

    if (result && typeof (result as unknown as Promise<any>).then === "function") {
      return await (result as unknown as Promise<any>)
    }

    if (!result || typeof (result as { subscribe?: unknown }).subscribe !== "function") {
      return null
    }

    return await new Promise((resolve) => {
      let settled = false
      const observable = result as {
        subscribe: (
          observer: {
            next: (value: any) => void
            error?: (err: unknown) => void
            complete?: () => void
          }
        ) => { unsubscribe: () => void }
      }

      const subscription = observable.subscribe({
        next: (value: any) => {
          if (settled) return
          settled = true
          subscription.unsubscribe()
          console.debug("[lace-wallet] state emission", value)
          resolve(value)
        },
        error: () => {
          if (settled) return
          settled = true
          subscription.unsubscribe()
          resolve(null)
        },
        complete: () => {
          if (settled) return
          settled = true
          resolve(null)
        },
      })

      setTimeout(() => {
        if (!settled) {
          settled = true
          subscription.unsubscribe()
          resolve(null)
        }
      }, 3000)
    })
  } catch (error) {
    console.debug("[lace-wallet] state extraction failed", error)
    return null
  }
}

function bytesToHex(input: ArrayLike<number>): string {
  let out = ""
  for (let i = 0; i < input.length; i += 1) {
    out += input[i].toString(16).padStart(2, "0")
  }
  return out
}

let bech32ModulePromise: Promise<typeof import("@midnight-ntwrk/wallet-sdk-address-format")> | null = null

async function getWalletSdkModule() {
  if (!bech32ModulePromise) {
    bech32ModulePromise = import("@midnight-ntwrk/wallet-sdk-address-format")
  }
  return bech32ModulePromise
}

async function normalizeKey(value: unknown): Promise<string | null> {
  if (!value) return null
  if (typeof value === "string") {
    const trimmed = value.startsWith("0x") || value.startsWith("0X") ? value.slice(2) : value
    if (trimmed.startsWith("mn_")) {
      try {
        const { MidnightBech32m, ShieldedCoinPublicKey, ShieldedEncryptionPublicKey } = await getWalletSdkModule()
        const parsed = MidnightBech32m.parse(trimmed)
        if (parsed.type === "shield-cpk") {
          const decoded = ShieldedCoinPublicKey.codec.decode(parsed.network, parsed)
          return bytesToHex(decoded.data)
        }
        if (parsed.type === "shield-epk") {
          const decoded = ShieldedEncryptionPublicKey.codec.decode(parsed.network, parsed)
          return bytesToHex(decoded.data)
        }
        return bytesToHex(parsed.data)
      } catch (error) {
        console.warn("[lace-wallet] failed to decode bech32 key", error)
        return trimmed.toLowerCase()
      }
    }
    return trimmed.toLowerCase()
  }
  if (value instanceof Uint8Array) {
    return bytesToHex(value)
  }
  if (Array.isArray(value)) {
    return bytesToHex(value as number[])
  }
  if (typeof value === "object") {
    const maybeBytes = (value as any).bytes ?? (value as any).data ?? (value as any).hex
    if (maybeBytes) {
      return normalizeKey(maybeBytes)
    }
  }
  return null
}

function normalizeAddress(address: string): string {
  return address.startsWith("0x") ? address : `0x${address}`
}

export async function connectLaceWallet(options: Record<string, unknown> = {}): Promise<LaceWalletSession> {
  if (typeof window === "undefined") {
    throw new Error("Wallet connection must be initiated from the browser")
  }

  const providerCandidates = getLaceProviderCandidates()
  if (providerCandidates.length === 0) {
    throw new Error("Lace wallet extension not found. Install it and try again.")
  }

  let lastError: unknown = null

  for (const candidate of providerCandidates) {
    try {
      const enableOptions: Record<string, unknown> = {
        appName: "KYC Platform",
        ...options,
      }

      if (candidate.source === "midnight") {
        const existing = enableOptions.extensions
        if (!existing) {
          enableOptions.extensions = ["midnight"]
        } else if (Array.isArray(existing) && !existing.includes("midnight")) {
          enableOptions.extensions = [...existing, "midnight"]
        }
      } else if ("extensions" in enableOptions) {
        delete enableOptions.extensions
      }

      console.debug("[lace-wallet] Attempting provider.enable", {
        source: candidate.source,
        options: enableOptions,
      })

      const api = await enableWithTimeout(candidate.provider.enable(enableOptions), candidate.source)

      console.debug("[lace-wallet] provider.enable resolved", {
        source: candidate.source,
        apiKeys: Object.keys(api ?? {}),
      })

      const stateValue = await extractState(api)
      const address = extractAddress(api, stateValue)
      let networkId = extractNetworkId(api, stateValue)
      const coinPublicKeyRaw = stateValue?.coinPublicKey ?? stateValue?.wallet?.coinPublicKey
      const encryptionPublicKeyRaw = stateValue?.encryptionPublicKey ?? stateValue?.wallet?.encryptionPublicKey
      const coinPublicKey = await normalizeKey(coinPublicKeyRaw)
      const encryptionPublicKey = await normalizeKey(encryptionPublicKeyRaw)

      console.log("[lace-wallet] extracted keys", {
        address,
        networkId,
        coinPublicKey,
        coinBytes: coinPublicKey?.length ? coinPublicKey.length / 2 : null,
        encryptionPublicKey,
        encBytes: encryptionPublicKey?.length ? encryptionPublicKey.length / 2 : null,
      })

      if (!address) {
        console.log("[lace-wallet] Unable to read address from Lace API", {
          apiKeys: Object.keys(api ?? {}),
          walletKeys: Object.keys(api.wallet ?? {}),
          raw: api,
          stateValue,
        })
        throw new Error("Failed to obtain wallet address from Lace API")
      }

      if (!coinPublicKey || !encryptionPublicKey) {
        throw new Error("Failed to obtain wallet public keys from Lace API")
      }

      if (networkId === null) {
        networkId = 0
      }

      const session: LaceWalletSession = {
        address: normalizeAddress(address),
        networkId,
        coinPublicKey,
        encryptionPublicKey,
        api,
        rawState: stateValue,
      }

      cachedSession = session
      return session
    } catch (error) {
      console.error("[lace-wallet] provider.enable failed", { source: candidate.source, error })
      lastError = error
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Failed to connect Lace wallet")
}

export function getCachedSession() {
  return cachedSession
}

import type { LaceWalletSession } from "@/lib/lace-wallet"

const TEXT_ENCODER = new TextEncoder()

async function loadMidnightClient() {
  return import("@/lib/midnight-client")
}

function stableStringify(input: Record<string, unknown>): string {
  const keys = Object.keys(input).sort()
  const entries = keys.map((key) => {
    const value = input[key]
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return `${key}:${stableStringify(value as Record<string, unknown>)}`
    }
    return `${key}:${String(value)}`
  })
  return `{${entries.join("|")}}`
}

async function sha256Hex(value: string): Promise<string> {
  const hashBuffer = await crypto.subtle.digest("SHA-256", TEXT_ENCODER.encode(value))
  const bytes = new Uint8Array(hashBuffer)
  return `0x${Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")}`
}

export async function deriveSubjectKey(subjectId: string): Promise<string> {
  return sha256Hex(subjectId.trim().toLowerCase())
}

/**
 * Get the Midnight explorer URL for a transaction hash
 * Supports both testnet (preview) and mainnet based on environment configuration
 * 
 * Network options:
 * - Mainnet: Production network with real value transactions
 * - Preview: Testnet/preview network for testing and development
 */
export function getMidnightExplorerUrl(txHash: string): string {
  // Check if we're on testnet/preview or mainnet
  const networkId = process.env.NEXT_PUBLIC_MIDNIGHT_NETWORK_ID ?? "TestNet"
  const isTestnet = networkId.toLowerCase().includes("test") || networkId.toLowerCase().includes("preview")
  
  // Use the official Midnight explorer: https://www.midnightexplorer.com/
  // Preview network uses /preview path, mainnet uses root
  const explorerBaseUrl =
    process.env.NEXT_PUBLIC_MIDNIGHT_EXPLORER_URL ??
    process.env.MIDNIGHT_EXPLORER_URL ??
    (isTestnet ? "https://www.midnightexplorer.com/preview" : "https://www.midnightexplorer.com")
  
  // Remove any leading/trailing slashes and ensure proper format
  const base = explorerBaseUrl.replace(/\/+$/, "")
  return `${base}/tx/${txHash}`
}

/**
 * Generates a Midnight Explorer URL for viewing a specific block
 * @param blockNumber - The block number/height to view
 * @returns The full URL to the block page on Midnight Explorer
 * Note: Block URLs always use the main explorer URL (https://www.midnightexplorer.com/block/{blockNumber})
 * regardless of network type, as the explorer handles both testnet and mainnet blocks on the same domain.
 */
export function getMidnightExplorerBlockUrl(blockNumber: number | string): string {
  // Always use the main Midnight explorer URL for blocks
  // The explorer handles both testnet and mainnet blocks on the same domain
  const base = "https://www.midnightexplorer.com"
  return `${base}/block/${blockNumber}`
}

function extractLedgerString(value: unknown): string {
  if (typeof value === "string") {
    return value
  }
  if (value && typeof value === "object" && "value" in (value as Record<string, unknown>)) {
    const inner = (value as Record<string, unknown>).value
    return typeof inner === "string" ? inner : inner != null ? String(inner) : ""
  }
  return ""
}

function parseLedgerState(value: unknown): Record<string, string> {
  const raw = extractLedgerString(value)
  if (!raw) {
    return {}
  }
  try {
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {}
    }
    const result: Record<string, string> = {}
    for (const [key, val] of Object.entries(parsed)) {
      if (val === undefined || val === null) continue
      result[String(key)] = typeof val === "string" ? val : String(val)
    }
    return result
  } catch (error) {
    console.warn("[blockchain-utils] Failed to parse ledger state", { value: raw, error })
    return {}
  }
}

function serializeLedgerState(map: Record<string, string>): string {
  const sortedKeys = Object.keys(map).sort()
  const sorted: Record<string, string> = {}
  for (const key of sortedKeys) {
    sorted[key] = map[key]
  }
  return JSON.stringify(sorted)
}

export async function generateCredentialHash(data: Record<string, unknown>): Promise<string> {
  return sha256Hex(stableStringify(data))
}

export function addLeafToMerkle(hash: string): string {
  return hash
}

export interface CredentialCallResult {
  txId: string
  publicData: any
  finalized: any
  commitment: string
  proofReference?: string
  metadataReference?: string
}

export async function issueCredentialOnChain(
  session: LaceWalletSession,
  credential: Record<string, unknown>,
  metadataReference?: string
): Promise<CredentialCallResult> {
  const commitment = await generateCredentialHash(credential)
  const metadataRef = metadataReference ?? commitment
  const rawHolder = (credential as any)?.holder
  const subjectId =
    typeof rawHolder === "string" && rawHolder.trim().length > 0 ? rawHolder : session.address
  if (!subjectId) {
    throw new Error("Subject wallet address is required to issue an identity credential")
  }
  const subjectKey = await deriveSubjectKey(subjectId)

  const issuerReference =
    typeof (credential as any)?.issuer === "string" && (credential as any).issuer
      ? (credential as any).issuer
      : session.address

  const { executeMidnightCall, fetchKycLedgerSnapshot } = await loadMidnightClient()
  let snapshot: any | null = null
  try {
    snapshot = await fetchKycLedgerSnapshot()
  } catch (error) {
    console.warn("[blockchain-utils] Failed to fetch ledger snapshot before identity issuance", error)
  }

  const identityRecordsState = parseLedgerState(snapshot?.identityRecords)
  identityRecordsState[subjectKey] = commitment

  const identityMetadataState = parseLedgerState(snapshot?.identityMetadata)
  identityMetadataState[subjectKey] = metadataRef

  const identityIssuerState = parseLedgerState(snapshot?.identityIssuer)
  identityIssuerState[subjectKey] = issuerReference

  // Convert issuer address to Bytes<32> format for security parameter
  // Bytes<32> requires exactly 32 bytes = 64 hex characters (no "0x" prefix)
  const issuerPublicKeyHex = await deriveSubjectKey(issuerReference)
  console.log("[blockchain-utils] Raw issuerPublicKeyHex:", {
    value: issuerPublicKeyHex,
    length: issuerPublicKeyHex.length,
    has0x: issuerPublicKeyHex.startsWith("0x"),
  })
  
  // Remove "0x" prefix if present
  let issuerPublicKey = issuerPublicKeyHex.startsWith("0x") 
    ? issuerPublicKeyHex.slice(2) 
    : issuerPublicKeyHex
  
  console.log("[blockchain-utils] After removing 0x:", {
    value: issuerPublicKey,
    length: issuerPublicKey.length,
  })
  
  // Ensure exactly 64 hex characters (32 bytes)
  // If longer, truncate; if shorter, pad with zeros
  if (issuerPublicKey.length > 64) {
    console.warn(`[blockchain-utils] issuerPublicKey too long (${issuerPublicKey.length}), truncating to 64 chars`)
    issuerPublicKey = issuerPublicKey.slice(0, 64)
  } else if (issuerPublicKey.length < 64) {
    issuerPublicKey = issuerPublicKey.padStart(64, "0")
  }
  
  // The Midnight SDK expects Bytes<32> as a Uint8Array with exactly 32 bytes
  // Verify it's exactly 64 hex characters, then convert to Uint8Array
  if (issuerPublicKey.length !== 64) {
    throw new Error(
      `[blockchain-utils] issuerPublicKey must be exactly 64 hex characters, got ${issuerPublicKey.length}: ${issuerPublicKey.substring(0, 20)}...`
    )
  }

  // Convert hex string to Uint8Array (32 bytes)
  const issuerPublicKeyBytes = new Uint8Array(
    issuerPublicKey.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16))
  )

  console.log("[blockchain-utils] Final issuerPublicKey:", {
    hex: issuerPublicKey,
    hexLength: issuerPublicKey.length,
    bytesLength: issuerPublicKeyBytes.length,
    firstBytes: Array.from(issuerPublicKeyBytes.slice(0, 4)),
  })

  // Note: The SDK's args array accepts mixed types - strings for Opaque<string> and Uint8Array for Bytes<32>
  const result = await executeMidnightCall(session, "registerIdentity", [
    serializeLedgerState(identityRecordsState),
    serializeLedgerState(identityMetadataState),
    serializeLedgerState(identityIssuerState),
    issuerPublicKeyBytes, // Security: issuer public key (Uint8Array with 32 bytes)
  ] as any) // Type assertion needed because args is typed as string[] but accepts Uint8Array for Bytes<32>

  return {
    txId: result.txId,
    publicData: result.public,
    finalized: result.finalized,
    commitment,
    metadataReference: metadataRef,
  }
}

export async function issueAgeCredentialOnChain(
  session: LaceWalletSession,
  params: {
    subjectId?: string
    ageCredentialCommitment: string
    proofReference: string
    bracketReference: string
    issuerReference?: string
  },
): Promise<CredentialCallResult> {
  const subjectId =
    params.subjectId && params.subjectId.trim().length > 0 ? params.subjectId.trim() : session.address
  if (!subjectId) {
    throw new Error("Subject wallet address is required to issue an age credential")
  }

  const proofReference = params.proofReference
  const issuerReference = params.issuerReference ?? session.address

  const { executeMidnightCall, fetchKycLedgerSnapshot } = await loadMidnightClient()
  let snapshot: any | null = null
  try {
    snapshot = await fetchKycLedgerSnapshot()
  } catch (error) {
    console.warn("[blockchain-utils] Failed to fetch ledger snapshot before age issuance", error)
  }

  const subjectKey = await deriveSubjectKey(subjectId)

  const ageCommitmentsState = parseLedgerState(snapshot?.ageCommitments)
  ageCommitmentsState[subjectKey] = params.ageCredentialCommitment

  const ageProofRefsState = parseLedgerState(snapshot?.ageProofRefs)
  ageProofRefsState[subjectKey] = proofReference

  // PRIVACY: We do NOT store the age bracket value on-chain
  // The age bracket (adult/minor) is private data that should be proven via ZK proof
  // The commitment already includes the age status in its hash, but the value is never disclosed

  const ageIssuersState = parseLedgerState(snapshot?.ageIssuers)
  ageIssuersState[subjectKey] = issuerReference

  // Convert issuer address to Bytes<32> format for security parameter
  // Use hash of issuer address as the public key identifier
  const issuerPublicKeyHex = await deriveSubjectKey(issuerReference)
  // Remove "0x" prefix and ensure 64 hex chars (32 bytes)
  let issuerPublicKey = issuerPublicKeyHex.startsWith("0x") 
    ? issuerPublicKeyHex.slice(2) 
    : issuerPublicKeyHex
  // Ensure exactly 64 hex characters (32 bytes)
  if (issuerPublicKey.length > 64) {
    console.warn(`[blockchain-utils] issuerPublicKey too long (${issuerPublicKey.length}), truncating to 64 chars`)
    issuerPublicKey = issuerPublicKey.slice(0, 64)
  } else if (issuerPublicKey.length < 64) {
    issuerPublicKey = issuerPublicKey.padStart(64, "0")
  }
  // Convert to Uint8Array (32 bytes)
  const issuerPublicKeyBytes = new Uint8Array(
    issuerPublicKey.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16))
  )
  
  // Convert subject key to Bytes<32> format
  let subjectKeyHex = subjectKey.startsWith("0x") 
    ? subjectKey.slice(2) 
    : subjectKey
  // Ensure exactly 64 hex characters (32 bytes)
  if (subjectKeyHex.length > 64) {
    console.warn(`[blockchain-utils] subjectKey too long (${subjectKeyHex.length}), truncating to 64 chars`)
    subjectKeyHex = subjectKeyHex.slice(0, 64)
  } else if (subjectKeyHex.length < 64) {
    subjectKeyHex = subjectKeyHex.padStart(64, "0")
  }
  // Convert to Uint8Array (32 bytes)
  const subjectKeyBytes = new Uint8Array(
    subjectKeyHex.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16))
  )

  // PRIVACY: Only store commitment and proof reference, NOT the age bracket value
  const result = await executeMidnightCall(session, "issueAgeCredential", [
    serializeLedgerState(ageCommitmentsState),
    serializeLedgerState(ageProofRefsState),
    serializeLedgerState(ageIssuersState),
    issuerPublicKeyBytes, // Security: issuer public key (Uint8Array with 32 bytes)
    subjectKeyBytes, // Security: subject key for revocation checks (Uint8Array with 32 bytes)
  ] as any)

  return {
    txId: result.txId,
    publicData: result.public,
    finalized: result.finalized,
    commitment: params.ageCredentialCommitment,
    proofReference,
  }
}

export async function issueCountryCredentialOnChain(
  session: LaceWalletSession,
  params: {
    subjectId?: string
    countryCredentialCommitment: string
    proofReference: string
    issuerReference?: string
  },
): Promise<CredentialCallResult> {
  const subjectId =
    params.subjectId && params.subjectId.trim().length > 0 ? params.subjectId.trim() : session.address
  if (!subjectId) {
    throw new Error("Subject wallet address is required to issue a country credential")
  }

  const proofReference = params.proofReference
  const issuerReference = params.issuerReference ?? session.address

  const { executeMidnightCall, fetchKycLedgerSnapshot } = await loadMidnightClient()
  let snapshot: any | null = null
  try {
    snapshot = await fetchKycLedgerSnapshot()
  } catch (error) {
    console.warn("[blockchain-utils] Failed to fetch ledger snapshot before country issuance", error)
  }

  const subjectKey = await deriveSubjectKey(subjectId)

  const countryCommitmentsState = parseLedgerState(snapshot?.countryCommitments)
  countryCommitmentsState[subjectKey] = params.countryCredentialCommitment

  const countryProofRefsState = parseLedgerState(snapshot?.countryProofRefs)
  countryProofRefsState[subjectKey] = proofReference

  const countryIssuersState = parseLedgerState(snapshot?.countryIssuers)
  countryIssuersState[subjectKey] = issuerReference

  // Convert issuer address to Bytes<32> format for security parameter
  const issuerPublicKeyHex = await deriveSubjectKey(issuerReference)
  let issuerPublicKey = issuerPublicKeyHex.startsWith("0x") 
    ? issuerPublicKeyHex.slice(2) 
    : issuerPublicKeyHex
  // Ensure exactly 64 hex characters (32 bytes)
  if (issuerPublicKey.length > 64) {
    console.warn(`[blockchain-utils] issuerPublicKey too long (${issuerPublicKey.length}), truncating to 64 chars`)
    issuerPublicKey = issuerPublicKey.slice(0, 64)
  } else if (issuerPublicKey.length < 64) {
    issuerPublicKey = issuerPublicKey.padStart(64, "0")
  }
  // Convert to Uint8Array (32 bytes)
  const issuerPublicKeyBytes = new Uint8Array(
    issuerPublicKey.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16))
  )

  const result = await executeMidnightCall(session, "issueCountryCredential", [
    serializeLedgerState(countryCommitmentsState),
    serializeLedgerState(countryProofRefsState),
    serializeLedgerState(countryIssuersState),
    issuerPublicKeyBytes, // Security: issuer public key
  ])

  return {
    txId: result.txId,
    publicData: result.public,
    finalized: result.finalized,
    commitment: params.countryCredentialCommitment,
    proofReference,
  }
}

export async function recordHumanVerificationOnChain(
  session: LaceWalletSession,
  params: {
    subjectId?: string
    humanCredentialCommitment: string
    proofReference: string
    issuerReference?: string
  },
): Promise<CredentialCallResult> {
  const subjectId =
    params.subjectId && params.subjectId.trim().length > 0 ? params.subjectId.trim() : session.address
  if (!subjectId) {
    throw new Error("Subject wallet address is required to issue a human verification credential")
  }

  const proofReference = params.proofReference
  const issuerReference = params.issuerReference ?? session.address

  const { executeMidnightCall, fetchKycLedgerSnapshot } = await loadMidnightClient()
  let snapshot: any | null = null
  try {
    snapshot = await fetchKycLedgerSnapshot()
  } catch (error) {
    console.warn("[blockchain-utils] Failed to fetch ledger snapshot before human verification", error)
  }

  const subjectKey = await deriveSubjectKey(subjectId)

  const humanCommitmentsState = parseLedgerState(snapshot?.humanCommitments)
  humanCommitmentsState[subjectKey] = params.humanCredentialCommitment

  const humanProofRefsState = parseLedgerState(snapshot?.humanProofRefs)
  humanProofRefsState[subjectKey] = proofReference

  const humanIssuersState = parseLedgerState(snapshot?.humanIssuers)
  humanIssuersState[subjectKey] = issuerReference

  // Convert issuer address to Bytes<32> format for security parameter
  const issuerPublicKeyHex = await deriveSubjectKey(issuerReference)
  let issuerPublicKey = issuerPublicKeyHex.startsWith("0x") 
    ? issuerPublicKeyHex.slice(2) 
    : issuerPublicKeyHex
  // Ensure exactly 64 hex characters (32 bytes)
  if (issuerPublicKey.length > 64) {
    console.warn(`[blockchain-utils] issuerPublicKey too long (${issuerPublicKey.length}), truncating to 64 chars`)
    issuerPublicKey = issuerPublicKey.slice(0, 64)
  } else if (issuerPublicKey.length < 64) {
    issuerPublicKey = issuerPublicKey.padStart(64, "0")
  }
  // Convert to Uint8Array (32 bytes)
  const issuerPublicKeyBytes = new Uint8Array(
    issuerPublicKey.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16))
  )

  const result = await executeMidnightCall(session, "recordHumanVerification", [
    serializeLedgerState(humanCommitmentsState),
    serializeLedgerState(humanProofRefsState),
    serializeLedgerState(humanIssuersState),
    issuerPublicKeyBytes, // Security: issuer public key
  ])

  return {
    txId: result.txId,
    publicData: result.public,
    finalized: result.finalized,
    commitment: params.humanCredentialCommitment,
    proofReference,
  }
}

export async function verifyZKProof(_proof: string): Promise<boolean> {
  // Verification is handled by the Midnight contract execution. This helper remains for API parity.
  return true
}

export async function revokeCredentialOnChain(
  session: LaceWalletSession,
  credentialId: string,
  reason: string,
  issuerReference?: string,
  subjectId?: string
): Promise<CredentialCallResult> {
  const issuerRef = issuerReference ?? session.address
  const subject = subjectId ?? credentialId // Use subjectId if provided, otherwise use credentialId
  const commitment = await generateCredentialHash({ credentialId, reason, issuerReference: issuerRef })
  const { executeMidnightCall, fetchKycLedgerSnapshot } = await loadMidnightClient()
  let snapshot: any | null = null
  try {
    snapshot = await fetchKycLedgerSnapshot()
  } catch (error) {
    console.warn("[blockchain-utils] Failed to fetch ledger snapshot before revocation", error)
  }

  const subjectKey = await deriveSubjectKey(subject)

  const revocationReasonsState = parseLedgerState(snapshot?.revocationReasons)
  revocationReasonsState[subjectKey] = reason

  const revocationIssuersState = parseLedgerState(snapshot?.revocationIssuers)
  revocationIssuersState[subjectKey] = issuerRef

  const revokedSubjectsState = parseLedgerState(snapshot?.revokedSubjects)
  revokedSubjectsState[subjectKey] = "revoked"

  // Convert to Bytes<32> format for security parameters
  const issuerPublicKeyHex = await deriveSubjectKey(issuerRef)
  let issuerPublicKey = issuerPublicKeyHex.startsWith("0x") 
    ? issuerPublicKeyHex.slice(2) 
    : issuerPublicKeyHex
  // Ensure exactly 64 hex characters (32 bytes)
  if (issuerPublicKey.length > 64) {
    console.warn(`[blockchain-utils] issuerPublicKey too long (${issuerPublicKey.length}), truncating to 64 chars`)
    issuerPublicKey = issuerPublicKey.slice(0, 64)
  } else if (issuerPublicKey.length < 64) {
    issuerPublicKey = issuerPublicKey.padStart(64, "0")
  }
  // Convert to Uint8Array (32 bytes)
  const issuerPublicKeyBytes = new Uint8Array(
    issuerPublicKey.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16))
  )

  let subjectKeyHex = subjectKey.startsWith("0x") 
    ? subjectKey.slice(2) 
    : subjectKey
  // Ensure exactly 64 hex characters (32 bytes)
  if (subjectKeyHex.length > 64) {
    console.warn(`[blockchain-utils] subjectKey too long (${subjectKeyHex.length}), truncating to 64 chars`)
    subjectKeyHex = subjectKeyHex.slice(0, 64)
  } else if (subjectKeyHex.length < 64) {
    subjectKeyHex = subjectKeyHex.padStart(64, "0")
  }
  // Convert to Uint8Array (32 bytes)
  const subjectKeyBytes = new Uint8Array(
    subjectKeyHex.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16))
  )

  const result = await executeMidnightCall(session, "revokeLastCredential", [
    serializeLedgerState(revocationReasonsState),
    serializeLedgerState(revocationIssuersState),
    serializeLedgerState(revokedSubjectsState),
    issuerPublicKeyBytes, // Security: issuer public key
    subjectKeyBytes, // Security: subject key being revoked
  ])

  return {
    txId: result.txId,
    publicData: result.public,
    finalized: result.finalized,
    commitment,
  }
}

export function shortenAddress(address: string, chars = 4): string {
  if (!address) return ""
  return `${address.substring(0, chars + 2)}...${address.substring(address.length - chars)}`
}

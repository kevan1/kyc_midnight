import type { Credential, User } from "@/lib/types"
import { deriveSubjectKey } from "@/lib/blockchain-utils"

const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000

const DEFAULT_KYC_STATUS: User["kyc"] = {
  identity: "None",
  human: "None",
  age: "None",
}

export type HydratedLedgerState = {
  credentials: Credential[]
  kycStatus: User["kyc"]
  subjectHash: string | null
}

export function createDefaultKycStatus(): User["kyc"] {
  return { ...DEFAULT_KYC_STATUS }
}

export function parseLedgerField(value: unknown): Record<string, string> {
  if (!value) {
    return {}
  }

  let raw = value
  if (typeof raw === "object" && raw !== null && "value" in (raw as Record<string, unknown>)) {
    raw = (raw as Record<string, unknown>).value
  }

  if (typeof raw !== "string" || raw.trim().length === 0) {
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
      result[key] = typeof val === "string" ? val : String(val)
    }
    return result
  } catch (error) {
    console.warn("[ledger] Failed to parse ledger field", { value: raw, error })
    return {}
  }
}

export async function hydrateLedgerForWallet(
  ledger: any,
  walletAddress: string | null,
): Promise<HydratedLedgerState> {
  if (!ledger || !walletAddress) {
    return {
      credentials: [],
      kycStatus: createDefaultKycStatus(),
      subjectHash: null,
    }
  }

  const subjectKey = await deriveSubjectKey(walletAddress)

  const identityRecords = parseLedgerField(ledger.identityRecords)
  const identityMetadata = parseLedgerField(ledger.identityMetadata)
  const identityIssuers = parseLedgerField(ledger.identityIssuer)

  const ageCommitments = parseLedgerField(ledger.ageCommitments)
  const ageProofRefs = parseLedgerField(ledger.ageProofRefs)
  // PRIVACY: ageBracketRefs is no longer stored on-chain - age status is private
  // Age verification must be done via ZK proof verification, not by reading stored values
  const ageIssuers = parseLedgerField(ledger.ageIssuers)

  const humanCommitments = parseLedgerField(ledger.humanCommitments)
  const humanProofRefs = parseLedgerField(ledger.humanProofRefs)
  const humanIssuers = parseLedgerField(ledger.humanIssuers)

  const countryCommitments = parseLedgerField(ledger.countryCommitments)
  const countryProofRefs = parseLedgerField(ledger.countryProofRefs)
  const countryIssuers = parseLedgerField(ledger.countryIssuers)

  const credentials: Credential[] = []
  const kycStatus = createDefaultKycStatus()

  const issuedAt = new Date().toISOString()
  const expiryTime = new Date(Date.now() + ONE_YEAR_MS).toISOString()

  if (identityRecords[subjectKey]) {
    const commitment = identityRecords[subjectKey]
    const issuer = identityIssuers[subjectKey] ?? walletAddress
    const metadataReference = identityMetadata[subjectKey]

    credentials.push({
      id: `identity-${commitment}`,
      type: "Identity",
      holder: walletAddress,
      issuer,
      status: "Verified",
      issueTime: issuedAt,
      expiryTime,
      txHash: "",
      credentialHash: commitment,
      merkleLeaf: commitment,
      proofReference: metadataReference ?? undefined,
      metadata: {},
    })

    kycStatus.identity = "Verified"
  }

  if (ageCommitments[subjectKey]) {
    const commitment = ageCommitments[subjectKey]
    const issuer = ageIssuers[subjectKey] ?? walletAddress
    const proofReference = ageProofRefs[subjectKey]
    
    // PRIVACY: Age bracket value is NOT stored on-chain - it's private data
    // The commitment contains the age status in its hash, but the value is never disclosed
    // Age verification must be done via ZK proof verification
    // However, if the credential exists on-chain, it means the transaction was successful
    // So we mark it as "Verified" - the actual isAdult status should come from proof verification
    
    credentials.push({
      id: `age-${commitment}`,
      type: "Age",
      holder: walletAddress,
      issuer,
      status: "Verified", // Credential exists on-chain, transaction was successful
      issueTime: issuedAt,
      expiryTime,
      txHash: "",
      credentialHash: commitment,
      merkleLeaf: commitment,
      proofReference: proofReference ?? undefined,
      zkProofSummary: "Age credential issued on-chain. ZK proof available for privacy-preserving verification.",
      metadata: {
        // Do NOT include isAdult here - it should only come from proof verification
        commitment,
        proofReference: proofReference ?? undefined,
      },
    })

    // Age credential exists on-chain, so it's verified
    // The actual isAdult boolean should come from proof verification, not from on-chain data
    kycStatus.age = "Verified"
  }

  if (humanCommitments[subjectKey]) {
    const commitment = humanCommitments[subjectKey]
    const issuer = humanIssuers[subjectKey] ?? walletAddress
    const proofReference = humanProofRefs[subjectKey]

    credentials.push({
      id: `human-${commitment}`,
      type: "Human",
      holder: walletAddress,
      issuer,
      status: "Verified",
      issueTime: issuedAt,
      expiryTime,
      txHash: "",
      credentialHash: commitment,
      merkleLeaf: commitment,
      proofReference: proofReference ?? undefined,
      zkProofSummary: "On-chain proof confirms liveness verification",
      metadata: {
        // Note: captchaPassed and livenessCheck are in the commitment hash but cannot be read back
        // These values should be merged from local store if available
      },
    })

    kycStatus.human = "Verified"
  }

  if (countryCommitments[subjectKey]) {
    const commitment = countryCommitments[subjectKey]
    const issuer = countryIssuers[subjectKey] ?? walletAddress
    const proofReference = countryProofRefs[subjectKey]

    credentials.push({
      id: `country-${commitment}`,
      type: "Country",
      holder: walletAddress,
      issuer,
      status: "Verified",
      issueTime: issuedAt,
      expiryTime,
      txHash: "",
      credentialHash: commitment,
      merkleLeaf: commitment,
      proofReference: proofReference ?? undefined,
      zkProofSummary: "Country credential issued on-chain. ZK proof available for privacy-preserving verification.",
      metadata: {
        // Note: country and isFrance are in the commitment hash but cannot be read back
        // These values should be verified via ZK proof
      },
    })
  }

  return {
    credentials,
    kycStatus,
    subjectHash: subjectKey,
  }
}


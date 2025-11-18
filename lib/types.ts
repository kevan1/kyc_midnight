export type CredentialType = "Identity" | "Human" | "Age" | "Country"

export type CredentialStatus = "Verified" | "Pending" | "Revoked" | "Expired"

export interface Credential {
  id: string
  type: CredentialType
  holder: string
  issuer: string
  status: CredentialStatus
  issueTime: string
  expiryTime: string
  txHash: string
  // Optional block number/height where this transaction was included
  // This comes from the Midnight indexer finalized data and may be undefined
  blockNumber?: number | string
  credentialHash: string
  merkleLeaf: string
  proofReference?: string
  zkProofSummary?: string
  metadata: {
    country?: string
    docType?: string
    overAge?: boolean
    fullName?: string
    isAdult?: boolean
    captchaPassed?: boolean // CAPTCHA verification result (true = passed, false = failed)
    livenessCheck?: boolean // Liveness detection result
  }
  chainData?: {
    publicData?: any
    finalized?: any
  }
  revocationReason?: string
}

export interface User {
  walletAddress: string | null
  network: string
  kyc: {
    identity: CredentialStatus | "None"
    human: CredentialStatus | "None"
    age: CredentialStatus | "None"
  }
}

export interface Issuer {
  id: string
  name: string
  address: string
}

export interface VerificationAction {
  id: string
  type: CredentialType
  action: "Issued" | "Revoked" | "Verified"
  timestamp: string
  txHash: string
}

import { NextResponse } from "next/server"
import { hydrateLedgerForWallet } from "@/lib/ledger"
import { fetchKycLedgerSnapshot } from "@/lib/midnight-client"

// Allow multiple asset app origins (both ports 3001 and 3002)
const ALLOWED_ORIGINS = [
  process.env.NEXT_PUBLIC_ASSET_APP_URL,
  process.env.ASSET_APP_ORIGIN,
  "http://localhost:3001",
  "http://localhost:3002",
].filter(Boolean) as string[]

function getCorsHeaders(origin: string | null) {
  const requestOrigin = origin || ""
  const allowedOrigin = ALLOWED_ORIGINS.includes(requestOrigin) ? requestOrigin : ALLOWED_ORIGINS[0] || "http://localhost:3002"
  
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "GET,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
  }
}

export async function OPTIONS(request: Request) {
  const origin = request.headers.get("origin")
  return new NextResponse(null, {
    status: 204,
    headers: getCorsHeaders(origin),
  })
}

export async function GET(request: Request) {
  const origin = request.headers.get("origin")
  const corsHeaders = getCorsHeaders(origin)
  const url = new URL(request.url)
  const wallet = url.searchParams.get("wallet")

  if (!wallet || wallet.trim().length === 0) {
    return NextResponse.json(
      { error: "wallet query parameter is required" },
      {
        status: 400,
        headers: corsHeaders,
      },
    )
  }

  try {
    const snapshot = await fetchKycLedgerSnapshot()
    const hydrated = await hydrateLedgerForWallet(snapshot, wallet)

    // PRIVACY: Do NOT return the actual age value from on-chain data
    // Age verification must be done via proof verification endpoint
    // Filter out isAdult and overAge from metadata to preserve privacy
    // But keep captchaPassed and livenessCheck as they are not private information
    const credentials = hydrated.credentials.map((credential) => {
      const { isAdult, overAge, ...restMetadata } = credential.metadata || {}
      return {
        id: credential.id,
        type: credential.type,
        status: credential.status,
        metadata: restMetadata, // Exclude age values but keep captchaPassed, livenessCheck, etc.
        proofReference: credential.proofReference,
        zkProofSummary: credential.zkProofSummary,
        commitment: credential.credentialHash, // Include commitment for proof verification
      }
    })

    return NextResponse.json(
      {
        wallet,
        subjectHash: hydrated.subjectHash,
        kycStatus: {
          identity: hydrated.kycStatus.identity,
          human: hydrated.kycStatus.human,
          age: hydrated.kycStatus.age, // "Verified" if credential exists on-chain
        },
        credentials,
        // Important: Age verification requires proof verification endpoint
        // Call POST /api/kyc/verify-proof with wallet and commitment to verify age >= 18
        // The age status is "Verified" when the credential exists on-chain
        // Use /api/kyc/verify-proof to verify age >= 18 without revealing the actual value
      },
      {
        headers: corsHeaders,
      },
    )
  } catch (error) {
    console.error("[api/kyc/status] Failed to load ledger snapshot", error)
    return NextResponse.json(
      { error: "Failed to load ledger snapshot" },
      {
        status: 500,
        headers: corsHeaders,
      },
    )
  }
}


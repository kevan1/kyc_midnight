import { NextResponse } from "next/server"
import { fetchKycLedgerSnapshot } from "@/lib/midnight-client"
import { deriveSubjectKey } from "@/lib/blockchain-utils"
import { parseLedgerField } from "@/lib/ledger"
import { verifyAgeProof, verifyCountryProof, verifyCaptchaProof } from "@/lib/zk-proof-utils"
import { getProof } from "@/lib/proof-store"

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
    "Access-Control-Allow-Methods": "POST,OPTIONS",
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

/**
 * Verify ZK proofs without revealing private values
 * Supports:
 * - Age proof: proves age >= 18 without revealing actual age
 * - Country proof: proves country == France without revealing actual country
 * - CAPTCHA proof: proves CAPTCHA passed without revealing actual result
 */
export async function POST(request: Request) {
  const origin = request.headers.get("origin")
  const corsHeaders = getCorsHeaders(origin)
  
  try {
    const body = await request.json()
    const { wallet, proof, commitment, proofType } = body

    if (!wallet || !commitment) {
      return NextResponse.json(
        { error: "wallet and commitment are required" },
        {
          status: 400,
          headers: corsHeaders,
        },
      )
    }

    // Determine proof type: "age", "country", or "captcha"
    const type = proofType || "age" // Default to age for backward compatibility

    // Fetch ledger snapshot
    const snapshot = await fetchKycLedgerSnapshot()
    if (!snapshot) {
      return NextResponse.json(
        { error: "Failed to fetch ledger snapshot" },
        {
          status: 500,
          headers: corsHeaders,
        },
      )
    }

    // Derive subject key from wallet address
    const subjectKey = await deriveSubjectKey(wallet)

    // Parse ledger fields based on proof type
    const revokedSubjects = parseLedgerField(snapshot.revokedSubjects)

    // Check if subject is revoked
    if (revokedSubjects[subjectKey]) {
      return NextResponse.json(
        {
          verified: false,
          reason: "Credential has been revoked",
        },
        {
          status: 200,
          headers: corsHeaders,
        },
      )
    }

    // Handle different proof types
    if (type === "age") {
      const ageCommitments = parseLedgerField(snapshot.ageCommitments)
      const ageProofRefs = parseLedgerField(snapshot.ageProofRefs)

      const storedCommitment = ageCommitments[subjectKey]
      if (!storedCommitment) {
        return NextResponse.json(
          {
            verified: false,
            reason: "No age credential found for this wallet",
          },
          {
            status: 200,
            headers: corsHeaders,
          },
        )
      }

      if (storedCommitment !== commitment) {
        return NextResponse.json(
          {
            verified: false,
            reason: "Commitment mismatch",
          },
          {
            status: 200,
            headers: corsHeaders,
          },
        )
      }

      let ageProofToVerify = null
      if (proof) {
        try {
          ageProofToVerify = typeof proof === "string" ? JSON.parse(proof) : proof
        } catch (error) {
          console.warn("[api/kyc/verify-proof] Failed to parse provided proof", error)
        }
      } else {
        ageProofToVerify = await getProof(subjectKey)
      }
      
      if (!ageProofToVerify) {
        return NextResponse.json(
          {
            verified: false,
            isAdult: false,
            reason: "No ZK proof available for verification. Age value cannot be read directly for privacy.",
          },
          {
            status: 200,
            headers: corsHeaders,
          },
        )
      }
      
      const verificationResult = await verifyAgeProof(ageProofToVerify, storedCommitment)
      
      if (!verificationResult.verified) {
        return NextResponse.json(
          {
            verified: false,
            isAdult: false,
            reason: verificationResult.reason || "Proof verification failed",
          },
          {
            status: 200,
            headers: corsHeaders,
          },
        )
      }
      
      return NextResponse.json(
        {
          verified: true,
          isAdult: verificationResult.isAdult,
          commitment: storedCommitment,
          proofReference: ageProofRefs[subjectKey] ?? undefined,
        },
        {
          headers: corsHeaders,
        },
      )
    } else if (type === "country") {
      const countryCommitments = parseLedgerField(snapshot.countryCommitments)
      const countryProofRefs = parseLedgerField(snapshot.countryProofRefs)

      const storedCommitment = countryCommitments[subjectKey]
      if (!storedCommitment) {
        return NextResponse.json(
          {
            verified: false,
            reason: "No country credential found for this wallet",
          },
          {
            status: 200,
            headers: corsHeaders,
          },
        )
      }

      if (storedCommitment !== commitment) {
        return NextResponse.json(
          {
            verified: false,
            reason: "Commitment mismatch",
          },
          {
            status: 200,
            headers: corsHeaders,
          },
        )
      }

      let countryProofToVerify = null
      if (proof) {
        try {
          countryProofToVerify = typeof proof === "string" ? JSON.parse(proof) : proof
        } catch (error) {
          console.warn("[api/kyc/verify-proof] Failed to parse provided proof", error)
        }
      } else {
        countryProofToVerify = await getProof(`${subjectKey}:country`)
      }
      
      if (!countryProofToVerify) {
        return NextResponse.json(
          {
            verified: false,
            isFrance: false,
            reason: "No ZK proof available for verification. Country value cannot be read directly for privacy.",
          },
          {
            status: 200,
            headers: corsHeaders,
          },
        )
      }
      
      const verificationResult = await verifyCountryProof(countryProofToVerify, storedCommitment)
      
      if (!verificationResult.verified) {
        return NextResponse.json(
          {
            verified: false,
            isFrance: false,
            reason: verificationResult.reason || "Proof verification failed",
          },
          {
            status: 200,
            headers: corsHeaders,
          },
        )
      }
      
      return NextResponse.json(
        {
          verified: true,
          isFrance: verificationResult.isFrance,
          commitment: storedCommitment,
          proofReference: countryProofRefs[subjectKey] ?? undefined,
        },
        {
          headers: corsHeaders,
        },
      )
    } else if (type === "captcha") {
      const humanCommitments = parseLedgerField(snapshot.humanCommitments)
      const humanProofRefs = parseLedgerField(snapshot.humanProofRefs)

      const storedCommitment = humanCommitments[subjectKey]
      if (!storedCommitment) {
        return NextResponse.json(
          {
            verified: false,
            reason: "No human credential found for this wallet",
          },
          {
            status: 200,
            headers: corsHeaders,
          },
        )
      }

      if (storedCommitment !== commitment) {
        return NextResponse.json(
          {
            verified: false,
            reason: "Commitment mismatch",
          },
          {
            status: 200,
            headers: corsHeaders,
          },
        )
      }

      let captchaProofToVerify = null
      if (proof) {
        try {
          captchaProofToVerify = typeof proof === "string" ? JSON.parse(proof) : proof
        } catch (error) {
          console.warn("[api/kyc/verify-proof] Failed to parse provided proof", error)
        }
      } else {
        captchaProofToVerify = await getProof(`${subjectKey}:captcha`)
      }
      
      if (!captchaProofToVerify) {
        return NextResponse.json(
          {
            verified: false,
            captchaPassed: false,
            reason: "No ZK proof available for verification. CAPTCHA result cannot be read directly for privacy.",
          },
          {
            status: 200,
            headers: corsHeaders,
          },
        )
      }
      
      const verificationResult = await verifyCaptchaProof(captchaProofToVerify, storedCommitment)
      
      if (!verificationResult.verified) {
        return NextResponse.json(
          {
            verified: false,
            captchaPassed: false,
            reason: verificationResult.reason || "Proof verification failed",
          },
          {
            status: 200,
            headers: corsHeaders,
          },
        )
      }
      
      return NextResponse.json(
        {
          verified: true,
          captchaPassed: verificationResult.captchaPassed,
          commitment: storedCommitment,
          proofReference: humanProofRefs[subjectKey] ?? undefined,
        },
        {
          headers: corsHeaders,
        },
      )
    } else {
      return NextResponse.json(
        {
          error: `Unknown proof type: ${type}. Supported types: age, country, captcha`,
        },
        {
          status: 400,
          headers: corsHeaders,
        },
      )
    }
  } catch (error) {
    console.error("[api/kyc/verify-proof] Failed to verify proof", error)
    return NextResponse.json(
      { error: "Failed to verify proof", verified: false },
      {
        status: 500,
        headers: corsHeaders,
      },
    )
  }
}


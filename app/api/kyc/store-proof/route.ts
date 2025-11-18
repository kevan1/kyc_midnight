import { NextResponse } from "next/server"
import { storeProof } from "@/lib/proof-store"
import type { AgeProof, CountryProof, CaptchaProof } from "@/lib/zk-proof-utils"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { subjectKey, proof } = body

    if (!subjectKey || !proof) {
      return NextResponse.json(
        { error: "subjectKey and proof are required" },
        { status: 400 },
      )
    }

    // Validate proof structure (supports Age, Country, and Captcha proofs)
    if (!proof.commitment || !proof.proof || !proof.statement) {
      return NextResponse.json(
        { error: "Invalid proof structure" },
        { status: 400 },
      )
    }

    // Store the proof server-side (supports all proof types)
    await storeProof(subjectKey, proof as AgeProof | CountryProof | CaptchaProof)

    return NextResponse.json(
      { success: true, message: "Proof stored successfully" },
      { status: 200 },
    )
  } catch (error) {
    console.error("[api/kyc/store-proof] Failed to store proof", error)
    return NextResponse.json(
      { error: "Failed to store proof" },
      { status: 500 },
    )
  }
}


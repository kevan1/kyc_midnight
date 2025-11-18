import { NextResponse } from "next/server"

export async function POST() {
  return NextResponse.json({ error: "Credential revocation is handled client-side via Lace wallet." }, { status: 501 })
}

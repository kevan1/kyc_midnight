import { NextResponse } from "next/server"

export async function POST() {
  return NextResponse.json({ error: "Identity issuance is handled client-side via Lace wallet." }, { status: 501 })
}

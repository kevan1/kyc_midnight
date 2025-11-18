import { NextResponse } from "next/server"

export async function POST() {
  return NextResponse.json({ error: "Age credential issuance is handled in the client via Lace wallet." }, { status: 501 })
}

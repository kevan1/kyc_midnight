import { NextResponse } from "next/server"

export async function POST() {
  return NextResponse.json({ error: "Human verification is handled in the client via Lace wallet." }, { status: 501 })
}

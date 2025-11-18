import { NextResponse } from "next/server"

export async function GET() {
  return NextResponse.json({ error: "Ledger inspection is handled client-side via Lace wallet." }, { status: 501 })
}

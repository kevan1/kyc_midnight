import { NextResponse } from "next/server"
import { readFile } from "fs/promises"
import path from "path"

const CIRCUIT_BASE_PATH = path.join(
  process.cwd(),
  "contracts/kyc_credentials/contracts/managed/kyc-credentials"
)

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const circuit = searchParams.get("circuit")

  if (!circuit) {
    return NextResponse.json({ error: "Missing circuit parameter" }, { status: 400 })
  }

  try {
    const proverPath = path.join(CIRCUIT_BASE_PATH, "keys", `${circuit}.prover`)
    const verifierPath = path.join(CIRCUIT_BASE_PATH, "keys", `${circuit}.verifier`)
    const zkirPath = path.join(CIRCUIT_BASE_PATH, "zkir", `${circuit}.bzkir`)

    const [prover, verifier, zkir] = await Promise.all([
      readFile(proverPath),
      readFile(verifierPath),
      readFile(zkirPath),
    ])

    return NextResponse.json({
      circuit,
      prover: Buffer.from(prover).toString("base64"),
      verifier: Buffer.from(verifier).toString("base64"),
      zkir: Buffer.from(zkir).toString("base64"),
    })
  } catch (error) {
    console.error("[midnight][zk-config]", error)
    return NextResponse.json({ error: "Circuit artifacts not found" }, { status: 404 })
  }
}


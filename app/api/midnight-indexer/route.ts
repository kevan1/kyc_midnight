export async function POST(req: Request) {
  const body = await req.json()

  const response = await fetch(
    "https://indexer.testnet-02.midnight.network/api/v1/graphql",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  )

  const data = await response.json()
  return Response.json(data)
}

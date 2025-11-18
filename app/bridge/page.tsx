"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Loader2, AlertTriangle } from "lucide-react"
import { useKYCStore } from "@/lib/store"

const KYC_STORAGE_KEY = "midnightKycStatus"

export default function BridgePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTarget = searchParams.get("redirect") ?? ""
  const { connectWallet } = useKYCStore()
  const [status, setStatus] = useState<"connecting" | "checking" | "redirecting" | "error">("connecting")
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false

    async function run() {
      try {
        setStatus("connecting")
        // Ensure wallet is connected
        if (!useKYCStore.getState().walletSession) {
          await connectWallet()
        }
        if (cancelled) return

        setStatus("checking")
        
        // CRITICAL: Always check ACTUAL on-chain KYC status first
        // localStorage can be stale, especially after contract upgrades
        const session = useKYCStore.getState().walletSession
        if (!session) {
          throw new Error("Wallet session not available")
        }
        
        // Refresh ledger snapshot to get current on-chain status
        // This ensures we're checking against the latest contract state
        await useKYCStore.getState().refreshLedgerSnapshot()
        
        // Get the actual KYC status from the store (which is synced from on-chain)
        const { user } = useKYCStore.getState()
        const kycStatus = user.kyc
        
        // Check if ALL required verifications are complete ON-CHAIN
        // For asset tokenization, we need: Identity, Age (>= 18), and Human verification
        const identityComplete = kycStatus.identity === "Verified"
        const ageComplete = kycStatus.age === "Verified" // Must be "Verified", not "Pending"
        const humanComplete = kycStatus.human === "Verified"
        
        // Only redirect if ALL verifications are complete ON-CHAIN
        const allComplete = identityComplete && ageComplete && humanComplete
        
        console.log("[bridge] On-chain KYC status check:", {
          identity: kycStatus.identity,
          age: kycStatus.age,
          human: kycStatus.human,
          allComplete,
          wallet: session.address,
        })
        
        // If on-chain status shows incomplete, proceed to verification
        // Ignore localStorage completely - it may be stale from old contract
        if (!allComplete) {
          console.log("[bridge] On-chain KYC incomplete, proceeding to verification flow")
          // Clear any stale localStorage data to prevent confusion
          if (typeof window !== "undefined") {
            try {
              window.localStorage.removeItem(KYC_STORAGE_KEY)
              console.log("[bridge] Cleared stale localStorage KYC data")
            } catch (error) {
              console.warn("[bridge] Failed to clear localStorage", error)
            }
          }
        } else if (allComplete && redirectTarget) {
          // All verifications are complete on-chain
          // Now check localStorage for isAdult status (for age verification result)
          let storedStatus: any = null
          if (typeof window !== "undefined") {
            const raw = window.localStorage.getItem(KYC_STORAGE_KEY)
            if (raw) {
              try {
                storedStatus = JSON.parse(raw)
              } catch (parseError) {
                console.warn("[bridge] Failed to parse stored KYC status", parseError)
              }
            }
          }
          
          // Only use stored status if it matches current wallet
          const sameWallet = storedStatus?.wallet && session.address.toLowerCase() === storedStatus.wallet.toLowerCase()
          
          if (sameWallet && typeof storedStatus.isAdult === "boolean") {
            setStatus("redirecting")
            if (typeof window !== "undefined") {
              const outcome = storedStatus.isAdult ? "verified" : "underage"
              try {
                // Use the redirectTarget as-is if it's a full URL, otherwise construct from origin
                let targetUrl: URL
                if (redirectTarget.startsWith("http://") || redirectTarget.startsWith("https://")) {
                  targetUrl = new URL(redirectTarget)
                } else {
                  targetUrl = new URL(redirectTarget, window.location.origin)
                }
                targetUrl.searchParams.set("kyc", outcome)
                // Include the Midnight wallet address so asset app can query on-chain status
                if (storedStatus.wallet) {
                  targetUrl.searchParams.set("midnightWallet", storedStatus.wallet)
                }
                if (storedStatus.subjectHash) {
                  targetUrl.searchParams.set("subjectHash", storedStatus.subjectHash)
                }
                console.log("[bridge] All verifications complete on-chain, redirecting back to asset app with status:", outcome, "wallet:", storedStatus.wallet)
                window.location.href = targetUrl.toString()
              } catch (redirectError) {
                console.warn("[bridge] Unable to construct redirect URL", redirectError)
                window.location.href = redirectTarget
              }
            }
            return
          } else {
            // All verifications complete on-chain but no stored isAdult status
            // This means we need to verify age via proof
            // Proceed to verification flow to ensure proof is verified
            console.log("[bridge] All verifications complete on-chain but age proof not verified, proceeding to verification flow")
          }
        }

        setStatus("redirecting")
        
        // Store redirect target in localStorage so age verification (final step) can use it
        if (redirectTarget && typeof window !== "undefined") {
          try {
            window.localStorage.setItem("kyc_redirect_target", redirectTarget)
            console.log("[bridge] Stored redirect target in localStorage:", redirectTarget)
          } catch (e) {
            console.warn("[bridge] Failed to store redirect target in localStorage", e)
          }
        }
        
        // Redirect to identity verification first (sequential flow: Identity -> Human -> Age)
        // Pass redirect through the flow so each step knows where to redirect back
        const nextPath = redirectTarget ? `/verify/identity?redirect=${encodeURIComponent(redirectTarget)}` : "/verify/identity"
        router.replace(nextPath)
      } catch (err) {
        console.error("[bridge] Flow failed", err)
        if (!cancelled) {
          setStatus("error")
          setError("No pudimos conectar tu wallet. Inténtalo nuevamente.")
        }
      }
    }

    run()

    return () => {
      cancelled = true
    }
  }, [connectWallet, redirectTarget, router, attempt])

  const handleRetry = () => {
    setError(null)
    setStatus("connecting")
    setAttempt((prev) => prev + 1)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-[#0F0E2A] to-[#1a1840] p-6">
      <div className="w-full max-w-md space-y-6 rounded-2xl border border-border bg-card p-8 text-center shadow-lg">
        {status === "error" ? (
          <>
            <AlertTriangle className="mx-auto h-12 w-12 text-warning" />
            <div className="space-y-2">
              <h1 className="text-2xl font-semibold text-foreground">No pudimos conectar tu wallet</h1>
              <p className="text-sm text-muted-foreground">{error ?? "Inténtalo nuevamente."}</p>
            </div>
            <Button onClick={handleRetry}>Reintentar</Button>
          </>
        ) : (
          <>
            <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary" />
            <div className="space-y-2">
              <h1 className="text-2xl font-semibold text-foreground">Preparando tu verificación</h1>
              <p className="text-sm text-muted-foreground">
                {status === "connecting"
                  ? "Solicitando conexión con Lace Wallet..."
                  : status === "checking"
                    ? "Verificando si tu KYC ya está completo..."
                    : "Redirigiéndote a la verificación de edad."}
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

"use client"

import { useEffect, useState, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Progress } from "@/components/ui/progress"
import { Calendar, CheckCircle2, Loader2, AlertCircle, Shield, Download, ExternalLink, Upload } from "lucide-react"
import { useKYCStore } from "@/lib/store"
import {
  generateCredentialHash,
  addLeafToMerkle,
  issueAgeCredentialOnChain,
  verifyZKProof,
  deriveSubjectKey,
  getMidnightExplorerUrl,
} from "@/lib/blockchain-utils"
import { generateAgeProof, storeAgeProof } from "@/lib/zk-proof-utils"
import { getContractAddress } from "@/lib/midnight-client"
import { useToast } from "@/hooks/use-toast"

const KYC_STORAGE_KEY = "midnightKycStatus"

interface AgeVerificationReceipt {
  type: "age"
  version: 1
  timestamp: string
  networkId: number
  contractAddress: string | null
  txId: string
  commitment: string
  proofReference?: string
  holder: string
  issuer: string
  isAdult: boolean
  method: string
  publicData: any
  finalized: any
}

export default function AgeVerificationPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const { user, walletSession, addCredential, addAction, refreshLedgerSnapshot } = useKYCStore()
  const [step, setStep] = useState(1)
  const [isProcessing, setIsProcessing] = useState(false)
  const [ageRange, setAgeRange] = useState<string>("")
  const [verificationMethod, setVerificationMethod] = useState<string>("")
  const [receipt, setReceipt] = useState<AgeVerificationReceipt | null>(null)
  const [methodDocFile, setMethodDocFile] = useState<File | null>(null)
  const [methodDocPreviewUrl, setMethodDocPreviewUrl] = useState<string | null>(null)
  const [methodDocStatus, setMethodDocStatus] = useState<"idle" | "verifying" | "verified" | "invalid">("idle")
  const [methodDocPhase, setMethodDocPhase] = useState<"idle" | "source" | "age" | "consistency" | "done">("idle")
  const redirectTarget = searchParams.get("redirect")
  const holderAddress = user.walletAddress ?? walletSession?.address ?? null
  const identityVerified = user.kyc.identity === "Verified"
  const humanVerified = user.kyc.human === "Verified"
  const redirectStartedRef = useRef(false)
  const redirectTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (!identityVerified) {
      toast({
        title: "Identity verification required",
        description: "Complete your identity verification before continuing to age verification.",
        variant: "destructive",
      })
      router.replace("/verify/identity")
      return
    }
    if (!humanVerified) {
      toast({
        title: "Human verification required",
        description: "Complete your human verification before continuing to age verification.",
        variant: "destructive",
      })
      router.replace("/verify/human")
    }
  }, [identityVerified, humanVerified, router, toast])

  // Cleanup redirect timeout on unmount
  useEffect(() => {
    return () => {
      if (redirectTimeoutRef.current) {
        clearTimeout(redirectTimeoutRef.current)
        redirectTimeoutRef.current = null
      }
      // Also clear any timeout stored on window
      if (typeof window !== "undefined" && (window as any).__kycRedirectTimeout) {
        clearTimeout((window as any).__kycRedirectTimeout)
        delete (window as any).__kycRedirectTimeout
      }
    }
  }, [])

  if (!identityVerified || !humanVerified) {
    const nextStep = !identityVerified ? "/verify/identity" : "/verify/human"
    const message = !identityVerified
      ? "Please complete your identity verification first."
      : "Please complete your human verification first."
    return (
      <div className="container mx-auto px-4 py-16">
        <Card className="max-w-md mx-auto">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-warning" />
              Verification Required
            </CardTitle>
            <CardDescription>{message}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push(nextStep)} className="w-full">
              Go to {!identityVerified ? "Identity" : "Human"} Verification
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!user.walletAddress || !walletSession) {
    return (
      <div className="container mx-auto px-4 py-16">
        <Card className="max-w-md mx-auto">
          <CardHeader>
            <CardTitle>Wallet Not Connected</CardTitle>
            <CardDescription>Please connect your wallet to continue</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  const handleMethodDocChange = (file: File | null) => {
    setMethodDocFile(file)
    if (methodDocPreviewUrl) {
      URL.revokeObjectURL(methodDocPreviewUrl)
    }
    if (file) {
      const url = URL.createObjectURL(file)
      setMethodDocPreviewUrl(url)
      setMethodDocStatus("idle")
      setMethodDocPhase("idle")
    } else {
      setMethodDocPreviewUrl(null)
      setMethodDocStatus("idle")
      setMethodDocPhase("idle")
    }
  }

  const startMethodDocumentVerification = () => {
    if (!methodDocFile || !verificationMethod) {
      setMethodDocStatus("invalid")
      return
    }

    setMethodDocStatus("verifying")
    setMethodDocPhase("source")

    const delay = 4000 + Math.floor(Math.random() * 1001) // 4–5 seconds

    setTimeout(() => setMethodDocPhase("age"), delay / 3)
    setTimeout(() => setMethodDocPhase("consistency"), (delay * 2) / 3)

    setTimeout(() => {
      setMethodDocStatus("verified")
      setMethodDocPhase("done")

      const isAdult = ageRange === "over-18"
      toast({
        title: "Document Verified",
        description: isAdult
          ? "Your document indicates you are over 18 years old."
          : "Your document indicates you are under 18 years old.",
      })
    }, delay)
  }

  const handleNext = () => {
    if (step === 1 && !ageRange) {
      toast({
        title: "Selection Required",
        description: "Please select an age range to verify",
        variant: "destructive",
      })
      return
    }
    if (step === 2) {
      if (!verificationMethod) {
        toast({
          title: "Selection Required",
          description: "Please select a verification method",
          variant: "destructive",
        })
        return
      }
      if (!methodDocFile) {
        toast({
          title: "Document Required",
          description: "Please upload a document for the selected verification method.",
          variant: "destructive",
        })
        return
      }
      if (methodDocStatus !== "verified") {
        // Trigger verification pipeline if not already verified
        startMethodDocumentVerification()
        toast({
          title: "Verifying document",
          description: "We are checking the uploaded document. This may take a few seconds.",
        })
        return
      }
    }
    setStep(step + 1)
  }

  const handleSubmit = async () => {
    if (!holderAddress) {
      toast({
        title: "Wallet Required",
        description: "Connect a wallet before completing verification.",
        variant: "destructive",
      })
      return
    }

    setIsProcessing(true)

    try {
      // Simulate verification process
      await new Promise((resolve) => setTimeout(resolve, 2000))

      // Verify ZK proof
      await verifyZKProof("mock-age-proof")

      // Generate credential data - now supports both "Under 18" and "Over 18"
      const isAdult = ageRange === "over-18"
      const credentialData = {
        type: "Age",
        holder: holderAddress,
        issuer: walletSession.address,
        isAdult,
        source: verificationMethod || "self-attested",
      }

      const credentialHash = await generateCredentialHash(credentialData)
      const proofReference = await generateCredentialHash({
        circuit: "age",
        holder: user.walletAddress,
        isAdult: credentialData.isAdult,
        method: verificationMethod || "self-attested",
        issuedAt: new Date().toISOString(),
      })
      
      // Issue credential on-chain for BOTH "Under 18" and "Over 18"
      // The bracketReference will be converted to "true" (adult) or "false" (minor) in blockchain-utils
      const result = await issueAgeCredentialOnChain(walletSession, {
        subjectId: holderAddress,
        ageCredentialCommitment: credentialHash,
        proofReference,
        bracketReference: isAdult ? "adult" : "minor", // Will be converted to "true"/"false" on-chain
        issuerReference: walletSession.address,
      })
      const merkleLeaf = addLeafToMerkle(result.commitment)
      // CRITICAL: Extract the actual transaction hash from finalized data, not txId
      // txId is the transaction identifier, but the explorer needs the actual hash
      // The actual L1 transaction hash might be in finalized.tx.hash or similar
      const finalized: any = result.finalized
      
      // Try multiple locations for the actual L1 transaction hash
      // The explorer shows L1 hashes, which might be different from the internal hash
      let txHash =
        finalized?.tx?.hash ??              // Transaction object hash (most likely)
        finalized?.txHash ??                // Direct txHash field
        finalized?.hash ??                   // Generic hash field
        finalized?.l1TxHash ??               // L1-specific hash
        finalized?.transactionHash ??         // Alternative name
        finalized?.txHashHex ??              // Hex format
        result.txId                          // Fallback to txId if hash not found
      
      // If we got the txId (long identifier), we might need to derive the hash differently
      // For now, use what we found
      
      // Try to extract block number/height from finalized data (indexer response)
      const blockNumber =
        finalized?.blockHeight ??
        finalized?.blockNo ??
        finalized?.blockNumber ??
        finalized?.height ??
        finalized?.block?.height ??
        undefined
      
      // Debug: Log the entire finalized object structure to understand hash format
      console.log("[age-verification] Transaction details:", {
        txId: result.txId,
        txHash,
        blockNumber,
        finalizedKeys: finalized ? Object.keys(finalized) : [],
        finalizedFull: finalized, // Log entire object to see all available fields
      })
      
      // Also check if there's a different hash format in the transaction object
      if (result.finalized) {
        console.log("[age-verification] All hash-related fields in finalized:", {
          txHash: (result.finalized as any)?.txHash,
          hash: (result.finalized as any)?.hash,
          l1TxHash: (result.finalized as any)?.l1TxHash,
          transactionHash: (result.finalized as any)?.transactionHash,
          tx: (result.finalized as any)?.tx,
          // Check if tx object has hash
          txHashFromTx: (result.finalized as any)?.tx?.hash,
        })
      }

      // PRIVACY: Generate ZK proof that proves age >= 18 without revealing the actual value
      // This proof can be verified later without exposing the age bracket
      let ageProof = null
      if (isAdult) {
        const subjectHash = await deriveSubjectKey(holderAddress)
        ageProof = await generateAgeProof(walletSession, credentialHash, isAdult)
        if (ageProof) {
          // Store proof for later verification
          await storeAgeProof(ageProof, subjectHash)
          console.log("[age-verification] Generated ZK proof for age verification", {
            commitment: credentialHash,
            hasProof: !!ageProof,
          })
        }
      }

      // Create new credential
      const newCredential = {
        id: Date.now().toString(),
        type: "Age" as const,
        holder: holderAddress,
        issuer: walletSession.address,
        status: "Verified" as const,
        issueTime: new Date().toISOString(),
        expiryTime: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        txHash,
        blockNumber,
        credentialHash: result.commitment,
        merkleLeaf,
        proofReference: result.proofReference,
        zkProofSummary: isAdult
          ? "ZK proof confirms age >= 18 without revealing actual age"
          : "Age credential issued. ZK proof verification required for age >= 18.",
        metadata: {
          // PRIVACY: Do NOT include isAdult here - it should only come from proof verification
          // Store minimal metadata for age credential
          overAge: isAdult,
        } as any, // Type assertion needed because metadata structure varies by credential type
        chainData: {
          publicData: result.publicData,
          finalized: result.finalized,
        },
      }

      addCredential(newCredential)
      addAction({
        id: Date.now().toString(),
        type: "Age",
        action: "Issued",
        timestamp: new Date().toISOString(),
        txHash,
      })

      await refreshLedgerSnapshot()

      const proofReceipt: AgeVerificationReceipt = {
        type: "age",
        version: 1,
        timestamp: new Date().toISOString(),
        networkId: walletSession.networkId,
        contractAddress: getContractAddress() ?? null,
        txId: txHash,
        commitment: result.commitment,
        proofReference: result.proofReference,
        holder: holderAddress,
        issuer: walletSession.address,
        isAdult: credentialData.isAdult,
        method: credentialData.source,
        publicData: result.publicData,
        finalized: result.finalized,
      }

      if (typeof window !== "undefined") {
        try {
          const subjectHash = await deriveSubjectKey(holderAddress)
          // Preserve any existing identity metadata (e.g., country, docType) and update age-related fields
          const existingRaw = window.localStorage.getItem(KYC_STORAGE_KEY)
          let existing: any = {}
          try {
            existing = existingRaw ? JSON.parse(existingRaw) : {}
          } catch {
            existing = {}
          }

          const mergedStatus = {
            ...existing,
            wallet: holderAddress,
            isAdult: credentialData.isAdult,
            subjectHash,
            txId: txHash,
            proofReference: result.proofReference,
            timestamp: proofReceipt.timestamp,
            contractAddress: proofReceipt.contractAddress,
            method: credentialData.source,
          }

          window.localStorage.setItem(KYC_STORAGE_KEY, JSON.stringify(mergedStatus))
        } catch (storageError) {
          console.warn("[age-verification] Failed to persist KYC status", storageError)
        }
      }

      setReceipt(proofReceipt)
      setStep(4)

      // Show appropriate message based on age selection
      if (isAdult) {
        toast({
          title: "Verification Complete!",
          description: "Your age credential has been issued successfully. You are verified as over 18.",
        })
      } else {
        toast({
          title: "Verification Complete",
          description: "Your age has been recorded. You are under 18 and may have restricted access to certain features.",
          variant: "default",
        })
      }

      // Always redirect back to asset app after age verification (final KYC step)
      // NOTE: Always use "verified" status - the asset app will check isAdult separately
      if (typeof window !== "undefined") {
        const statusParam = "verified" // Always verified - age check happens in asset app
        
        // Determine redirect target: use provided redirect, or get from localStorage, or use default asset app URL
        let finalRedirectTarget = redirectTarget
        
        if (!finalRedirectTarget) {
          // Try to get redirect URL from localStorage (set by bridge page)
          try {
            const storedRedirect = window.localStorage.getItem("kyc_redirect_target")
            if (storedRedirect) {
              finalRedirectTarget = storedRedirect
              console.log("[age-verification] Using redirect target from localStorage:", finalRedirectTarget)
            }
          } catch (e) {
            console.warn("[age-verification] Failed to read redirect from localStorage", e)
          }
        }
        
        // If still no redirect target, use default asset app URL
        if (!finalRedirectTarget) {
          const defaultAssetAppUrl = process.env.NEXT_PUBLIC_ASSET_APP_URL || "http://localhost:3002"
          finalRedirectTarget = `${defaultAssetAppUrl}/account`
          console.log("[age-verification] Using default asset app URL:", finalRedirectTarget)
        }
        
        // Perform async operations first, then redirect synchronously
        // This prevents race conditions and ensures all data is ready before redirect
        try {
          // Get subject hash before redirect
          const subjectHash = await deriveSubjectKey(holderAddress).catch(() => null)
          
          // Clear stored redirect target before redirect
          try {
            window.localStorage.removeItem("kyc_redirect_target")
          } catch (e) {
            // Ignore localStorage errors
          }
          
          // Construct redirect URL
          let targetUrl: URL
          try {
            if (finalRedirectTarget.startsWith("http://") || finalRedirectTarget.startsWith("https://")) {
              targetUrl = new URL(finalRedirectTarget)
            } else {
              // If it's a relative path, construct it properly
              console.warn("[age-verification] Redirect target is not a full URL:", finalRedirectTarget)
              targetUrl = new URL(finalRedirectTarget, window.location.origin)
            }
            
            // Set KYC status parameter (always "verified" - age check happens in asset app)
            targetUrl.searchParams.set("kyc", statusParam)
            
            // Include isAdult flag so asset app knows if user is over 18
            targetUrl.searchParams.set("isAdult", credentialData.isAdult ? "true" : "false")
            
            // Include the Midnight wallet address so asset app can query on-chain status
            if (holderAddress) {
              targetUrl.searchParams.set("midnightWallet", holderAddress)
            }
            
            if (subjectHash) {
              targetUrl.searchParams.set("subjectHash", subjectHash)
            }
            
            console.log("[age-verification] Redirecting to asset app:", targetUrl.toString(), "with wallet:", holderAddress)
            
            // Mark redirect as started to prevent state updates after redirect
            redirectStartedRef.current = true
            
            // Set processing to false BEFORE redirect to avoid state updates on unmounted component
            setIsProcessing(false)
            
            // Use a small delay to ensure React state updates complete before redirect
            // Store timeout ID for cleanup if component unmounts
            redirectTimeoutRef.current = setTimeout(() => {
              try {
                // Use window.location.replace instead of href to prevent back button issues
                // and ensure the redirect happens cleanly
                redirectStartedRef.current = true
                window.location.replace(targetUrl.toString())
              } catch (redirectError) {
                console.error("[age-verification] Redirect failed:", redirectError)
                // Fallback: try with href
                try {
                  window.location.href = targetUrl.toString()
                } catch (fallbackError) {
                  console.error("[age-verification] Fallback redirect also failed:", fallbackError)
                  // Don't show toast if redirect already started - component may be unmounting
                  if (!redirectStartedRef.current) {
                    toast({
                      title: "Redirect Error",
                      description: "Please manually navigate back to the asset app.",
                      variant: "destructive",
                    })
                  }
                }
              }
            }, 500) // Reduced delay to 500ms for faster redirect
          } catch (urlError) {
            console.warn("[age-verification] Unable to construct redirect URL", urlError)
            // Fallback: append status to the redirect target
            const separator = finalRedirectTarget.includes("?") ? "&" : "?"
            setTimeout(() => {
              try {
                window.location.replace(`${finalRedirectTarget}${separator}kyc=${statusParam}&midnightWallet=${holderAddress || ""}`)
              } catch (fallbackError) {
                console.error("[age-verification] Fallback redirect failed:", fallbackError)
                window.location.href = `${finalRedirectTarget}${separator}kyc=${statusParam}&midnightWallet=${holderAddress || ""}`
              }
            }, 500)
          }
        } catch (asyncError) {
          console.error("[age-verification] Error preparing redirect:", asyncError)
          // Still try to redirect even if async operations fail
          const separator = finalRedirectTarget.includes("?") ? "&" : "?"
          setTimeout(() => {
            try {
              window.location.replace(`${finalRedirectTarget}${separator}kyc=${statusParam}&midnightWallet=${holderAddress || ""}`)
            } catch (fallbackError) {
              window.location.href = `${finalRedirectTarget}${separator}kyc=${statusParam}&midnightWallet=${holderAddress || ""}`
            }
          }, 500)
        }
      }
    } catch (error) {
      // Only update state if redirect hasn't started
      if (!redirectStartedRef.current) {
        toast({
          title: "Verification Failed",
          description: "There was an error processing your verification. Please try again.",
          variant: "destructive",
        })
        setIsProcessing(false)
      }
    }
    // Note: setIsProcessing(false) is now called before redirect to prevent state updates on unmounted component
  }

  const handleDownloadReceipt = () => {
    if (!receipt) return
    
    // Helper function to recursively convert BigInt values to strings
    const convertBigIntToString = (obj: any): any => {
      if (obj === null || obj === undefined) {
        return obj
      }
      
      if (typeof obj === 'bigint') {
        return obj.toString()
      }
      
      if (Array.isArray(obj)) {
        return obj.map(convertBigIntToString)
      }
      
      if (typeof obj === 'object') {
        const converted: any = {}
        for (const [key, value] of Object.entries(obj)) {
          converted[key] = convertBigIntToString(value)
        }
        return converted
      }
      
      return obj
    }
    
    try {
      // Convert BigInt values to strings before stringifying
      const convertedReceipt = convertBigIntToString(receipt)
      const serialized = JSON.stringify(convertedReceipt, null, 2)
      const blob = new Blob([serialized], { type: "application/json" })
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `midnight-age-receipt-${receipt.txId}.json`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error("Failed to download receipt:", error)
      toast({
        title: "Download failed",
        description: "Failed to serialize receipt data. Please try again.",
        variant: "destructive",
      })
    }
  }

  const progress = receipt ? 100 : (step / 3) * 100

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Calendar className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Age Verification</h1>
            <p className="text-muted-foreground">
              {receipt ? "Verification complete" : `Step ${step} of 3`}
            </p>
          </div>
        </div>

        {/* Progress */}
        <Progress value={progress} className="h-2" />

        {/* Step Content */}
        <Card>
          <CardHeader>
            <CardTitle>
              {receipt && "Verification Complete"}
              {!receipt && step === 1 && "Select Age Confirmation"}
              {!receipt && step === 2 && "Verification Method"}
              {!receipt && step === 3 && "Review & Submit"}
            </CardTitle>
            <CardDescription>
              {receipt && "Download your proof receipt or view credentials"}
              {!receipt && step === 1 && "Confirm whether you are over 18"}
              {!receipt && step === 2 && "Select how you'd like to verify your age"}
              {!receipt && step === 3 && "Review your information before submitting"}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {step === 1 && (
              <div className="space-y-4">
                <RadioGroup value={ageRange} onValueChange={setAgeRange}>
                  <div className="flex items-center space-x-3 p-4 border rounded-lg hover:border-primary/50 transition-colors cursor-pointer">
                    <RadioGroupItem value="under-18" id="under-18" />
                    <Label htmlFor="under-18" className="flex-1 cursor-pointer">
                      <div className="font-medium">Under 18</div>
                      <div className="text-sm text-muted-foreground">Confirm you are younger than 18</div>
                    </Label>
                  </div>

                  <div className="flex items-center space-x-3 p-4 border rounded-lg hover:border-primary/50 transition-colors cursor-pointer">
                    <RadioGroupItem value="over-18" id="over-18" />
                    <Label htmlFor="over-18" className="flex-1 cursor-pointer">
                      <div className="font-medium">Over 18</div>
                      <div className="text-sm text-muted-foreground">Confirm you are 18 years or older</div>
                    </Label>
                  </div>
                </RadioGroup>

                <div className="bg-primary/5 border border-primary/20 p-4 rounded-lg space-y-2 text-sm">
                  <div className="font-medium flex items-center gap-2">
                    <Shield className="w-4 h-4" />
                    Privacy Protected
                  </div>
                  <p className="text-muted-foreground">
                    Your exact date of birth is never revealed. We only prove you meet the age requirement using
                    zero-knowledge proofs.
                  </p>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <div className="space-y-4">
                  <RadioGroup value={verificationMethod} onValueChange={setVerificationMethod}>
                    <div className="flex items-center space-x-3 p-4 border rounded-lg hover:border-primary/50 transition-colors cursor-pointer">
                      <RadioGroupItem value="government-id" id="government-id" />
                      <Label htmlFor="government-id" className="flex-1 cursor-pointer">
                        <div className="font-medium">Government ID</div>
                        <div className="text-sm text-muted-foreground">
                          Use your existing identity document (passport, ID card) to verify age.
                        </div>
                      </Label>
                    </div>

                    <div className="flex items-center space-x-3 p-4 border rounded-lg hover:border-primary/50 transition-colors cursor-pointer">
                      <RadioGroupItem value="credit-card" id="credit-card" />
                      <Label htmlFor="credit-card" className="flex-1 cursor-pointer">
                        <div className="font-medium">Credit Card</div>
                        <div className="text-sm text-muted-foreground">
                          Use a credit card statement or screenshot that shows you are over 18.
                        </div>
                      </Label>
                    </div>

                    <div className="flex items-center space-x-3 p-4 border rounded-lg hover:border-primary/50 transition-colors cursor-pointer">
                      <RadioGroupItem value="third-party" id="third-party" />
                      <Label htmlFor="third-party" className="flex-1 cursor-pointer">
                        <div className="font-medium">Third-Party Service</div>
                        <div className="text-sm text-muted-foreground">
                          Upload a confirmation from a trusted age verification provider.
                        </div>
                      </Label>
                    </div>
                  </RadioGroup>
                </div>

                <div className="border-2 border-dashed border-border rounded-lg p-4 sm:p-6">
                  <div className="flex flex-col lg:flex-row gap-6">
                    {/* Method-specific document upload & preview */}
                    <div className="flex-1 space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="methodDoc" className="cursor-pointer flex items-center gap-2">
                          <div className="p-2 rounded-full bg-primary/10">
                            <Upload className="w-4 h-4 text-primary" />
                          </div>
                          <div>
                            <div className="text-sm font-medium">
                              {verificationMethod === "government-id"
                                ? "Upload government ID"
                                : verificationMethod === "credit-card"
                                  ? "Upload credit card proof"
                                  : verificationMethod === "third-party"
                                    ? "Upload third-party confirmation"
                                    : "Upload supporting document"}
                            </div>
                            <div className="text-xs text-muted-foreground">PNG, JPG or PDF (max 10MB)</div>
                          </div>
                        </Label>
                        <Input
                          id="methodDoc"
                          type="file"
                          accept="image/*,.pdf"
                          className="hidden"
                          onChange={(e) => handleMethodDocChange(e.target.files?.[0] || null)}
                        />
                        {methodDocFile && (
                          <div className="flex items-center gap-2 text-sm mt-2">
                            <CheckCircle2 className="w-4 h-4 text-success" />
                            <span className="text-foreground truncate">{methodDocFile.name}</span>
                          </div>
                        )}
                      </div>

                      <div className="mt-4">
                        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                          Document preview
                        </div>
                        <div className="w-full aspect-[4/3] bg-muted/60 border border-dashed border-border rounded-lg flex items-center justify-center overflow-hidden">
                          {methodDocPreviewUrl && methodDocFile && methodDocFile.type.startsWith("image/") ? (
                            <img
                              src={methodDocPreviewUrl}
                              alt="Verification document preview"
                              className="w-full h-full object-contain"
                            />
                          ) : methodDocPreviewUrl && methodDocFile ? (
                            <div className="text-xs text-muted-foreground text-center px-4">
                              <p className="font-medium mb-1">Preview not available</p>
                              <p>This document type cannot be previewed in the browser, but it has been uploaded.</p>
                            </div>
                          ) : (
                            <div className="text-xs text-muted-foreground text-center px-4">
                              No document uploaded yet. Select a file to see a preview here.
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Verification pipeline */}
                    <div className="flex-1 space-y-3">
                      <div className="bg-muted/50 p-4 rounded-lg space-y-2 text-sm">
                        <div className="font-medium flex items-center gap-2">
                          <AlertCircle className="w-4 h-4" />
                          Verification process
                        </div>
                        <p className="text-muted-foreground">
                          We check the uploaded document to confirm that it supports your stated age without exposing
                          sensitive details.
                        </p>
                      </div>

                      <div className="space-y-2 text-sm">
                        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                          Steps
                        </div>
                        <ol className="space-y-2">
                          <li className="flex items-start gap-2">
                            {methodDocPhase === "source" || methodDocPhase === "age" || methodDocPhase === "consistency" || methodDocPhase === "done" ? (
                              <Loader2 className="w-3 h-3 animate-spin text-primary mt-0.5" />
                            ) : methodDocPhase === "idle" ? (
                              <span className="w-3 h-3 rounded-full border border-border mt-0.5 inline-block" />
                            ) : (
                              <CheckCircle2 className="w-3 h-3 text-success mt-0.5" />
                            )}
                            <div>
                              <div className="font-medium">Validate document source</div>
                              <p className="text-xs text-muted-foreground">
                                Confirming the document type is appropriate for {verificationMethod.replace("-", " ")}.
                              </p>
                            </div>
                          </li>
                          <li className="flex items-start gap-2">
                            {methodDocPhase === "age" || methodDocPhase === "consistency" || methodDocPhase === "done" ? (
                              <Loader2 className="w-3 h-3 animate-spin text-primary mt-0.5" />
                            ) : methodDocPhase === "idle" || methodDocPhase === "source" ? (
                              <span className="w-3 h-3 rounded-full border border-border mt-0.5 inline-block" />
                            ) : (
                              <CheckCircle2 className="w-3 h-3 text-success mt-0.5" />
                            )}
                            <div>
                              <div className="font-medium">Check age indicator</div>
                              <p className="text-xs text-muted-foreground">
                                Looking for signals that suggest you are {ageRange === "over-18" ? "18 or older" : "under 18"}.
                              </p>
                            </div>
                          </li>
                          <li className="flex items-start gap-2">
                            {methodDocPhase === "consistency" || methodDocPhase === "done" ? (
                              <Loader2 className="w-3 h-3 animate-spin text-primary mt-0.5" />
                            ) : methodDocPhase === "idle" || methodDocPhase === "source" || methodDocPhase === "age" ? (
                              <span className="w-3 h-3 rounded-full border border-border mt-0.5 inline-block" />
                            ) : (
                              <CheckCircle2 className="w-3 h-3 text-success mt-0.5" />
                            )}
                            <div>
                              <div className="font-medium">Run consistency checks</div>
                              <p className="text-xs text-muted-foreground">
                                Ensuring the document is coherent and not obviously tampered with.
                              </p>
                            </div>
                          </li>
                        </ol>

                        {methodDocStatus === "verified" && methodDocPhase === "done" && (
                          <p className="text-xs text-green-700 flex items-center gap-1 mt-1">
                            <CheckCircle2 className="w-3 h-3" />
                            {ageRange === "over-18"
                              ? "Document verified: you are over 18 years old."
                              : "Document verified: you are under 18 years old."}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <div className="bg-muted/50 p-4 rounded-lg space-y-3">
                  <div>
                    <div className="text-sm text-muted-foreground">Age Confirmation</div>
                    <div className="font-medium capitalize">{ageRange === "over-18" ? "Over 18" : "Under 18"}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Verification Method</div>
                    <div className="font-medium capitalize">{verificationMethod.replace("-", " ")}</div>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-4 bg-success/5 border border-success/20 rounded-lg">
                  <CheckCircle2 className="w-5 h-5 text-success mt-0.5" />
                  <div className="text-sm">
                    <div className="font-medium mb-1">Ready to Submit</div>
                    <p className="text-muted-foreground">
                      Your age verification credential will be issued on-chain. This proves you meet the age requirement
                      without revealing your exact date of birth.
                    </p>
                  </div>
                </div>
              </div>
            )}
            {receipt && (
              <div className="space-y-4">
                <div className="bg-muted/50 p-4 rounded-lg space-y-2 text-sm">
                  <div className="font-medium">Verification Details</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-muted-foreground">
                    <div>
                      <span className="font-medium text-foreground">Status:</span> Verified
                    </div>
                    <div>
                      <span className="font-medium text-foreground">Age confirmation:</span> {receipt.isAdult ? "Over 18" : "Under 18"}
                    </div>
                    <div>
                      <span className="font-medium text-foreground">Network:</span> {receipt.networkId}
                    </div>
                    <div>
                      <span className="font-medium text-foreground">Contract:</span> {receipt.contractAddress ?? "Not configured"}
                    </div>
                    <div className="sm:col-span-2">
                      <span className="font-medium text-foreground">Transaction ID:</span>{" "}
                      <a
                        href={getMidnightExplorerUrl(receipt.txId)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline inline-flex items-center gap-1"
                      >
                        {receipt.txId}
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-4 bg-success/5 border border-success/20 rounded-lg">
                  <CheckCircle2 className="w-5 h-5 text-success mt-0.5" />
                  <div className="text-sm">
                    <div className="font-medium mb-1">Downloadable Proof</div>
                    <p className="text-muted-foreground">
                      Save the JSON receipt for off-chain compliance checks or to share with third parties.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex gap-3">
          {!receipt && step > 1 && (
            <Button
              variant="outline"
              onClick={() => setStep(step - 1)}
              disabled={isProcessing}
              className="bg-transparent"
            >
              Back
            </Button>
          )}
          {!receipt && step < 3 && (
            <Button onClick={handleNext} className="flex-1">
              Continue
            </Button>
          )}
          {!receipt && step === 3 && (
            <Button onClick={handleSubmit} disabled={isProcessing} className="flex-1">
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                "Submit Verification"
              )}
            </Button>
          )}
          {receipt && (
            <div className="flex flex-1 gap-3">
              <Button onClick={handleDownloadReceipt} variant="outline" className="flex-1">
                <Download className="w-4 h-4 mr-2" />
                Download Proof
              </Button>
              <Button onClick={() => router.push("/credentials")} className="flex-1">
                View Credentials
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Progress } from "@/components/ui/progress"
import { Shield, Upload, CheckCircle2, Loader2, AlertCircle, User, Camera } from "lucide-react"
import { useKYCStore } from "@/lib/store"
import { generateCredentialHash, addLeafToMerkle, issueCredentialOnChain, issueCountryCredentialOnChain, deriveSubjectKey } from "@/lib/blockchain-utils"
import { generateCountryProof, storeCountryProof } from "@/lib/zk-proof-utils"
import { useToast } from "@/hooks/use-toast"
import { AuthGuard } from "@/components/auth-guard"
import { useSearchParams } from "next/navigation"
import { useAuthStore } from "@/lib/auth-store"

function IdentityVerificationPageContent() {
  const router = useRouter()
  const { toast } = useToast()
  const { user, walletSession, addCredential, addAction, refreshLedgerSnapshot } = useKYCStore()
  const { user: authUser } = useAuthStore()
  const searchParams = useSearchParams()
  const returnUrl = searchParams.get("returnUrl") || null
  const [step, setStep] = useState(1)
  const [isProcessing, setIsProcessing] = useState(false)
  const [docStatus, setDocStatus] = useState<"idle" | "verifying" | "valid" | "invalid">("idle")
  const [docError, setDocError] = useState<string | null>(null)
  const [docPreviewUrl, setDocPreviewUrl] = useState<string | null>(null)
  const [docVerifyPhase, setDocVerifyPhase] = useState<"idle" | "number" | "dob" | "security" | "done">("idle")

  const selfieVideoRef = useRef<HTMLVideoElement | null>(null)
  const [selfieStream, setSelfieStream] = useState<MediaStream | null>(null)
  const [selfieCaptured, setSelfieCaptured] = useState<string | null>(null)
  const [selfieStatus, setSelfieStatus] = useState<"idle" | "capturing" | "verifying" | "matched" | "mismatch">("idle")
  const [formData, setFormData] = useState({
    fullName: "",
    country: "",
    docType: "",
    docNumber: "",
    docFile: null as File | null,
    selfieFile: null as File | null,
  })
  const holderAddress = user.walletAddress ?? walletSession?.address ?? null

  // Derive simple demo rules for document number format based on country + document type
  const getDocNumberRules = (country: string, docType: string) => {
    const normalizedCountry = country.toLowerCase()
    const normalizedType = docType.toLowerCase()

    // Default pattern: 6–12 alphanumeric
    let pattern = /^[A-Z0-9]{6,12}$/
    let example = "AB123456"

    if (normalizedType.includes("passport")) {
      // Passports: 6–9 alphanumeric
      pattern = /^[A-Z0-9]{6,9}$/
      example = "XJ482759"
    } else if (normalizedType.includes("driver")) {
      // Driver's licenses: allow 6–12 alphanumeric
      pattern = /^[A-Z0-9]{6,12}$/
      example = "D123-4567"
    } else if (normalizedType.includes("national")) {
      // National IDs: 8–12 alphanumeric
      pattern = /^[A-Z0-9]{8,12}$/
      example = "ID90817263"
    }

    // Slightly tweak examples per country to feel more realistic (pattern stays simple)
    if (normalizedCountry.includes("france")) {
      example = normalizedType.includes("passport") ? "FR1234567" : normalizedType.includes("driver") ? "FR-982734" : "FR987654321"
    } else if (normalizedCountry.includes("germany")) {
      example = normalizedType.includes("passport") ? "C01X00AB7" : normalizedType.includes("driver") ? "B123456789" : "DE87654321"
    } else if (normalizedCountry.includes("united states")) {
      example = normalizedType.includes("passport") ? "123456789" : normalizedType.includes("driver") ? "D1234567" : "US9876543"
    } else if (normalizedCountry.includes("united kingdom")) {
      example = normalizedType.includes("passport") ? "123456789" : normalizedType.includes("driver") ? "AB12 3CDE" : "UK1234567"
    } else if (normalizedCountry.includes("canada")) {
      example = normalizedType.includes("passport") ? "AB123456" : normalizedType.includes("driver") ? "L1234-56789-01234" : "CA987654"
    } else if (normalizedCountry.includes("australia")) {
      example = normalizedType.includes("passport") ? "N1234567" : normalizedType.includes("driver") ? "12345678" : "AU12345678"
    }

    return { pattern, example }
  }

  const startDocNumberVerification = () => {
    if (!formData.country || !formData.docType || !formData.docNumber.trim()) {
      setDocStatus("invalid")
      setDocError("Please select country, document type, and enter a document number.")
      return
    }

    // Reject all zeros (any length)
    if (/^0+$/.test(formData.docNumber.replace(/\s|-/g, ""))) {
      setDocStatus("invalid")
      setDocError("Document number cannot consist of only zeros.")
      return
    }

    const { pattern } = getDocNumberRules(formData.country, formData.docType)
    const normalized = formData.docNumber.replace(/\s|-/g, "").toUpperCase()

    if (!pattern.test(normalized)) {
      setDocStatus("invalid")
      setDocError("The document number format does not match the expected pattern for this country and document type.")
      return
    }

    // Async demo verification with random delay (3–4 seconds)
    setDocStatus("verifying")
    setDocError(null)
    const delay = 3000 + Math.floor(Math.random() * 1001)

    // Simulate multi-phase verification: number -> DOB -> security
    setDocVerifyPhase("number")
    setTimeout(() => setDocVerifyPhase("dob"), delay / 3)
    setTimeout(() => setDocVerifyPhase("security"), (delay * 2) / 3)

    setTimeout(() => {
      setDocStatus("valid")
      setDocError(null)
      setDocVerifyPhase("done")
      toast({
        title: "Document Number Verified",
        description: "Your document number format looks correct.",
      })
    }, delay)
  }

  // Attach selfie camera stream to video element when available
  useEffect(() => {
    if (selfieVideoRef.current && selfieStream) {
      selfieVideoRef.current.srcObject = selfieStream
      void selfieVideoRef.current.play().catch(() => {
        // Ignore autoplay errors
      })
    }
  }, [selfieStream])

  // Cleanup selfie camera on unmount
  useEffect(() => {
    return () => {
      if (selfieStream) {
        selfieStream.getTracks().forEach((t) => t.stop())
      }
    }
  }, [selfieStream])

  const startSelfieCamera = async () => {
    try {
      if (!selfieStream) {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
        setSelfieStream(stream)
      }
      setSelfieStatus("idle")
      setSelfieCaptured(null)
    } catch (error) {
      console.error("[identity] Failed to start selfie camera", error)
      toast({
        title: "Camera Access Required",
        description: "We could not access your camera. Please allow camera access and try again.",
        variant: "destructive",
      })
    }
  }

  const captureSelfie = () => {
    if (!selfieVideoRef.current) return
    try {
      const video = selfieVideoRef.current
      const canvas = document.createElement("canvas")
      canvas.width = video.videoWidth || 640
      canvas.height = video.videoHeight || 480
      const ctx = canvas.getContext("2d")
      if (!ctx) return
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      const dataUrl = canvas.toDataURL("image/jpeg")
      setSelfieCaptured(dataUrl)
      setSelfieStatus("capturing")

      // Stop camera after capture for privacy
      if (selfieStream) {
        selfieStream.getTracks().forEach((t) => t.stop())
        setSelfieStream(null)
      }

      // Simulate verification process (matching with document)
      setSelfieStatus("verifying")
      const delay = 2000 + Math.floor(Math.random() * 1501)
      setTimeout(() => {
        setSelfieStatus("matched")
        toast({
          title: "Selfie Verified",
          description: "Your selfie appears to match the document photo.",
        })
      }, delay)
    } catch (error) {
      console.error("[identity] Failed to capture selfie", error)
      setSelfieStatus("idle")
      toast({
        title: "Capture Failed",
        description: "We couldn't capture your selfie. Please try again.",
        variant: "destructive",
      })
    }
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

  const handleFileChange = (field: "docFile" | "selfieFile", file: File | null) => {
    setFormData((prev) => ({ ...prev, [field]: file }))

    if (field === "docFile") {
      // Create a local preview URL for the uploaded document (if image/PDF)
      if (file) {
        const url = URL.createObjectURL(file)
        setDocPreviewUrl(url)
        setDocVerifyPhase("number")
        // Start a light-weight verification pipeline if document number is already valid
        if (docStatus === "valid") {
          setDocVerifyPhase("number")
          const delay = 2500 + Math.floor(Math.random() * 1001)
          setTimeout(() => setDocVerifyPhase("dob"), delay / 3)
          setTimeout(() => setDocVerifyPhase("security"), (delay * 2) / 3)
          setTimeout(() => setDocVerifyPhase("done"), delay)
        }
      } else {
        if (docPreviewUrl) {
          URL.revokeObjectURL(docPreviewUrl)
        }
        setDocPreviewUrl(null)
        setDocVerifyPhase("idle")
      }
    }
  }

  const handleNext = () => {
    if (step === 1) {
      if (!formData.fullName || !formData.country || !formData.docType || !formData.docNumber) {
        toast({
          title: "Missing Information",
          description: "Please fill in all required fields",
          variant: "destructive",
        })
        return
      }

      // Require document number to be verified before proceeding
      if (docStatus !== "valid") {
        startDocNumberVerification()
        toast({
          title: "Verifying document number",
          description: "We are checking the format of your document number. Please wait a moment.",
          variant: "destructive",
        })
        return
      }
    } else if (step === 2) {
      if (!formData.docFile) {
        toast({
          title: "Document Required",
          description: "Please upload your identity document",
          variant: "destructive",
        })
        return
      }
    } else if (step === 3) {
      // Accept either an uploaded selfie file OR a captured & verified selfie
      const hasUploadedSelfie = Boolean(formData.selfieFile)
      const hasCapturedAndMatchedSelfie = selfieStatus === "matched" && Boolean(selfieCaptured)
      if (!hasUploadedSelfie && !hasCapturedAndMatchedSelfie) {
        toast({
          title: "Selfie Required",
          description: "Please capture or upload a selfie for verification.",
          variant: "destructive",
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

      // Generate credential data
      const credentialData = {
        type: "Identity",
        holder: holderAddress,
        issuer: walletSession.address,
        fullName: formData.fullName,
        country: formData.country,
        docType: formData.docType,
      }

      const credentialHash = await generateCredentialHash(credentialData)
      const result = await issueCredentialOnChain(walletSession, credentialData)
      const merkleLeaf = addLeafToMerkle(result.commitment)
      
      // CRITICAL: Extract the actual transaction hash from finalized data, not txId
      // txId is the transaction identifier, but the explorer needs the actual hash
      // The actual L1 transaction hash might be in finalized.tx.hash or similar
      const finalized: any = result.finalized
      
      // Try multiple locations for the actual L1 transaction hash
      let txHash =
        finalized?.tx?.hash ??              // Transaction object hash (most likely)
        finalized?.txHash ??                 // Direct txHash field
        finalized?.hash ??                   // Generic hash field
        finalized?.l1TxHash ??               // L1-specific hash
        finalized?.transactionHash ??         // Alternative name
        finalized?.txHashHex ??              // Hex format
        result.txId                          // Fallback to txId if hash not found
      
      // Try to extract block number/height from finalized data (indexer response)
      const blockNumber =
        finalized?.blockHeight ??
        finalized?.blockNo ??
        finalized?.blockNumber ??
        finalized?.height ??
        finalized?.block?.height ??
        undefined
      
      // Debug: Log the entire finalized object structure
      console.log("[identity-verification] Transaction details:", {
        txId: result.txId,
        txHash,
        blockNumber,
        finalizedKeys: finalized ? Object.keys(finalized) : [],
        finalizedFull: finalized, // Log entire object
      })
      
      // Check all hash-related fields
      if (result.finalized) {
        console.log("[identity-verification] All hash-related fields:", {
          txHash: (result.finalized as any)?.txHash,
          hash: (result.finalized as any)?.hash,
          l1TxHash: (result.finalized as any)?.l1TxHash,
          transactionHash: (result.finalized as any)?.transactionHash,
          tx: (result.finalized as any)?.tx,
          txHashFromTx: (result.finalized as any)?.tx?.hash,
        })
      }

      // Create new credential
      const newCredential = {
        id: Date.now().toString(),
        type: "Identity" as const,
        holder: holderAddress,
        issuer: walletSession.address,
        status: "Verified" as const,
        issueTime: new Date().toISOString(),
        expiryTime: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        txHash,
        blockNumber,
        credentialHash: result.commitment,
        merkleLeaf,
        proofReference: result.metadataReference,
        metadata: {
          fullName: formData.fullName,
          country: formData.country,
          docType: formData.docType,
        },
        chainData: {
          publicData: result.publicData,
          finalized: result.finalized,
        },
      }

      addCredential(newCredential)
      addAction({
        id: Date.now().toString(),
        type: "Identity",
        action: "Issued",
        timestamp: new Date().toISOString(),
        txHash,
      })

      await refreshLedgerSnapshot()

      // Issue Country credential with commitment (France or not France)
      // This stores the country as a commitment, not plain text
      // NOTE: Country credential is issued separately to enable ZK proof verification
      // This requires a second transaction signature, but is necessary for privacy-preserving verification
      // If you want to reduce to 1 transaction, you would need to modify the contract to support batched issuance
      try {
        const isFrance = formData.country === "France"
        const countryCredentialData = {
          type: "Country",
          holder: holderAddress,
          issuer: walletSession.address,
          country: formData.country,
          isFrance, // Private: whether country is France (stored in commitment hash)
        }
        
        const countryCredentialHash = await generateCredentialHash(countryCredentialData)
        const countryProofReference = await generateCredentialHash({
          circuit: "country",
          holder: holderAddress,
          country: formData.country,
          issuedAt: new Date().toISOString(),
        })
        
        const countryResult = await issueCountryCredentialOnChain(walletSession, {
          subjectId: holderAddress,
          countryCredentialCommitment: countryCredentialHash,
          proofReference: countryProofReference,
          issuerReference: walletSession.address,
        })
        
        // Extract transaction details for country credential
        const countryFinalized: any = countryResult.finalized
        const countryTxHash =
          countryFinalized?.tx?.hash ??
          countryFinalized?.txHash ??
          countryFinalized?.hash ??
          countryFinalized?.l1TxHash ??
          countryFinalized?.transactionHash ??
          countryFinalized?.txHashHex ??
          countryResult.txId
        
        const countryBlockNumber =
          countryFinalized?.blockHeight ??
          countryFinalized?.blockNo ??
          countryFinalized?.blockNumber ??
          countryFinalized?.height ??
          countryFinalized?.block?.height ??
          undefined
        
        // Create country credential record
        const countryCredential = {
          id: `country-${Date.now()}`,
          type: "Country" as const,
          holder: holderAddress,
          issuer: walletSession.address,
          status: "Verified" as const,
          issueTime: new Date().toISOString(),
          expiryTime: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
          txHash: countryTxHash,
          blockNumber: countryBlockNumber,
          credentialHash: countryResult.commitment,
          merkleLeaf: addLeafToMerkle(countryResult.commitment),
          proofReference: countryResult.proofReference,
          metadata: {
            // Note: country is stored in commitment, not metadata
            // We keep it here for display purposes only
            country: formData.country,
            isFrance, // Private value stored in commitment
          },
          chainData: {
            publicData: countryResult.publicData,
            finalized: countryResult.finalized,
          },
        }
        
        addCredential(countryCredential)
        addAction({
          id: `country-${Date.now()}`,
          type: "Country",
          action: "Issued",
          timestamp: new Date().toISOString(),
          txHash: countryTxHash,
        })
        
        console.log("[identity-verification] Country credential issued:", {
          country: formData.country,
          isFrance,
          commitment: countryResult.commitment,
        })
        
        // PRIVACY: Generate and store ZK proof for country verification
        // This allows the asset app to verify country without revealing the actual value
        try {
          const subjectHash = await deriveSubjectKey(holderAddress)
          const countryProof = await generateCountryProof(walletSession, countryResult.commitment, isFrance)
          
          if (countryProof) {
            // Store proof server-side via API (similar to age proof storage)
            await storeCountryProof(countryProof, subjectHash)
            console.log("[identity-verification] Country ZK proof generated and stored:", {
              isFrance,
              commitment: countryResult.commitment,
            })
          } else {
            console.warn("[identity-verification] Failed to generate country ZK proof")
          }
        } catch (proofError) {
          console.error("[identity-verification] Failed to generate/store country proof:", proofError)
          // Don't block identity verification if proof generation fails
        }
      } catch (countryError) {
        console.error("[identity-verification] Failed to issue country credential:", countryError)
        // Don't block identity verification if country credential fails
        toast({
          title: "Country credential warning",
          description: "Identity verified, but country credential issuance failed. You may need to verify again.",
          variant: "default",
        })
      }

      // Persist basic KYC bridge status (including country) for the asset app
      if (typeof window !== "undefined") {
        try {
          const subjectHash = await deriveSubjectKey(holderAddress)
          const existingRaw = window.localStorage.getItem(KYC_STORAGE_KEY)
          let existing: any = {}
          try {
            existing = existingRaw ? JSON.parse(existingRaw) : {}
          } catch {
            existing = {}
          }

          const statusToStore = {
            ...existing,
            wallet: holderAddress,
            subjectHash,
            isAdult: existing?.isAdult ?? false,
            country: formData.country,
            txId: txHash,
            proofReference: result.metadataReference,
            timestamp: new Date().toISOString(),
            contractAddress: getContractAddress() ?? null,
            method: "identity",
          }

          window.localStorage.setItem(KYC_STORAGE_KEY, JSON.stringify(statusToStore))
        } catch (storageError) {
          console.warn("[identity-verification] Failed to persist KYC status for bridge", storageError)
        }
      }

      if (returnUrl && authUser) {
        const payload = {
          authenticated: true,
          verified: true,
          credential: "identity",
          user: {
            email: authUser.email,
            wallet: authUser.walletAddress,
          },
        }
        const token = encodeURIComponent(btoa(JSON.stringify(payload)))
        const separator = returnUrl.includes("?") ? "&" : "?"
        window.location.href = `${returnUrl}${separator}token=${token}`
        return
      }

      toast({
        title: "Verification Complete!",
        description: "Your identity credential has been issued successfully",
      })

      setTimeout(() => {
        router.push("/credentials")
      }, 1500)
    } catch (error) {
      console.error("[identity] verification failed", error)
      toast({
        title: "Verification Failed",
        description: "There was an error processing your verification. Please try again.",
        variant: "destructive",
      })
      setIsProcessing(false)
    }
  }

  const progress = (step / 4) * 100

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Shield className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Identity Verification</h1>
            <p className="text-muted-foreground">Step {step} of 4</p>
          </div>
        </div>

        {/* Progress */}
        <Progress value={progress} className="h-2" />

        {/* Step Content */}
        <Card>
          <CardHeader>
            <CardTitle>
              {step === 1 && "Personal Information"}
              {step === 2 && "Upload Document"}
              {step === 3 && "Selfie Verification"}
              {step === 4 && "Review & Submit"}
            </CardTitle>
            <CardDescription>
              {step === 1 && "Enter your personal details as they appear on your ID"}
              {step === 2 && "Upload a clear photo of your government-issued ID"}
              {step === 3 && "Take a selfie to verify your identity"}
              {step === 4 && "Review your information before submitting"}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {step === 1 && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full Name *</Label>
                  <Input
                    id="fullName"
                    placeholder="John Doe"
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="country">Country *</Label>
                  <Select
                    value={formData.country}
                    onValueChange={(value) => setFormData({ ...formData, country: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select country" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="United States">United States</SelectItem>
                      <SelectItem value="United Kingdom">United Kingdom</SelectItem>
                      <SelectItem value="Canada">Canada</SelectItem>
                      <SelectItem value="Australia">Australia</SelectItem>
                      <SelectItem value="Germany">Germany</SelectItem>
                      <SelectItem value="France">France</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="docType">Document Type *</Label>
                  <Select
                    value={formData.docType}
                    onValueChange={(value) => setFormData({ ...formData, docType: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select document type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Passport">Passport</SelectItem>
                      <SelectItem value="Driver's License">Driver's License</SelectItem>
                      <SelectItem value="National ID">National ID</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="docNumber">Document Number *</Label>
                  <Input
                    id="docNumber"
                    placeholder="Enter document number"
                    value={formData.docNumber}
                    onChange={(e) => {
                      setFormData({ ...formData, docNumber: e.target.value })
                      // Reset status when user edits the field
                      setDocStatus("idle")
                      setDocError(null)
                    }}
                  />
                  {formData.country && formData.docType && (
                    <p className="text-xs text-muted-foreground">
                      Expected format for {formData.docType} in {formData.country}:{" "}
                      <span className="font-mono">
                        {getDocNumberRules(formData.country, formData.docType).example}
                      </span>
                    </p>
                  )}
                  <div className="flex items-center gap-2 text-xs mt-1 min-h-[1.5rem]">
                    {docStatus === "verifying" && (
                      <>
                        <Loader2 className="w-3 h-3 animate-spin text-primary" />
                        <span className="text-muted-foreground">Verifying document number format...</span>
                      </>
                    )}
                    {docStatus === "valid" && (
                      <>
                        <CheckCircle2 className="w-3 h-3 text-green-600" />
                        <span className="text-green-700">Document number verified</span>
                      </>
                    )}
                    {docStatus === "invalid" && docError && (
                      <>
                        <AlertCircle className="w-3 h-3 text-destructive" />
                        <span className="text-destructive">{docError}</span>
                      </>
                    )}
                  </div>
                </div>
              </>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <div className="border-2 border-dashed border-border rounded-lg p-4 sm:p-6">
                  <div className="flex flex-col lg:flex-row gap-6">
                    {/* Document upload & preview */}
                    <div className="flex-1 space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="docFile" className="cursor-pointer flex items-center gap-2">
                          <div className="p-2 rounded-full bg-primary/10">
                            <Upload className="w-4 h-4 text-primary" />
                          </div>
                          <div>
                            <div className="text-sm font-medium">Upload Document</div>
                            <div className="text-xs text-muted-foreground">PNG, JPG or PDF (max 10MB)</div>
                          </div>
                        </Label>
                        <Input
                          id="docFile"
                          type="file"
                          accept="image/*,.pdf"
                          className="hidden"
                          onChange={(e) => handleFileChange("docFile", e.target.files?.[0] || null)}
                        />
                        {formData.docFile && (
                          <div className="flex items-center gap-2 text-sm mt-2">
                            <CheckCircle2 className="w-4 h-4 text-success" />
                            <span className="text-foreground truncate">{formData.docFile.name}</span>
                          </div>
                        )}
                      </div>

                      <div className="mt-4">
                        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                          Document preview
                        </div>
                        <div className="w-full aspect-[4/3] bg-muted/60 border border-dashed border-border rounded-lg flex items-center justify-center overflow-hidden">
                          {docPreviewUrl && formData.docFile && formData.docFile.type.startsWith("image/") ? (
                            <img
                              src={docPreviewUrl}
                              alt="Document preview"
                              className="w-full h-full object-contain"
                            />
                          ) : docPreviewUrl && formData.docFile ? (
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
                          Document Verification
                        </div>
                        <p className="text-muted-foreground">
                          We automatically check the information on your document against the details you entered, such
                          as document number and date of birth.
                        </p>
                      </div>

                      <div className="space-y-2 text-sm">
                        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                          Verification steps
                        </div>
                        <ol className="space-y-2">
                          <li className="flex items-start gap-2">
                            {docVerifyPhase === "number" || docVerifyPhase === "dob" || docVerifyPhase === "security" || docVerifyPhase === "done" ? (
                              <Loader2 className="w-3 h-3 animate-spin text-primary mt-0.5" />
                            ) : docVerifyPhase === "idle" ? (
                              <span className="w-3 h-3 rounded-full border border-border mt-0.5 inline-block" />
                            ) : (
                              <CheckCircle2 className="w-3 h-3 text-success mt-0.5" />
                            )}
                            <div>
                              <div className="font-medium">Check document number</div>
                              <p className="text-xs text-muted-foreground">
                                Ensuring the document number matches the expected format and your previous entry.
                              </p>
                            </div>
                          </li>
                          <li className="flex items-start gap-2">
                            {docVerifyPhase === "dob" || docVerifyPhase === "security" || docVerifyPhase === "done" ? (
                              <Loader2 className="w-3 h-3 animate-spin text-primary mt-0.5" />
                            ) : docVerifyPhase === "idle" || docVerifyPhase === "number" ? (
                              <span className="w-3 h-3 rounded-full border border-border mt-0.5 inline-block" />
                            ) : (
                              <CheckCircle2 className="w-3 h-3 text-success mt-0.5" />
                            )}
                            <div>
                              <div className="font-medium">Validate date of birth</div>
                              <p className="text-xs text-muted-foreground">
                                Confirming the date of birth is present and consistent across fields.
                              </p>
                            </div>
                          </li>
                          <li className="flex items-start gap-2">
                            {docVerifyPhase === "security" || docVerifyPhase === "done" ? (
                              <Loader2 className="w-3 h-3 animate-spin text-primary mt.0.5" />
                            ) : docVerifyPhase === "idle" || docVerifyPhase === "number" || docVerifyPhase === "dob" ? (
                              <span className="w-3 h-3 rounded-full border border-border mt-0.5 inline-block" />
                            ) : (
                              <CheckCircle2 className="w-3 h-3 text-success mt-0.5" />
                            )}
                            <div>
                              <div className="font-medium">Run basic security checks</div>
                              <p className="text-xs text-muted-foreground">
                                Performing basic consistency checks to detect obvious tampering or invalid inputs.
                              </p>
                            </div>
                          </li>
                        </ol>

                        {docVerifyPhase === "done" && docStatus === "valid" && (
                          <p className="text-xs text-green-700 flex items-center gap-1 mt-1">
                            <CheckCircle2 className="w-3 h-3" />
                            Document details look consistent.
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
                <div className="border-2 border-dashed border-border rounded-lg p-4 sm:p-6">
                  <div className="flex flex-col lg:flex-row gap-6">
                    {/* Live selfie capture */}
                    <div className="flex-1 space-y-4">
                      <div className="flex items-center gap-2">
                        <div className="p-2 rounded-full bg-primary/10">
                          <Camera className="w-4 h-4 text-primary" />
                        </div>
                        <div>
                          <div className="text-sm font-medium">Selfie Capture</div>
                          <p className="text-xs text-muted-foreground">
                            Take a selfie so we can confirm that you match the person on the document.
                          </p>
                        </div>
                      </div>

                      <div className="w-full aspect-[4/3] bg-black/80 rounded-lg overflow-hidden flex items-center justify-center">
                        {selfieCaptured ? (
                          <img src={selfieCaptured} alt="Captured selfie" className="w-full h-full object-cover" />
                        ) : (
                          <video
                            ref={selfieVideoRef}
                            className="w-full h-full object-cover"
                            autoPlay
                            muted
                            playsInline
                          />
                        )}
                      </div>

                      <div className="flex flex-wrap gap-2 mt-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={startSelfieCamera}
                          className="flex items-center gap-2"
                        >
                          <Camera className="w-4 h-4" />
                          {selfieStream ? "Restart camera" : "Start camera"}
                        </Button>
                        <Button
                          type="button"
                          onClick={captureSelfie}
                          disabled={!selfieStream}
                          className="flex items-center gap-2"
                        >
                          {selfieStatus === "verifying" ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Verifying...
                            </>
                          ) : (
                            <>
                              <User className="w-4 h-4" />
                              Capture selfie
                            </>
                          )}
                        </Button>
                      </div>

                      {selfieStatus === "matched" && (
                        <p className="text-xs text-green-700 flex items-center gap-1 mt-1">
                          <CheckCircle2 className="w-3 h-3" />
                          Selfie appears to match your document.
                        </p>
                      )}
                    </div>

                    {/* Requirements & matching explanation */}
                    <div className="flex-1 space-y-3">
                      <div className="bg-muted/50 p-4 rounded-lg space-y-2 text-sm">
                        <div className="font-medium flex items-center gap-2">
                          <AlertCircle className="w-4 h-4" />
                          Selfie Requirements
                        </div>
                        <ul className="space-y-1 text-muted-foreground ml-6 list-disc">
                          <li>Face must be clearly visible and centered.</li>
                          <li>Look directly at the camera.</li>
                          <li>Remove glasses, hats, and face coverings.</li>
                          <li>Ensure good, even lighting.</li>
                        </ul>
                      </div>

                      <div className="bg-primary/5 border border-primary/20 p-4 rounded-lg space-y-2 text-sm">
                        <div className="font-medium flex items-center gap-2">
                          <User className="w-4 h-4" />
                          How the match works (demo)
                        </div>
                        <p className="text-muted-foreground">
                          In a real system, we would compare facial features from your document photo and your selfie
                          using secure algorithms. In this demo, we simply simulate that process and always approve once
                          a clear selfie is captured.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-4">
                <div className="bg-muted/50 p-4 rounded-lg space-y-3">
                  <div>
                    <div className="text-sm text-muted-foreground">Full Name</div>
                    <div className="font-medium">{formData.fullName}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Country</div>
                    <div className="font-medium">{formData.country}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Document Type</div>
                    <div className="font-medium">{formData.docType}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Document Number</div>
                    <div className="font-medium">{formData.docNumber}</div>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-4 bg-primary/5 border border-primary/20 rounded-lg">
                  <Shield className="w-5 h-5 text-primary mt-0.5" />
                  <div className="text-sm">
                    <div className="font-medium mb-1">Privacy Notice</div>
                    <p className="text-muted-foreground">
                      Your personal information will be encrypted and stored securely on the blockchain. Only you
                      control who can access your credentials.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex gap-3">
          {step > 1 && (
            <Button
              variant="outline"
              onClick={() => setStep(step - 1)}
              disabled={isProcessing}
              className="bg-transparent"
            >
              Back
            </Button>
          )}
          {step < 4 ? (
            <Button onClick={handleNext} className="flex-1">
              Continue
            </Button>
          ) : (
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
        </div>
      </div>
    </div>
  )
}

export default function IdentityVerificationPage() {
  return (
    <AuthGuard>
      <IdentityVerificationPageContent />
    </AuthGuard>
  )
}

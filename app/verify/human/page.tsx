"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { User, CheckCircle2, Loader2, AlertCircle, Camera, Scan, Download, ExternalLink, Shield } from "lucide-react"
import { useKYCStore } from "@/lib/store"
import { generateCredentialHash, addLeafToMerkle, recordHumanVerificationOnChain, verifyZKProof, getMidnightExplorerUrl, deriveSubjectKey } from "@/lib/blockchain-utils"
import { generateCaptchaProof, storeCaptchaProof } from "@/lib/zk-proof-utils"
import { getContractAddress } from "@/lib/midnight-client"
import { useToast } from "@/hooks/use-toast"

interface HumanVerificationReceipt {
  type: "human"
  version: 1
  timestamp: string
  networkId: number
  contractAddress: string | null
  txId: string
  commitment: string
  proofReference?: string
  holder: string
  issuer: string
  livenessCheck: boolean
  captchaPassed: boolean
  publicData: any
  finalized: any
}

export default function HumanVerificationPage() {
  const router = useRouter()
  const { toast } = useToast()
  const { user, walletSession, addCredential, addAction, refreshLedgerSnapshot } = useKYCStore()
  const [step, setStep] = useState(1)
  const [isProcessing, setIsProcessing] = useState(false)
  const [livenessComplete, setLivenessComplete] = useState(false)
  const [livenessStarted, setLivenessStarted] = useState(false)
  const [livenessPhase, setLivenessPhase] = useState<"idle" | "instruction" | "verifying" | "done">("idle")
  const [captchaPassed, setCaptchaPassed] = useState(false)
  const [captchaVerifying, setCaptchaVerifying] = useState(false)
  const [captchaInput, setCaptchaInput] = useState("")
  const [captchaCode, setCaptchaCode] = useState("")
  const [zkProofGenerated, setZkProofGenerated] = useState(false)
  const [zkProofStarted, setZkProofStarted] = useState(false)
  const [zkPhase, setZkPhase] = useState<"idle" | "setup" | "proving" | "verifying" | "done">("idle")
  const zkStages = [
    "Preparing proof parameters",
    "Generating zero-knowledge proof",
    "Verifying proof on-chain",
  ]
  const [currentZkStage, setCurrentZkStage] = useState(0)
  const ZK_SETUP_DURATION_MS = 1500
  const ZK_PROVE_DURATION_MS = 2500
  const ZK_VERIFY_DURATION_MS = 1500
  const [receipt, setReceipt] = useState<HumanVerificationReceipt | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null)
  const livenessSteps = [
    "Look straight at the camera",
    "Turn your head to the left",
    "Turn your head to the right",
    "Smile for 3 seconds",
    "Blink twice",
  ]
  const [currentLivenessStep, setCurrentLivenessStep] = useState(0)
  const INSTRUCTION_DURATION_MS = 4000
  const VERIFY_MIN_DURATION_MS = 1000
  const VERIFY_MAX_DURATION_MS = 4000
  // Simple speech synthesis helper for audio instructions (browser-only, best-effort)
  const speak = (text: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return
    try {
      const synth = window.speechSynthesis
      // Cancel any previous utterances to avoid overlap
      synth.cancel()
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.rate = 1
      utterance.pitch = 1
      synth.speak(utterance)
    } catch {
      // Ignore speech errors – UI still works without audio
    }
  }
  const holderAddress = user.walletAddress ?? walletSession?.address ?? null
  const identityVerified = user.kyc.identity === "Verified"

  // Generate CAPTCHA code on mount and when needed
  const generateCaptchaCode = () => {
    // Generate a simple 4-character alphanumeric CAPTCHA
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789" // Exclude confusing chars
    let code = ""
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    setCaptchaCode(code)
    setCaptchaInput("")
    setCaptchaPassed(false)
  }

  useEffect(() => {
    if (!identityVerified) {
      toast({
        title: "Identity verification required",
        description: "Complete your identity verification before continuing to human verification.",
        variant: "destructive",
      })
      router.replace("/verify/identity")
    }
  }, [identityVerified, router, toast])

  // Attach camera stream to video element
  useEffect(() => {
    if (videoRef.current && cameraStream) {
      videoRef.current.srcObject = cameraStream
      void videoRef.current.play().catch(() => {
        // Ignore play errors (autoplay policies, etc.)
      })
    }
  }, [cameraStream])

  // Cleanup camera stream on unmount
  useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach((t) => t.stop())
      }
    }
  }, [cameraStream])

  // Auto-advance liveness steps with instruction + verifying phases
  useEffect(() => {
    if (!livenessStarted || livenessComplete || step !== 1) return

    let timeout: ReturnType<typeof setTimeout> | undefined

    if (livenessPhase === "instruction") {
      // Play audio instruction
      speak(livenessSteps[currentLivenessStep])
      // Give the user time to follow the instruction
      timeout = setTimeout(() => {
        setLivenessPhase("verifying")
      }, INSTRUCTION_DURATION_MS)
    } else if (livenessPhase === "verifying") {
      // Play audio for verification phase
      speak("Verifying your response.")
      // Simulate system verification time (1–4 seconds), then move to next instruction or finish
      const verifyDuration =
        Math.floor(Math.random() * (VERIFY_MAX_DURATION_MS - VERIFY_MIN_DURATION_MS + 1)) +
        VERIFY_MIN_DURATION_MS
      timeout = setTimeout(() => {
        if (currentLivenessStep < livenessSteps.length - 1) {
          setCurrentLivenessStep((prev) => prev + 1)
          setLivenessPhase("instruction")
        } else {
          // Last step completed → mark liveness complete
          setLivenessComplete(true)
          setLivenessPhase("done")
          // Generate new CAPTCHA code when moving to step 2
          generateCaptchaCode()
          setStep(2)
          if (cameraStream) {
            cameraStream.getTracks().forEach((t) => t.stop())
          }
          setCameraStream(null)
          toast({
            title: "Liveness Check Passed",
            description: "Demo liveness verification completed successfully.",
          })
        }
      }, verifyDuration)
    }

    return () => {
      if (timeout) clearTimeout(timeout)
    }
  }, [
    livenessStarted,
    livenessComplete,
    livenessPhase,
    currentLivenessStep,
    step,
    INSTRUCTION_DURATION_MS,
    VERIFY_MIN_DURATION_MS,
    VERIFY_MAX_DURATION_MS,
    cameraStream,
    livenessSteps.length,
    toast,
  ])

  useEffect(() => {
    // Generate initial CAPTCHA when moving to step 2
    if (step === 2 && !captchaCode) {
      generateCaptchaCode()
    }
  }, [step, captchaCode])

  // Auto-advance ZK proof demo stages
  useEffect(() => {
    if (!zkProofStarted || zkProofGenerated || step !== 3) return

    let timeout: ReturnType<typeof setTimeout> | undefined

    if (zkPhase === "setup") {
      timeout = setTimeout(() => {
        setZkPhase("proving")
        setCurrentZkStage(1)
      }, ZK_SETUP_DURATION_MS)
    } else if (zkPhase === "proving") {
      timeout = setTimeout(() => {
        setZkPhase("verifying")
        setCurrentZkStage(2)
      }, ZK_PROVE_DURATION_MS)
    } else if (zkPhase === "verifying") {
      timeout = setTimeout(async () => {
        // Finalize demo by calling mock verifier (always true)
        try {
          const proofValid = await verifyZKProof("mock-proof")
          if (proofValid) {
            setZkPhase("done")
            setZkProofGenerated(true)
            toast({
              title: "ZK Proof Ready",
              description: "Your demo proof has been generated and verified successfully.",
            })
            setStep(4)
          }
        } catch (error) {
          console.error("[human-verification] ZK proof demo failed", error)
          toast({
            title: "Proof Generation Failed",
            description: "There was an issue with the demo. Please try again.",
            variant: "destructive",
          })
          setZkPhase("idle")
          setZkProofStarted(false)
          setCurrentZkStage(0)
        }
      }, ZK_VERIFY_DURATION_MS)
    }

    return () => {
      if (timeout) clearTimeout(timeout)
    }
  }, [
    zkProofStarted,
    zkProofGenerated,
    zkPhase,
    step,
    ZK_SETUP_DURATION_MS,
    ZK_PROVE_DURATION_MS,
    ZK_VERIFY_DURATION_MS,
    toast,
  ])

  if (!identityVerified) {
    const nextStep = "/verify/identity"
    const message = "Please complete your identity verification first."

    return (
      <div className="container mx-auto px-4 py-16">
        <Card className="max-w-md mx-auto">
          <CardHeader>
            <CardTitle>Previous Steps Required</CardTitle>
            <CardDescription>{message}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push(nextStep)} className="w-full">
              Go to Required Step
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

  const handleLivenessCheck = async () => {
    if (livenessComplete) return
    setIsProcessing(true)
    try {
      // Dummy liveness: just request camera access and guide user through scripted steps
      if (!cameraStream) {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
        setCameraStream(stream)
      }
      setLivenessStarted(true)
      setCurrentLivenessStep(0)
      setLivenessPhase("instruction")
      // Intro audio cue
      speak("Starting liveness check. Please follow the instructions on the screen.")
      toast({
        title: "Liveness Check Started",
        description: "Follow the on-screen instructions. This is a demo and will always pass.",
      })
    } catch (error) {
      console.error("[human-verification] Failed to start camera", error)
      toast({
        title: "Camera Access Required",
        description: "We could not access your camera. Please allow camera access and try again.",
        variant: "destructive",
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const handleCaptchaVerify = async () => {
    // Allow retry even if previously failed - only block if already passed
    if (captchaVerifying) return
    
    if (!captchaInput.trim()) {
      toast({
        title: "CAPTCHA Required",
        description: "Please enter the CAPTCHA code to verify you're human.",
        variant: "destructive",
      })
      return
    }

    setCaptchaVerifying(true)
    
    // Simulate verification delay (1-2 seconds)
    await new Promise((resolve) => setTimeout(resolve, 1000 + Math.random() * 1000))
    
    // Verify the CAPTCHA code - check if input matches the generated code
    const normalizedInput = captchaInput.trim().toUpperCase()
    const normalizedCode = captchaCode.toUpperCase()
    
    // Actual validation: return true if input matches, false otherwise
    const isValid = normalizedInput === normalizedCode
    
    if (isValid) {
      // CAPTCHA verified successfully
      setCaptchaPassed(true)
      toast({
        title: "CAPTCHA Verified",
        description: "You have successfully verified that you're human.",
      })
      // Auto-advance to ZK proof step after a short delay
      setTimeout(() => {
        setStep(3)
      }, 1000)
    } else {
      // CAPTCHA verification failed - mark as false but allow progression
      setCaptchaPassed(false)
      setCaptchaInput("") // Clear the input
      toast({
        title: "CAPTCHA Failed",
        description: "The code you entered is incorrect. You can continue, but this will be recorded as failed CAPTCHA verification.",
        variant: "destructive",
      })
      // Generate a new CAPTCHA code for retry (user can try again if they want)
      generateCaptchaCode()
      // Allow progression - the false value will be stored on-chain
    }
    
    setCaptchaVerifying(false)
  }

  const handleZKProofGeneration = async () => {
    if (zkProofStarted || zkProofGenerated) return
    setIsProcessing(true)
    try {
      setZkProofStarted(true)
      setZkPhase("setup")
      setCurrentZkStage(0)
      toast({
        title: "Starting ZK Proof Demo",
        description: "We'll simulate how a real zero-knowledge proof is created and verified.",
      })
    } finally {
      setIsProcessing(false)
    }
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

    // Allow submission regardless of CAPTCHA result
    // The captchaPassed value (true or false) will be stored on-chain
    // If user hasn't attempted CAPTCHA, default to false
    const finalCaptchaPassed = captchaPassed || false
    
    if (!finalCaptchaPassed) {
      // Show warning but allow submission
      toast({
        title: "CAPTCHA Not Passed",
        description: "Submitting with failed CAPTCHA verification. This will be recorded on-chain.",
        variant: "default",
      })
    }

    setIsProcessing(true)

    try {
      // Generate credential data
      // Use finalCaptchaPassed to ensure we always have a boolean value
      const credentialData = {
        type: "Human",
        holder: holderAddress,
        issuer: walletSession.address,
        livenessCheck: true,
        captchaPassed: finalCaptchaPassed, // Include CAPTCHA result (true or false) in commitment
      }

      const credentialHash = await generateCredentialHash(credentialData)
      const proofReference = await generateCredentialHash({
        circuit: "human",
        holder: user.walletAddress,
        issuedAt: new Date().toISOString(),
      })
      const result = await recordHumanVerificationOnChain(walletSession, {
        subjectId: holderAddress,
        humanCredentialCommitment: credentialHash,
        proofReference,
        issuerReference: walletSession.address,
      })
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
      console.log("[human-verification] Transaction details:", {
        txId: result.txId,
        txHash,
        blockNumber,
        finalizedKeys: finalized ? Object.keys(finalized) : [],
        finalizedFull: finalized, // Log entire object
      })
      
      // Check all hash-related fields
      if (result.finalized) {
        console.log("[human-verification] All hash-related fields:", {
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
        type: "Human" as const,
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
        zkProofSummary: finalCaptchaPassed
          ? "Liveness check and CAPTCHA verification passed with ZK proof"
          : "Liveness check passed but CAPTCHA verification failed",
        metadata: {
          captchaPassed: finalCaptchaPassed, // Store CAPTCHA result in metadata for later retrieval
          livenessCheck: true,
        },
        chainData: {
          publicData: result.publicData,
          finalized: result.finalized,
        },
      }

      addCredential(newCredential)
      addAction({
        id: Date.now().toString(),
        type: "Human",
        action: "Issued",
        timestamp: new Date().toISOString(),
        txHash,
      })

      await refreshLedgerSnapshot()

      // PRIVACY: Generate and store ZK proof for CAPTCHA verification
      // This allows the asset app to verify CAPTCHA without revealing the actual result
      try {
        const subjectHash = await deriveSubjectKey(holderAddress)
        const captchaProof = await generateCaptchaProof(walletSession, result.commitment, finalCaptchaPassed)
        
        if (captchaProof) {
          // Store proof server-side via API (similar to age and country proof storage)
          await storeCaptchaProof(captchaProof, subjectHash)
          console.log("[human-verification] CAPTCHA ZK proof generated and stored:", {
            captchaPassed: finalCaptchaPassed,
            commitment: result.commitment,
          })
        } else {
          console.warn("[human-verification] Failed to generate CAPTCHA ZK proof")
        }
      } catch (proofError) {
        console.error("[human-verification] Failed to generate/store CAPTCHA proof:", proofError)
        // Don't block human verification if proof generation fails
      }

      const proofReceipt: HumanVerificationReceipt = {
        type: "human",
        version: 1,
        timestamp: new Date().toISOString(),
        networkId: walletSession.networkId,
        contractAddress: getContractAddress() ?? null,
        txId: txHash,
        commitment: result.commitment,
        proofReference: result.proofReference,
        holder: holderAddress,
        issuer: walletSession.address,
        livenessCheck: true,
        captchaPassed: finalCaptchaPassed,
        publicData: result.publicData,
        finalized: result.finalized,
      }

      setReceipt(proofReceipt)
      setStep(5)

      toast({
        title: "Verification Complete!",
        description: "Your human credential has been issued successfully",
      })
    } catch (error) {
      toast({
        title: "Verification Failed",
        description: "There was an error processing your verification. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsProcessing(false)
    }
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
      link.download = `midnight-human-receipt-${receipt.txId}.json`
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

  const progress = receipt ? 100 : (step / 4) * 100

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <User className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Human Verification</h1>
            <p className="text-muted-foreground">
              {receipt ? "Verification complete" : `Step ${step} of 4`}
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
              {!receipt && step === 1 && "Liveness Detection"}
              {!receipt && step === 2 && "CAPTCHA Verification"}
              {!receipt && step === 3 && "Generate ZK Proof"}
              {!receipt && step === 4 && "Review & Submit"}
            </CardTitle>
            <CardDescription>
              {receipt && "Download your proof receipt or view credentials"}
              {!receipt && step === 1 && "Perform a liveness check to prove you're a real human"}
              {!receipt && step === 2 && "Complete the CAPTCHA to verify you're human"}
              {!receipt && step === 3 && "Generate a zero-knowledge proof for privacy"}
              {!receipt && step === 4 && "Review and submit your human verification"}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {step === 1 && (
              <div className="space-y-4">
                <div className="border-2 border-dashed border-border rounded-lg p-4 sm:p-6">
                  <div className="flex flex-col sm:flex-row gap-4">
                    <div className="flex-1 flex flex-col items-center">
                      <div className="w-full max-w-xs aspect-video bg-black/80 rounded-lg overflow-hidden flex items-center justify-center">
                        {cameraStream ? (
                          <video ref={videoRef} className="w-full h-full object-cover" autoPlay muted playsInline />
                        ) : (
                          <div className="flex flex-col items-center justify-center text-muted-foreground">
                            <Camera className="w-12 h-12 mb-2" />
                            <p className="text-xs text-center px-4">
                              Camera preview will appear here once you start the liveness check.
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex-1 space-y-4">
                      <div>
                        <h3 className="font-semibold mb-1">Liveness Check (Demo)</h3>
                        <p className="text-sm text-muted-foreground">
                          Follow the instructions below. This is a demonstration only – all steps will pass
                          automatically and no biometric data is analyzed.
                        </p>
                      </div>

                      <div className="space-y-2">
                        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                          {livenessPhase === "verifying" ? "Verifying" : "Current instruction"}
                        </div>
                        <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 flex items-start gap-2">
                          <AlertCircle className="w-4 h-4 text-primary mt-0.5" />
                          <div className="text-sm">
                            {!livenessStarted && !livenessComplete && "Click “Start Liveness Check” to begin the guided demo."}
                            {livenessStarted && !livenessComplete && livenessPhase === "instruction" && (
                              <>
                                {livenessSteps[currentLivenessStep]}
                                <span className="block text-xs text-muted-foreground mt-1">
                                  You have a few seconds to follow this instruction.
                                </span>
                              </>
                            )}
                            {livenessStarted && !livenessComplete && livenessPhase === "verifying" && (
                              <>
                                Analysing your response...
                                <span className="block text-xs text-muted-foreground mt-1">
                                  This may take a few seconds.
                                </span>
                              </>
                            )}
                            {livenessComplete && "Liveness demo completed successfully."}
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                          Steps
                        </div>
                        <ol className="space-y-1 text-sm">
                          {livenessSteps.map((stepLabel, index) => {
                            const completed = livenessStarted && index < currentLivenessStep
                            const active = livenessStarted && !livenessComplete && index === currentLivenessStep
                            return (
                              <li
                                key={stepLabel}
                                className="flex items-center gap-2 text-muted-foreground"
                              >
                                {completed ? (
                                  <CheckCircle2 className="w-4 h-4 text-success" />
                                ) : active ? (
                                  <Loader2 className="w-4 h-4 text-primary animate-spin" />
                                ) : (
                                  <span className="w-4 h-4 rounded-full border border-border inline-block" />
                                )}
                                <span className={active ? "font-medium text-foreground" : ""}>{stepLabel}</span>
                              </li>
                            )
                          })}
                        </ol>
                      </div>

                      <div className="flex gap-2">
                        {!livenessStarted && !livenessComplete && (
                          <Button onClick={handleLivenessCheck} disabled={isProcessing} className="flex-1">
                            {isProcessing ? (
                              <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Starting camera...
                              </>
                            ) : (
                              "Start Liveness Check"
                            )}
                          </Button>
                        )}
                        {livenessComplete && (
                          <Button disabled className="flex-1" variant="outline">
                            <CheckCircle2 className="w-4 h-4 mr-2 text-success" />
                            Liveness check complete
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-muted/50 p-4 rounded-lg space-y-2 text-sm">
                  <div className="font-medium flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    About this demo
                  </div>
                  <ul className="space-y-1 text-muted-foreground ml-6 list-disc">
                    <li>No biometric data is stored or analyzed.</li>
                    <li>All instructions are for demonstration purposes only.</li>
                    <li>The liveness check will always pass once you complete the steps.</li>
                    <li>You can repeat the process at any time.</li>
                  </ul>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <div className="border-2 border-dashed border-border rounded-lg p-4 sm:p-6">
                  <div className="flex flex-col items-center gap-6">
                    <div className="flex-1 w-full space-y-4">
                      <div className="flex items-center gap-3 justify-center">
                        <div className="p-2 rounded-full bg-primary/10">
                          <Shield className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-center">CAPTCHA Verification</h3>
                          <p className="text-sm text-muted-foreground text-center">
                            Complete the CAPTCHA below to verify you're human
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-col items-center gap-4">
                        {/* CAPTCHA Display */}
                        <div className="bg-muted/50 border-2 border-border rounded-lg p-6 flex items-center justify-center">
                          <div className="text-4xl font-bold tracking-widest text-foreground select-none">
                            {captchaCode}
                          </div>
                        </div>

                        {/* Input Field */}
                        <div className="w-full max-w-xs space-y-2">
                          <label htmlFor="captcha-input" className="text-sm font-medium">
                            Enter the code above
                          </label>
                          <input
                            id="captcha-input"
                            type="text"
                            value={captchaInput}
                            onChange={(e) => setCaptchaInput(e.target.value.toUpperCase())}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && !captchaVerifying && !captchaPassed) {
                                handleCaptchaVerify()
                              }
                            }}
                            disabled={captchaPassed || captchaVerifying}
                            maxLength={4}
                            className="w-full px-4 py-2 text-center text-lg font-mono border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
                            placeholder="____"
                            autoComplete="off"
                          />
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-3 w-full max-w-xs">
                          <Button
                            onClick={generateCaptchaCode}
                            variant="outline"
                            disabled={captchaPassed || captchaVerifying}
                            className="flex-1"
                          >
                            Refresh
                          </Button>
                          <Button
                            onClick={handleCaptchaVerify}
                            disabled={captchaPassed || captchaVerifying || !captchaInput.trim()}
                            className="flex-1"
                          >
                            {captchaVerifying ? (
                              <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Verifying...
                              </>
                            ) : captchaPassed ? (
                              <>
                                <CheckCircle2 className="w-4 h-4 mr-2" />
                                Verified
                              </>
                            ) : (
                              "Verify"
                            )}
                          </Button>
                        </div>

                        {captchaPassed && (
                          <div className="flex items-center gap-2 text-success text-sm">
                            <CheckCircle2 className="w-4 h-4" />
                            <span>CAPTCHA verified successfully. You are confirmed as human.</span>
                          </div>
                        )}
                        {!captchaPassed && captchaInput && !captchaVerifying && (
                          <div className="flex items-center gap-2 text-warning text-sm">
                            <AlertCircle className="w-4 h-4" />
                            <span>CAPTCHA verification failed. You can continue, but this will be recorded.</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-muted/50 p-4 rounded-lg space-y-2 text-sm">
                  <div className="font-medium flex items-center gap-2">
                    <Shield className="w-4 h-4" />
                    About CAPTCHA
                  </div>
                  <p className="text-muted-foreground">
                    CAPTCHA helps us verify that you're a real human and not a bot. This verification
                    is included in your human credential commitment on the blockchain.
                  </p>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <div className="border-2 border-dashed border-border rounded-lg p-4 sm:p-6">
                  <div className="flex flex-col md:flex-row gap-6">
                    <div className="flex-1 space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-full bg-primary/10">
                          <Scan className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <h3 className="font-semibold">Zero-Knowledge Proof (Demo)</h3>
                          <p className="text-sm text-muted-foreground">
                            We’ll simulate how a real ZK proof is created and verified, without exposing any personal
                            data.
                          </p>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                          Proof pipeline
                        </div>
                        <ol className="space-y-2 text-sm">
                          {zkStages.map((label, index) => {
                            const completed = zkProofStarted && index < currentZkStage
                            const active =
                              zkProofStarted && !zkProofGenerated && index === currentZkStage && zkPhase !== "idle"
                            return (
                              <li
                                key={label}
                                className="flex items-start gap-2"
                              >
                                {completed ? (
                                  <CheckCircle2 className="w-4 h-4 text-success mt-0.5" />
                                ) : active ? (
                                  <Loader2 className="w-4 h-4 text-primary animate-spin mt-0.5" />
                                ) : (
                                  <span className="w-4 h-4 rounded-full border border-border mt-0.5 inline-block" />
                                )}
                                <div>
                                  <div className={active ? "font-medium text-foreground" : "text-foreground"}>
                                    {label}
                                  </div>
                                  {index === 0 && (
                                    <p className="text-xs text-muted-foreground">
                                      Initializing the proving system and loading circuit parameters.
                                    </p>
                                  )}
                                  {index === 1 && (
                                    <p className="text-xs text-muted-foreground">
                                      Creating a cryptographic proof that your liveness check passed.
                                    </p>
                                  )}
                                  {index === 2 && (
                                    <p className="text-xs text-muted-foreground">
                                      Simulating on-chain verification of the proof by the Midnight contract.
                                    </p>
                                  )}
                                </div>
                              </li>
                            )
                          })}
                        </ol>
                      </div>

                      <div className="mt-4">
                        <Button
                          onClick={handleZKProofGeneration}
                          disabled={isProcessing || zkProofGenerated || zkProofStarted}
                          className="w-full sm:w-auto"
                        >
                          {zkProofGenerated ? (
                            <>
                              <CheckCircle2 className="w-4 h-4 mr-2" />
                              Proof Generated
                            </>
                          ) : zkProofStarted ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Running proof demo...
                            </>
                          ) : isProcessing ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Preparing...
                            </>
                          ) : (
                            "Generate ZK Proof"
                          )}
                        </Button>
                      </div>
                    </div>

                    <div className="flex-1 space-y-3">
                      <div className="bg-muted/50 p-4 rounded-lg space-y-2 text-sm">
                        <div className="font-medium flex items-center gap-2">
                          <User className="w-4 h-4" />
                          Privacy First
                        </div>
                        <p className="text-muted-foreground">
                          In a real deployment, the proof would convince the verifier that your liveness check passed
                          without revealing your raw video or biometric data.
                        </p>
                      </div>
                      <div className="bg-background border border-border/60 rounded-lg p-4 text-xs font-mono text-muted-foreground h-40 overflow-auto">
                        <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-2">
                          Demo prover log
                        </div>
                        <p>
                          {zkProofStarted
                            ? zkPhase === "setup"
                              ? "&gt; Loading circuit: human_liveness.circ"
                              : zkPhase === "proving"
                                ? "&gt; Generating proof π for statement: “user passed liveness check”"
                                : zkPhase === "verifying"
                                  ? "&gt; Verifying π against public verification key vk_human_liveness"
                                  : "&gt; Proof successfully verified ✓"
                            : '&gt; Ready. Click "Generate ZK Proof" to start the demo.'}
                        </p>
                        {zkProofStarted && (
                          <>
                            <p className="mt-1">&gt; Constraints: 32,768</p>
                            <p>&gt; Estimated proof size: ~2 KB (compressed)</p>
                            {zkPhase === "done" && <p className="mt-1">&gt; Result: VALID_PROOF</p>}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-4">
                <div className="bg-muted/50 p-4 rounded-lg space-y-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-success" />
                    <div className="font-medium">Liveness Check Complete</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-success" />
                    <div className="font-medium">CAPTCHA Verified</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-success" />
                    <div className="font-medium">ZK Proof Generated</div>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-4 bg-primary/5 border border-primary/20 rounded-lg">
                  <User className="w-5 h-5 text-primary mt-0.5" />
                  <div className="text-sm">
                    <div className="font-medium mb-1">Ready to Submit</div>
                    <p className="text-muted-foreground">
                      Your human verification credential will be issued on-chain. This proves you're a real person
                      without revealing any personal information.
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

                <div className="flex items-start gap-3 p-4 bg-primary/5 border border-primary/20 rounded-lg">
                  <User className="w-5 h-5 text-primary mt-0.5" />
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
          {!receipt && step > 1 && step < 4 && (
            <>
              <Button
                variant="outline"
                onClick={() => setStep(step - 1)}
                disabled={isProcessing}
                className="bg-transparent"
              >
                Back
              </Button>
              {/* Allow progression from step 2 to 3 regardless of CAPTCHA result */}
              {/* The CAPTCHA result (true/false) will be stored on-chain in the commitment */}
              {step === 2 && (
                <Button
                  onClick={() => {
                    // If user hasn't attempted CAPTCHA, mark as false
                    // This ensures the value is always set (true or false) before proceeding
                    if (captchaInput === "" && !captchaPassed) {
                      // User skipped CAPTCHA - mark as false
                      setCaptchaPassed(false)
                    }
                    setStep(3)
                  }}
                  disabled={isProcessing}
                  className="flex-1"
                  variant={captchaPassed ? "default" : "outline"}
                >
                  {captchaPassed ? (
                    "Continue to ZK Proof"
                  ) : (
                    <>
                      Continue {captchaInput ? "Anyway" : "Without CAPTCHA"}
                      <AlertCircle className="w-4 h-4 ml-2" />
                    </>
                  )}
                </Button>
              )}
              {/* Allow progression from step 3 to 4 */}
              {step === 3 && (
                <Button
                  onClick={() => setStep(4)}
                  disabled={isProcessing || !zkProofGenerated}
                  className="flex-1"
                >
                  Continue to Review
                </Button>
              )}
            </>
          )}
          {!receipt && step === 4 && (
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

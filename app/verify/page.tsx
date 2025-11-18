"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Shield, User, Calendar, ArrowRight, CheckCircle2, AlertCircle, Sparkles, Lock, Clock } from "lucide-react"
import { useKYCStore } from "@/lib/store"
import { AuthGuard } from "@/components/auth-guard"
import { useToast } from "@/hooks/use-toast"

function VerifyPageContent() {
  const { toast } = useToast()
  const { user, connectWallet } = useKYCStore()
  const router = useRouter()
  const [isConnecting, setIsConnecting] = useState(false)

  if (!user.walletAddress) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0A0A1F] via-[#0F0E2A] to-[#1a1840] flex items-center justify-center px-4">
        <Card className="max-w-md w-full bg-white/5 backdrop-blur-xl border-white/10 shadow-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-[#E6E7EF]">
              <AlertCircle className="w-5 h-5 text-amber-400" />
              Wallet Not Connected
            </CardTitle>
            <CardDescription className="text-[#A5A7BF]">Please connect your wallet to start verification</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-[#A5A7BF] mb-6">
              You need to connect your wallet to begin the verification process.
            </p>
            <Button
              className="w-full bg-gradient-to-r from-[#15DACC] to-[#6255CB] hover:opacity-90 text-white font-semibold shadow-lg shadow-[#15DACC]/20"
              onClick={async () => {
                setIsConnecting(true)
                try {
                  await connectWallet()
                } catch (error) {
                  console.error("[verify-page] Failed to connect wallet", error)
                  toast({
                    title: "Unable to connect wallet",
                    description:
                      error instanceof Error ? error.message : "Check the Lace extension and try again.",
                    variant: "destructive",
                  })
                } finally {
                  setIsConnecting(false)
                }
              }}
              disabled={isConnecting}
            >
              {isConnecting ? "Connecting..." : "Connect Wallet"}
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const verificationSteps = useMemo(
    () => [
      {
        type: "Identity",
        icon: Shield,
        title: "Identity Verification",
        description: "Verify your identity with a government-issued ID document using advanced document verification",
        status: user.kyc.identity,
        href: "/verify/identity",
        features: ["Government ID scan", "Facial recognition", "Document authenticity check", "Blockchain storage"],
        estimatedTime: "5-10 minutes",
        color: "from-blue-500 to-cyan-500",
        bgGradient: "from-blue-500/10 to-cyan-500/10",
        iconBg: "bg-blue-500/20",
        iconColor: "text-blue-400",
      },
      {
        type: "Human",
        icon: User,
        title: "Human Verification",
        description: "Prove you're a real human with advanced liveness detection and CAPTCHA verification",
        status: user.kyc.human,
        href: "/verify/human",
        features: ["Liveness detection", "Anti-bot verification", "Zero-knowledge proof", "Privacy-preserving"],
        estimatedTime: "2-3 minutes",
        color: "from-purple-500 to-pink-500",
        bgGradient: "from-purple-500/10 to-pink-500/10",
        iconBg: "bg-purple-500/20",
        iconColor: "text-purple-400",
      },
      {
        type: "Age",
        icon: Calendar,
        title: "Age Verification",
        description: "Verify your age using zero-knowledge proofs without revealing your date of birth",
        status: user.kyc.age,
        href: "/verify/age",
        features: ["Age range proof", "Privacy-first", "No DOB disclosure", "ZK-proof technology"],
        estimatedTime: "3-5 minutes",
        color: "from-emerald-500 to-teal-500",
        bgGradient: "from-emerald-500/10 to-teal-500/10",
        iconBg: "bg-emerald-500/20",
        iconColor: "text-emerald-400",
      },
    ],
    [user.kyc],
  )

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Verified":
        return (
          <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 px-3 py-1.5">
            <CheckCircle2 className="w-3 h-3 mr-1.5" />
            Verified
          </Badge>
        )
      case "Pending":
        return (
          <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 px-3 py-1.5">
            <Clock className="w-3 h-3 mr-1.5" />
            Pending
          </Badge>
        )
      case "Expired":
      case "Revoked":
        return (
          <Badge className="bg-red-500/20 text-red-400 border-red-500/30 px-3 py-1.5">
            <AlertCircle className="w-3 h-3 mr-1.5" />
            Expired
          </Badge>
        )
      default:
        return (
          <Badge className="bg-slate-500/20 text-slate-400 border-slate-500/30 px-3 py-1.5">
            <Lock className="w-3 h-3 mr-1.5" />
            Not Verified
          </Badge>
        )
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0A1F] via-[#0F0E2A] to-[#1a1840] relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-[#15DACC]/5 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl animate-pulse delay-1000" />
        <div className="absolute top-1/2 left-1/2 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl animate-pulse delay-2000" />
      </div>

      <div className="container mx-auto px-4 py-8 md:py-12 max-w-7xl relative z-10">
        {/* Header */}
        <div className="text-center mb-12 md:mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#15DACC]/10 border border-[#15DACC]/20 mb-6">
            <Sparkles className="w-4 h-4 text-[#15DACC]" />
            <span className="text-sm font-medium text-[#15DACC]">Verification Portal</span>
          </div>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-4 bg-gradient-to-r from-[#E6E7EF] via-[#15DACC] to-[#E6E7EF] bg-clip-text text-transparent">
            Get Verified
          </h1>
          <p className="text-lg md:text-xl text-[#A5A7BF] max-w-3xl mx-auto leading-relaxed">
            Complete each verification step in order. Your credentials are stored privately on-chain using zero-knowledge proofs and unlock access to tokenized assets.
          </p>
        </div>

        {/* Verification Steps */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8 mb-12">
          {verificationSteps.map((verification, index) => {
            const Icon = verification.icon
            const isLocked = index > 0 && verificationSteps[index - 1].status !== "Verified"
            const isVerified = verification.status === "Verified"
            const isPending = verification.status === "Pending"

            return (
              <Card
                key={verification.type}
                className={`group relative flex flex-col bg-gradient-to-br from-white/5 to-white/[0.02] backdrop-blur-xl border border-white/10 shadow-2xl hover:shadow-[#15DACC]/20 transition-all duration-500 overflow-hidden ${
                  isLocked ? "opacity-60" : ""
                } ${isVerified ? "hover:border-emerald-500/30" : "hover:border-[#15DACC]/30"}`}
              >
                {/* Gradient overlay on hover */}
                <div className={`absolute inset-0 bg-gradient-to-br ${verification.bgGradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
                
                {/* Verified badge decoration */}
                {isVerified && (
                  <div className="absolute top-0 right-0 w-32 h-32 -mr-16 -mt-16 bg-emerald-500/10 rounded-full blur-2xl" />
                )}

                <CardHeader className="relative z-10 pb-4">
                  <div className="flex items-start justify-between mb-4">
                    <div className={`relative ${verification.iconBg} p-4 rounded-2xl group-hover:scale-110 transition-transform duration-300 shadow-lg`}>
                      <Icon className={`w-7 h-7 ${verification.iconColor} group-hover:scale-110 transition-transform duration-300`} />
                      <div className={`absolute inset-0 bg-gradient-to-br ${verification.bgGradient} opacity-0 group-hover:opacity-30 rounded-2xl transition-opacity duration-300`} />
                    </div>
                    {getStatusBadge(verification.status)}
                  </div>
                  <CardTitle className="text-xl md:text-2xl font-bold text-[#E6E7EF] mb-2 group-hover:text-[#15DACC] transition-colors duration-300">
                    {verification.title}
                  </CardTitle>
                  <CardDescription className="text-[#A5A7BF] text-base leading-relaxed">
                    {verification.description}
                  </CardDescription>
                </CardHeader>

                <CardContent className="flex-1 flex flex-col justify-between space-y-4 relative z-10">
                  <div className="space-y-4">
                    <div>
                      <div className="text-xs font-medium text-[#A5A7BF] mb-3 uppercase tracking-wide">What's included:</div>
                      <ul className="space-y-2.5">
                        {verification.features.map((feature) => (
                          <li key={feature} className="flex items-start gap-3">
                            <div className={`mt-0.5 p-1 rounded-full ${verification.iconBg}`}>
                              <CheckCircle2 className={`w-3.5 h-3.5 ${verification.iconColor}`} />
                            </div>
                            <span className="text-sm text-[#E6E7EF] leading-relaxed">{feature}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="pt-3 border-t border-white/10">
                      <div className="flex items-center gap-2 text-sm">
                        <Clock className="w-4 h-4 text-[#A5A7BF]" />
                        <span className="text-[#A5A7BF]">Estimated time:</span>
                        <span className="font-semibold text-[#E6E7EF]">{verification.estimatedTime}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>

                <div className="px-6 pb-6 relative z-10">
                  <Button
                    className={`w-full transition-all duration-300 ${
                      isLocked
                        ? "bg-slate-500/20 text-slate-400 border-slate-500/30 cursor-not-allowed"
                        : isVerified
                          ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 hover:border-emerald-500/50 hover:text-emerald-300"
                          : `bg-gradient-to-r ${verification.color} hover:opacity-90 text-white font-semibold shadow-lg shadow-[#15DACC]/20 hover:shadow-[#15DACC]/40`
                    }`}
                    variant={isLocked || isVerified ? "outline" : "default"}
                    disabled={isLocked}
                    onClick={() => !isLocked && router.push(verification.href)}
                  >
                    {isLocked ? (
                      <>
                        <Lock className="w-4 h-4 mr-2" />
                        Complete previous step
                      </>
                    ) : isVerified ? (
                      <>
                        View / Renew Verification
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </>
                    ) : (
                      <>
                        Start Verification
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </>
                    )}
                  </Button>
                  {isLocked && (
                    <p className="mt-3 text-xs text-[#A5A7BF] text-center">
                      Finish {verificationSteps[index - 1]?.title?.toLowerCase()} before continuing.
                    </p>
                  )}
                </div>
              </Card>
            )
          })}
        </div>

        {/* Info Section */}
        <Card className="bg-gradient-to-br from-white/5 to-white/[0.02] backdrop-blur-xl border border-white/10 shadow-2xl">
          <CardContent className="py-8 md:py-10">
            <div className="text-center mb-8">
              <h3 className="text-2xl md:text-3xl font-bold text-[#E6E7EF] mb-2">How It Works</h3>
              <p className="text-[#A5A7BF]">Simple three-step process to get your credentials verified</p>
            </div>
            <div className="grid md:grid-cols-3 gap-6 md:gap-8">
              <div className="text-center space-y-4 p-6 rounded-xl bg-white/5 border border-white/10 hover:border-[#15DACC]/30 transition-colors duration-300">
                <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-br from-[#15DACC]/20 to-[#15DACC]/10 flex items-center justify-center font-bold text-2xl text-[#15DACC] border border-[#15DACC]/30 shadow-lg">
                  1
                </div>
                <h4 className="font-semibold text-lg text-[#E6E7EF]">Submit Information</h4>
                <p className="text-sm text-[#A5A7BF] leading-relaxed">
                  Provide the required documents or complete the verification steps securely
                </p>
              </div>
              <div className="text-center space-y-4 p-6 rounded-xl bg-white/5 border border-white/10 hover:border-[#15DACC]/30 transition-colors duration-300">
                <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-br from-[#15DACC]/20 to-[#15DACC]/10 flex items-center justify-center font-bold text-2xl text-[#15DACC] border border-[#15DACC]/30 shadow-lg">
                  2
                </div>
                <h4 className="font-semibold text-lg text-[#E6E7EF]">Verification Process</h4>
                <p className="text-sm text-[#A5A7BF] leading-relaxed">
                  Our system verifies your information and generates a cryptographic zero-knowledge proof
                </p>
              </div>
              <div className="text-center space-y-4 p-6 rounded-xl bg-white/5 border border-white/10 hover:border-[#15DACC]/30 transition-colors duration-300">
                <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-br from-[#15DACC]/20 to-[#15DACC]/10 flex items-center justify-center font-bold text-2xl text-[#15DACC] border border-[#15DACC]/30 shadow-lg">
                  3
                </div>
                <h4 className="font-semibold text-lg text-[#E6E7EF]">Receive Credential</h4>
                <p className="text-sm text-[#A5A7BF] leading-relaxed">
                  Your verified credential is issued on-chain and added to your wallet securely
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default function VerifyPage() {
  return (
    <AuthGuard>
      <VerifyPageContent />
    </AuthGuard>
  )
}

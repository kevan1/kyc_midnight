"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Shield, User, Calendar, ArrowRight, CheckCircle2, Clock, Lock, Sparkles } from "lucide-react"
import { useKYCStore } from "@/lib/store"
import { AuthGuard } from "@/components/auth-guard"

function HomePageContent() {
  const { user } = useKYCStore()

  const availableCredentials = [
    {
      type: "Identity",
      icon: Shield,
      title: "Identity Verification",
      description: "Verify your identity with government-issued documents using advanced document verification",
      route: "/verify/identity",
      status: user.kyc.identity,
      color: "from-blue-500 to-cyan-500",
      bgGradient: "from-blue-500/10 to-cyan-500/10",
      iconBg: "bg-blue-500/20",
      iconColor: "text-blue-400",
    },
    {
      type: "Human",
      icon: User,
      title: "Human Verification",
      description: "Prove you're human with advanced liveness detection and CAPTCHA verification",
      route: "/verify/human",
      status: user.kyc.human,
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
      route: "/verify/age",
      status: user.kyc.age,
      color: "from-emerald-500 to-teal-500",
      bgGradient: "from-emerald-500/10 to-teal-500/10",
      iconBg: "bg-emerald-500/20",
      iconColor: "text-emerald-400",
    },
  ]

  const getStatusBadge = (status: string) => {
    if (status === "Verified") {
      return (
        <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 px-3 py-1">
          <CheckCircle2 className="w-3 h-3 mr-1.5" />
          Verified
        </Badge>
      )
    }
    if (status === "Pending") {
      return (
        <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 px-3 py-1">
          <Clock className="w-3 h-3 mr-1.5" />
          Pending
        </Badge>
      )
    }
    return (
      <Badge className="bg-slate-500/20 text-slate-400 border-slate-500/30 px-3 py-1">
        <Lock className="w-3 h-3 mr-1.5" />
        Not Started
      </Badge>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0A1F] via-[#0F0E2A] to-[#1a1840] relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-[#15DACC]/5 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl animate-pulse delay-1000" />
        <div className="absolute top-1/2 left-1/2 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl animate-pulse delay-2000" />
      </div>

      <div className="container mx-auto px-4 py-12 md:py-16 max-w-6xl relative z-10">
        {/* Hero Section */}
        <div className="text-center mb-12 md:mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#15DACC]/10 border border-[#15DACC]/20 mb-6">
            <Sparkles className="w-4 h-4 text-[#15DACC]" />
            <span className="text-sm font-medium text-[#15DACC]">Blockchain-Powered Verification</span>
          </div>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-4 bg-gradient-to-r from-[#E6E7EF] via-[#15DACC] to-[#E6E7EF] bg-clip-text text-transparent">
            Available Credentials
          </h1>
          <p className="text-lg md:text-xl text-[#A5A7BF] max-w-2xl mx-auto leading-relaxed">
            Select a credential to claim and verify your identity. All credentials are stored securely on the Midnight blockchain using zero-knowledge proofs.
          </p>
        </div>

        {/* Credentials Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8 mb-12">
          {availableCredentials.map((credential, index) => {
            const Icon = credential.icon
            const isVerified = credential.status === "Verified"
            const isPending = credential.status === "Pending"

            return (
              <Card
                key={credential.type}
                className="group relative bg-gradient-to-br from-white/5 to-white/[0.02] backdrop-blur-xl border border-white/10 shadow-2xl hover:shadow-[#15DACC]/20 hover:border-[#15DACC]/30 transition-all duration-500 overflow-hidden"
                style={{
                  animationDelay: `${index * 100}ms`,
                }}
              >
                {/* Gradient overlay on hover */}
                <div className={`absolute inset-0 bg-gradient-to-br ${credential.bgGradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
                
                {/* Animated border glow */}
                <div className="absolute inset-0 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                  <div className={`absolute inset-0 rounded-lg bg-gradient-to-r ${credential.color} blur-xl opacity-20`} />
                </div>

                <CardContent className="p-6 md:p-8 relative z-10">
                  {/* Icon and Status */}
                  <div className="flex items-start justify-between mb-6">
                    <div className={`relative ${credential.iconBg} p-4 rounded-2xl group-hover:scale-110 transition-transform duration-300`}>
                      <Icon className={`w-8 h-8 ${credential.iconColor} group-hover:scale-110 transition-transform duration-300`} />
                      <div className={`absolute inset-0 bg-gradient-to-br ${credential.color} opacity-0 group-hover:opacity-20 rounded-2xl transition-opacity duration-300`} />
                    </div>
                    {getStatusBadge(credential.status)}
                  </div>

                  {/* Title and Description */}
                  <div className="mb-6">
                    <h3 className="text-xl md:text-2xl font-bold text-[#E6E7EF] mb-3 group-hover:text-[#15DACC] transition-colors duration-300">
                      {credential.title}
                    </h3>
                    <p className="text-sm md:text-base text-[#A5A7BF] leading-relaxed line-clamp-3">
                      {credential.description}
                    </p>
                  </div>

                  {/* Action Button */}
                  {isVerified ? (
                    <Button
                      asChild
                      variant="outline"
                      size="lg"
                      className="w-full bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 hover:border-emerald-500/50 hover:text-emerald-300 transition-all duration-300 group/btn"
                    >
                      <Link href="/credentials" className="flex items-center justify-center">
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                        View Credential
                        <ArrowRight className="w-4 h-4 ml-2 group-hover/btn:translate-x-1 transition-transform" />
                      </Link>
                    </Button>
                  ) : isPending ? (
                    <Button
                      asChild
                      variant="outline"
                      size="lg"
                      className="w-full bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20 hover:border-amber-500/50 hover:text-amber-300 transition-all duration-300 group/btn"
                    >
                      <Link href={credential.route} className="flex items-center justify-center">
                        <Clock className="w-4 h-4 mr-2" />
                        Continue Verification
                        <ArrowRight className="w-4 h-4 ml-2 group-hover/btn:translate-x-1 transition-transform" />
                      </Link>
                    </Button>
                  ) : (
                    <Button
                      asChild
                      size="lg"
                      className={`w-full bg-gradient-to-r ${credential.color} hover:opacity-90 text-white font-semibold shadow-lg shadow-[#15DACC]/20 hover:shadow-[#15DACC]/40 transition-all duration-300 group/btn`}
                    >
                      <Link href={credential.route} className="flex items-center justify-center">
                        <span>Claim Credential</span>
                        <ArrowRight className="w-5 h-5 ml-2 group-hover/btn:translate-x-1 transition-transform" />
                      </Link>
                    </Button>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>

        {/* Footer Info */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-white/5 border border-white/10 backdrop-blur-sm">
            <Shield className="w-5 h-5 text-[#15DACC]" />
            <p className="text-sm text-[#A5A7BF]">
              <span className="text-[#E6E7EF] font-medium">Secure & Private:</span> All credentials are stored on-chain with zero-knowledge proofs
            </p>
          </div>
          <p className="text-xs text-[#6B6D85]">
            Powered by Midnight Network • Your privacy is protected
          </p>
        </div>
      </div>
    </div>
  )
}

export default function HomePage() {
  return (
    <AuthGuard>
      <HomePageContent />
    </AuthGuard>
  )
}

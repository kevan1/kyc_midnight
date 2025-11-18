"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Shield, User, Calendar, AlertCircle, CheckCircle2, Clock, XCircle, ArrowRight, Sparkles, FileText, MapPin } from "lucide-react"
import { useKYCStore } from "@/lib/store"
import { shortenAddress } from "@/lib/blockchain-utils"
import type { CredentialType } from "@/lib/types"
import { AuthGuard } from "@/components/auth-guard"

function CredentialsPageContent() {
  const { user, credentials } = useKYCStore()
  const [filter, setFilter] = useState<CredentialType | "All">("All")

  const stats = useMemo(() => {
    const verified = credentials.filter((c) => c.status === "Verified").length
    const pending = credentials.filter((c) => c.status === "Pending").length
    const total = credentials.length
    const byType = {
      Identity: credentials.filter((c) => c.type === "Identity").length,
      Human: credentials.filter((c) => c.type === "Human").length,
      Age: credentials.filter((c) => c.type === "Age").length,
      Country: credentials.filter((c) => c.type === "Country").length,
    }
    return { verified, pending, total, byType }
  }, [credentials])

  if (!user.walletAddress) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0A0A1F] via-[#0F0E2A] to-[#1a1840] flex items-center justify-center px-4">
        <Card className="max-w-md w-full bg-white/5 backdrop-blur-xl border-white/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-[#E6E7EF]">
              <AlertCircle className="w-5 h-5 text-amber-400" />
              Wallet Not Connected
            </CardTitle>
            <CardDescription className="text-[#A5A7BF]">Please connect your wallet to view your credentials</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-[#A5A7BF] mb-4">
              You need to connect your wallet to access your blockchain credentials.
            </p>
            <Button className="w-full" disabled>
              Connect Wallet
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const filteredCredentials = filter === "All" ? credentials : credentials.filter((c) => c.type === filter)

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "Verified":
        return <CheckCircle2 className="w-4 h-4" />
      case "Pending":
        return <Clock className="w-4 h-4" />
      case "Expired":
      case "Revoked":
        return <XCircle className="w-4 h-4" />
      default:
        return <AlertCircle className="w-4 h-4" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Verified":
        return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
      case "Pending":
        return "bg-amber-500/20 text-amber-400 border-amber-500/30"
      case "Expired":
      case "Revoked":
        return "bg-red-500/20 text-red-400 border-red-500/30"
      default:
        return "bg-slate-500/20 text-slate-400 border-slate-500/30"
    }
  }

  const getTypeIcon = (type: CredentialType) => {
    switch (type) {
      case "Identity":
        return <Shield className="w-5 h-5" />
      case "Human":
        return <User className="w-5 h-5" />
      case "Age":
        return <Calendar className="w-5 h-5" />
      case "Country":
        return <MapPin className="w-5 h-5" />
      default:
        return <FileText className="w-5 h-5" />
    }
  }

  const getTypeColor = (type: CredentialType) => {
    switch (type) {
      case "Identity":
        return {
          iconBg: "bg-blue-500/20",
          iconColor: "text-blue-400",
          gradient: "from-blue-500/10 to-cyan-500/10",
          border: "border-blue-500/30",
        }
      case "Human":
        return {
          iconBg: "bg-purple-500/20",
          iconColor: "text-purple-400",
          gradient: "from-purple-500/10 to-pink-500/10",
          border: "border-purple-500/30",
        }
      case "Age":
        return {
          iconBg: "bg-emerald-500/20",
          iconColor: "text-emerald-400",
          gradient: "from-emerald-500/10 to-teal-500/10",
          border: "border-emerald-500/30",
        }
      case "Country":
        return {
          iconBg: "bg-amber-500/20",
          iconColor: "text-amber-400",
          gradient: "from-amber-500/10 to-orange-500/10",
          border: "border-amber-500/30",
        }
      default:
        return {
          iconBg: "bg-gray-500/20",
          iconColor: "text-gray-400",
          gradient: "from-gray-500/10 to-gray-500/10",
          border: "border-gray-500/30",
        }
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0A1F] via-[#0F0E2A] to-[#1a1840] relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-[#15DACC]/5 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>

      <div className="container mx-auto px-4 py-8 md:py-12 max-w-7xl relative z-10">
        {/* Header */}
        <div className="mb-8 md:mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#15DACC]/10 border border-[#15DACC]/20 mb-6">
            <Sparkles className="w-4 h-4 text-[#15DACC]" />
            <span className="text-sm font-medium text-[#15DACC]">Your Digital Identity</span>
          </div>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-4 bg-gradient-to-r from-[#E6E7EF] via-[#15DACC] to-[#E6E7EF] bg-clip-text text-transparent">
            My Credentials
          </h1>
          <p className="text-lg md:text-xl text-[#A5A7BF] max-w-2xl">
            Manage and view your blockchain-based verification credentials stored securely on the Midnight network
          </p>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mb-8">
          <Card className="bg-gradient-to-br from-white/5 to-white/[0.02] backdrop-blur-xl border-white/10">
            <CardContent className="p-4 md:p-6">
              <div className="flex items-center justify-between mb-2">
                <div className="p-2 rounded-lg bg-[#15DACC]/20">
                  <FileText className="w-5 h-5 text-[#15DACC]" />
                </div>
              </div>
              <div className="text-2xl md:text-3xl font-bold text-[#E6E7EF] mb-1">{stats.total}</div>
              <div className="text-xs md:text-sm text-[#A5A7BF]">Total Credentials</div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-white/5 to-white/[0.02] backdrop-blur-xl border-white/10">
            <CardContent className="p-4 md:p-6">
              <div className="flex items-center justify-between mb-2">
                <div className="p-2 rounded-lg bg-emerald-500/20">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                </div>
              </div>
              <div className="text-2xl md:text-3xl font-bold text-emerald-400 mb-1">{stats.verified}</div>
              <div className="text-xs md:text-sm text-[#A5A7BF]">Verified</div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-white/5 to-white/[0.02] backdrop-blur-xl border-white/10">
            <CardContent className="p-4 md:p-6">
              <div className="flex items-center justify-between mb-2">
                <div className="p-2 rounded-lg bg-amber-500/20">
                  <Clock className="w-5 h-5 text-amber-400" />
                </div>
              </div>
              <div className="text-2xl md:text-3xl font-bold text-amber-400 mb-1">{stats.pending}</div>
              <div className="text-xs md:text-sm text-[#A5A7BF]">Pending</div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-white/5 to-white/[0.02] backdrop-blur-xl border-white/10">
            <CardContent className="p-4 md:p-6">
              <div className="flex items-center justify-between mb-2">
                <div className="p-2 rounded-lg bg-blue-500/20">
                  <Shield className="w-5 h-5 text-blue-400" />
                </div>
              </div>
              <div className="text-2xl md:text-3xl font-bold text-blue-400 mb-1">{stats.byType.Identity}</div>
              <div className="text-xs md:text-sm text-[#A5A7BF]">Identity</div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Tabs value={filter} onValueChange={(v) => setFilter(v as CredentialType | "All")} className="w-full mb-8">
          <TabsList className="inline-flex h-12 items-center justify-center gap-2 bg-white/5 backdrop-blur-xl border border-white/10 p-1.5 rounded-2xl shadow-lg">
            <TabsTrigger 
              value="All" 
              className="relative px-6 py-2.5 text-sm font-medium rounded-xl transition-all duration-300 data-[state=inactive]:text-[#A5A7BF] data-[state=inactive]:hover:text-[#E6E7EF] data-[state=inactive]:hover:bg-white/5 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#15DACC]/20 data-[state=active]:to-[#15DACC]/10 data-[state=active]:text-[#15DACC] data-[state=active]:shadow-lg data-[state=active]:shadow-[#15DACC]/20 data-[state=active]:border data-[state=active]:border-[#15DACC]/30"
            >
              <span className="relative z-10">All</span>
            </TabsTrigger>
            <TabsTrigger 
              value="Identity"
              className="relative px-6 py-2.5 text-sm font-medium rounded-xl transition-all duration-300 data-[state=inactive]:text-[#A5A7BF] data-[state=inactive]:hover:text-[#E6E7EF] data-[state=inactive]:hover:bg-white/5 data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500/20 data-[state=active]:to-blue-500/10 data-[state=active]:text-blue-400 data-[state=active]:shadow-lg data-[state=active]:shadow-blue-500/20 data-[state=active]:border data-[state=active]:border-blue-500/30"
            >
              <span className="relative z-10 flex items-center gap-2">
                <Shield className="w-4 h-4" />
                Identity
              </span>
            </TabsTrigger>
            <TabsTrigger 
              value="Human"
              className="relative px-6 py-2.5 text-sm font-medium rounded-xl transition-all duration-300 data-[state=inactive]:text-[#A5A7BF] data-[state=inactive]:hover:text-[#E6E7EF] data-[state=inactive]:hover:bg-white/5 data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500/20 data-[state=active]:to-purple-500/10 data-[state=active]:text-purple-400 data-[state=active]:shadow-lg data-[state=active]:shadow-purple-500/20 data-[state=active]:border data-[state=active]:border-purple-500/30"
            >
              <span className="relative z-10 flex items-center gap-2">
                <User className="w-4 h-4" />
                Human
              </span>
            </TabsTrigger>
            <TabsTrigger 
              value="Age"
              className="relative px-6 py-2.5 text-sm font-medium rounded-xl transition-all duration-300 data-[state=inactive]:text-[#A5A7BF] data-[state=inactive]:hover:text-[#E6E7EF] data-[state=inactive]:hover:bg-white/5 data-[state=active]:bg-gradient-to-r data-[state=active]:from-emerald-500/20 data-[state=active]:to-emerald-500/10 data-[state=active]:text-emerald-400 data-[state=active]:shadow-lg data-[state=active]:shadow-emerald-500/20 data-[state=active]:border data-[state=active]:border-emerald-500/30"
            >
              <span className="relative z-10 flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Age
              </span>
            </TabsTrigger>
            <TabsTrigger 
              value="Country"
              className="relative px-6 py-2.5 text-sm font-medium rounded-xl transition-all duration-300 data-[state=inactive]:text-[#A5A7BF] data-[state=inactive]:hover:text-[#E6E7EF] data-[state=inactive]:hover:bg-white/5 data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-500/20 data-[state=active]:to-amber-500/10 data-[state=active]:text-amber-400 data-[state=active]:shadow-lg data-[state=active]:shadow-amber-500/20 data-[state=active]:border data-[state=active]:border-amber-500/30"
            >
              <span className="relative z-10 flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                Country
              </span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value={filter} className="mt-6">
            {filteredCredentials.length === 0 ? (
              <Card className="bg-gradient-to-br from-white/5 to-white/[0.02] backdrop-blur-xl border-white/10">
                <CardContent className="py-16 text-center">
                  <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-white/5 flex items-center justify-center">
                    <AlertCircle className="w-10 h-10 text-[#A5A7BF]" />
                  </div>
                  <h3 className="text-xl md:text-2xl font-bold text-[#E6E7EF] mb-3">No Credentials Found</h3>
                  <p className="text-[#A5A7BF] mb-8 max-w-md mx-auto">
                    {filter === "All"
                      ? "You don't have any credentials yet. Start by claiming your first credential to verify your identity."
                      : `You don't have any ${filter} credentials yet. Complete the verification to get started.`}
                  </p>
                  <Link href="/">
                    <Button className="bg-gradient-to-r from-[#15DACC] to-[#6255CB] hover:opacity-90 text-white font-semibold shadow-lg shadow-[#15DACC]/20">
                      Get Verified
                      <ArrowRight className="ml-2 w-5 h-5" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:gap-6">
                {filteredCredentials.map((credential) => {
                  const typeColors = getTypeColor(credential.type)
                  return (
                    <Card
                      key={credential.id}
                      className="group relative bg-gradient-to-br from-white/5 to-white/[0.02] backdrop-blur-xl border border-white/10 shadow-2xl hover:shadow-[#15DACC]/20 hover:border-[#15DACC]/30 transition-all duration-500 overflow-hidden"
                    >
                      {/* Gradient overlay on hover */}
                      <div className={`absolute inset-0 bg-gradient-to-br ${typeColors.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
                      
                      <CardHeader className="relative z-10">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-4">
                            <div className={`relative ${typeColors.iconBg} p-3 rounded-xl group-hover:scale-110 transition-transform duration-300`}>
                              {getTypeIcon(credential.type)}
                              <div className={`absolute inset-0 bg-gradient-to-br ${typeColors.gradient} opacity-0 group-hover:opacity-30 rounded-xl transition-opacity duration-300`} />
                            </div>
                            <div>
                              <CardTitle className="text-xl md:text-2xl text-[#E6E7EF] group-hover:text-[#15DACC] transition-colors duration-300">
                                {credential.type} Verification
                              </CardTitle>
                              <CardDescription className="mt-1.5 text-[#A5A7BF]">
                                Issued by {shortenAddress(credential.issuer)}
                              </CardDescription>
                            </div>
                          </div>
                          <Badge className={`${getStatusColor(credential.status)} px-3 py-1.5`}>
                            <span className="flex items-center gap-1.5">
                              {getStatusIcon(credential.status)}
                              {credential.status}
                            </span>
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4 relative z-10">
                        {/* Metadata */}
                        {Object.keys(credential.metadata).length > 0 && (
                          <div className="grid grid-cols-2 gap-3 p-4 bg-white/5 rounded-xl border border-white/10">
                            {credential.metadata.fullName && (
                              <div>
                                <div className="text-xs text-[#A5A7BF] mb-1">Name</div>
                                <div className="text-sm font-medium text-[#E6E7EF]">{credential.metadata.fullName}</div>
                              </div>
                            )}
                            {credential.metadata.country && (
                              <div>
                                <div className="text-xs text-[#A5A7BF] mb-1">Country</div>
                                <div className="text-sm font-medium text-[#E6E7EF]">{credential.metadata.country}</div>
                              </div>
                            )}
                            {credential.metadata.docType && (
                              <div>
                                <div className="text-xs text-[#A5A7BF] mb-1">Document Type</div>
                                <div className="text-sm font-medium text-[#E6E7EF]">{credential.metadata.docType}</div>
                              </div>
                            )}
                            {credential.metadata.overAge !== undefined && (
                              <div>
                                <div className="text-xs text-[#A5A7BF] mb-1">Age Status</div>
                                <div className="text-sm font-medium text-[#E6E7EF]">
                                  {credential.metadata.overAge ? "Over 18" : "Under 18"}
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* ZK Proof Summary */}
                        {credential.zkProofSummary && (
                          <div className="p-4 bg-[#15DACC]/10 border border-[#15DACC]/20 rounded-xl">
                            <div className="text-xs text-[#15DACC] mb-2 font-medium">Zero-Knowledge Proof</div>
                            <div className="text-sm text-[#E6E7EF]">{credential.zkProofSummary}</div>
                          </div>
                        )}

                        {/* Revocation Reason */}
                        {credential.revocationReason && (
                          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
                            <div className="text-xs text-red-400 mb-2 font-medium">Revocation Reason</div>
                            <div className="text-sm text-red-300">{credential.revocationReason}</div>
                          </div>
                        )}

                        {/* Dates */}
                        <div className="flex flex-wrap gap-6 text-sm pt-2">
                          <div>
                            <span className="text-[#A5A7BF]">Issued:</span>{" "}
                            <span className="font-medium text-[#E6E7EF]">{formatDate(credential.issueTime)}</span>
                          </div>
                          <div>
                            <span className="text-[#A5A7BF]">Expires:</span>{" "}
                            <span className="font-medium text-[#E6E7EF]">{formatDate(credential.expiryTime)}</span>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2 pt-2">
                          <Link href={`/credentials/${credential.id}`} className="flex-1">
                            <Button 
                              variant="outline" 
                              className="w-full bg-white/5 border-white/10 text-[#E6E7EF] hover:bg-[#15DACC]/10 hover:border-[#15DACC]/30 hover:text-[#15DACC] transition-all duration-300 group/btn"
                            >
                              View Details
                              <ArrowRight className="w-4 h-4 ml-2 group-hover/btn:translate-x-1 transition-transform" />
                            </Button>
                          </Link>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Get More Credentials CTA */}
        {credentials.length > 0 && (
          <Card className="bg-gradient-to-r from-[#15DACC]/10 to-purple-500/10 border-[#15DACC]/20 backdrop-blur-xl">
            <CardContent className="py-6 md:py-8">
              <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                <div>
                  <h3 className="font-semibold mb-2 text-[#E6E7EF] text-lg">Need More Credentials?</h3>
                  <p className="text-sm text-[#A5A7BF]">
                    Complete additional verifications to expand your digital identity and unlock more features
                  </p>
                </div>
                <Link href="/">
                  <Button className="bg-gradient-to-r from-[#15DACC] to-[#6255CB] hover:opacity-90 text-white font-semibold shadow-lg shadow-[#15DACC]/20">
                    Start New Verification
                    <ArrowRight className="ml-2 w-5 h-5" />
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

export default function CredentialsPage() {
  return (
    <AuthGuard>
      <CredentialsPageContent />
    </AuthGuard>
  )
}

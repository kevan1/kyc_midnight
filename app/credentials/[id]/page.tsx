"use client"

import { use } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  Shield,
  User,
  Calendar,
  ExternalLink,
  ArrowLeft,
  Copy,
  CheckCircle2,
  Clock,
  XCircle,
  AlertCircle,
  Sparkles,
} from "lucide-react"
import { useKYCStore } from "@/lib/store"
import { shortenAddress, getMidnightExplorerUrl, getMidnightExplorerBlockUrl } from "@/lib/blockchain-utils"
import { useToast } from "@/hooks/use-toast"

export default function CredentialDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { toast } = useToast()
  const { credentials, issuers } = useKYCStore()

  const credential = credentials.find((c) => c.id === id)
  const issuer = issuers.find((i) => i.address === credential?.issuer)

  if (!credential) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0A0A1F] via-[#0F0E2A] to-[#1a1840] flex items-center justify-center px-4">
        <Card className="max-w-md w-full bg-white/5 backdrop-blur-xl border-white/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-[#E6E7EF]">
              <AlertCircle className="w-5 h-5 text-amber-400" />
              Credential Not Found
            </CardTitle>
            <CardDescription className="text-[#A5A7BF]">The credential you're looking for doesn't exist</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/credentials">
              <Button className="w-full bg-gradient-to-r from-[#15DACC] to-[#6255CB] hover:opacity-90 text-white font-semibold">
                Back to Credentials
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "Identity":
        return <Shield className="w-6 h-6" />
      case "Human":
        return <User className="w-6 h-6" />
      case "Age":
        return <Calendar className="w-6 h-6" />
    }
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case "Identity":
        return {
          iconBg: "bg-blue-500/20",
          iconColor: "text-blue-400",
          gradient: "from-blue-500/10 to-cyan-500/10",
          border: "border-blue-500/30",
          badgeGradient: "from-blue-500/20 to-cyan-500/20",
        }
      case "Human":
        return {
          iconBg: "bg-purple-500/20",
          iconColor: "text-purple-400",
          gradient: "from-purple-500/10 to-pink-500/10",
          border: "border-purple-500/30",
          badgeGradient: "from-purple-500/20 to-pink-500/20",
        }
      case "Age":
        return {
          iconBg: "bg-emerald-500/20",
          iconColor: "text-emerald-400",
          gradient: "from-emerald-500/10 to-teal-500/10",
          border: "border-emerald-500/30",
          badgeGradient: "from-emerald-500/20 to-teal-500/20",
        }
      default:
        return {
          iconBg: "bg-[#15DACC]/20",
          iconColor: "text-[#15DACC]",
          gradient: "from-[#15DACC]/10 to-[#15DACC]/5",
          border: "border-[#15DACC]/30",
          badgeGradient: "from-[#15DACC]/20 to-[#15DACC]/10",
        }
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "Verified":
        return <CheckCircle2 className="w-5 h-5" />
      case "Pending":
        return <Clock className="w-5 h-5" />
      case "Expired":
      case "Revoked":
        return <XCircle className="w-5 h-5" />
      default:
        return <AlertCircle className="w-5 h-5" />
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    toast({
      title: "Copied!",
      description: `${label} copied to clipboard`,
    })
  }

  const typeColors = getTypeColor(credential.type)

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0A1F] via-[#0F0E2A] to-[#1a1840] relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-[#15DACC]/5 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>

      <div className="container mx-auto px-4 py-8 md:py-12 max-w-5xl relative z-10">
        {/* Back Button */}
        <Button 
          variant="ghost" 
          onClick={() => router.back()} 
          className="mb-6 text-[#A5A7BF] hover:text-[#E6E7EF] hover:bg-white/5"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>

        {/* Header Card */}
        <Card className="relative bg-gradient-to-br from-white/5 to-white/[0.02] backdrop-blur-xl border border-white/10 shadow-2xl overflow-hidden mb-8">
          {/* Gradient overlay */}
          <div className={`absolute inset-0 bg-gradient-to-br ${typeColors.gradient} opacity-50`} />
          
          <CardHeader className="relative z-10 pb-6">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
              <div className="flex items-start gap-6">
                <div className={`relative ${typeColors.iconBg} p-5 rounded-2xl shadow-lg`}>
                  <div className={typeColors.iconColor}>
                    {getTypeIcon(credential.type)}
                  </div>
                  <div className={`absolute inset-0 bg-gradient-to-br ${typeColors.gradient} opacity-30 rounded-2xl`} />
                </div>
                <div className="flex-1">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#15DACC]/10 border border-[#15DACC]/20 mb-3">
                    <Sparkles className="w-3 h-3 text-[#15DACC]" />
                    <span className="text-xs font-medium text-[#15DACC]">{credential.type} Credential</span>
                  </div>
                  <CardTitle className="text-3xl md:text-4xl font-bold text-[#E6E7EF] mb-2">
                    {credential.type} Verification
                  </CardTitle>
                  <CardDescription className="text-[#A5A7BF] text-base">
                    Credential ID: <span className="font-mono text-sm">{credential.id}</span>
                  </CardDescription>
                </div>
              </div>
              <Badge className={`${getStatusColor(credential.status)} text-base px-4 py-2 h-fit`}>
                <span className="flex items-center gap-2">
                  {getStatusIcon(credential.status)}
                  {credential.status}
                </span>
              </Badge>
            </div>
          </CardHeader>
        </Card>

        {/* Credential Details */}
        <Card className="bg-gradient-to-br from-white/5 to-white/[0.02] backdrop-blur-xl border border-white/10 shadow-2xl mb-8">
          <CardHeader className="pb-4">
            <CardTitle className="text-2xl font-bold text-[#E6E7EF]">Credential Details</CardTitle>
            <CardDescription className="text-[#A5A7BF]">Blockchain verification information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                <div className="text-xs font-medium text-[#A5A7BF] mb-2 uppercase tracking-wide">Holder Address</div>
                <div className="flex items-center gap-2">
                  <code className="text-sm font-mono bg-white/5 px-3 py-2 rounded-lg text-[#E6E7EF] flex-1 border border-white/10">
                    {shortenAddress(credential.holder, 8)}
                  </code>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 hover:bg-white/10 hover:text-[#15DACC] transition-colors"
                    onClick={() => copyToClipboard(credential.holder, "Holder address")}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                <div className="text-xs font-medium text-[#A5A7BF] mb-2 uppercase tracking-wide">Issuer</div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="text-sm font-semibold text-[#E6E7EF]">{issuer?.name || "Unknown Issuer"}</div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 hover:bg-white/10 hover:text-[#15DACC] transition-colors"
                    onClick={() => copyToClipboard(credential.issuer, "Issuer address")}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
                <code className="text-xs font-mono text-[#A5A7BF]">{shortenAddress(credential.issuer, 6)}</code>
              </div>

              <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                <div className="text-xs font-medium text-[#A5A7BF] mb-2 uppercase tracking-wide">Issue Date</div>
                <div className="text-sm font-semibold text-[#E6E7EF]">{formatDate(credential.issueTime)}</div>
              </div>

              <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                <div className="text-xs font-medium text-[#A5A7BF] mb-2 uppercase tracking-wide">Expiry Date</div>
                <div className="text-sm font-semibold text-[#E6E7EF]">{formatDate(credential.expiryTime)}</div>
              </div>
            </div>

            <Separator className="bg-white/10" />

            <div className="space-y-4">
              {credential.txHash && (
                <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                  <div className="text-xs font-medium text-[#A5A7BF] mb-2 uppercase tracking-wide">Transaction Hash</div>
                  <div className="flex items-center gap-2">
                    <code className="text-xs font-mono bg-white/5 px-3 py-2 rounded-lg text-[#E6E7EF] flex-1 overflow-x-auto border border-white/10">
                      {credential.txHash}
                    </code>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 hover:bg-white/10 hover:text-[#15DACC] transition-colors"
                      onClick={() => copyToClipboard(credential.txHash, "Transaction hash")}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}

              {credential.blockNumber !== undefined && (
                <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                  <div className="text-xs font-medium text-[#A5A7BF] mb-2 uppercase tracking-wide">Block Number</div>
                  <div className="flex items-center gap-2">
                    <code className="text-xs font-mono bg-white/5 px-3 py-2 rounded-lg text-[#E6E7EF] flex-1 overflow-x-auto border border-white/10">
                      {credential.blockNumber}
                    </code>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 hover:bg-white/10 hover:text-[#15DACC] transition-colors"
                      onClick={() => copyToClipboard(String(credential.blockNumber), "Block number")}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 hover:bg-white/10 hover:text-[#15DACC] transition-colors"
                      onClick={() => window.open(getMidnightExplorerBlockUrl(credential.blockNumber!), "_blank")}
                    >
                      <ExternalLink className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}

              <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                <div className="text-xs font-medium text-[#A5A7BF] mb-2 uppercase tracking-wide">Credential Hash</div>
                <div className="flex items-center gap-2">
                  <code className="text-xs font-mono bg-white/5 px-3 py-2 rounded-lg text-[#E6E7EF] flex-1 overflow-x-auto border border-white/10">
                    {credential.credentialHash}
                  </code>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 hover:bg-white/10 hover:text-[#15DACC] transition-colors"
                    onClick={() => copyToClipboard(credential.credentialHash, "Credential hash")}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                <div className="text-xs font-medium text-[#A5A7BF] mb-2 uppercase tracking-wide">Merkle Leaf</div>
                <div className="flex items-center gap-2">
                  <code className="text-xs font-mono bg-white/5 px-3 py-2 rounded-lg text-[#E6E7EF] flex-1 overflow-x-auto border border-white/10">
                    {credential.merkleLeaf}
                  </code>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 hover:bg-white/10 hover:text-[#15DACC] transition-colors"
                    onClick={() => copyToClipboard(credential.merkleLeaf, "Merkle leaf")}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Metadata */}
        {Object.keys(credential.metadata).length > 0 && (
          <Card className="bg-gradient-to-br from-white/5 to-white/[0.02] backdrop-blur-xl border border-white/10 shadow-2xl mb-8">
            <CardHeader className="pb-4">
              <CardTitle className="text-2xl font-bold text-[#E6E7EF]">Metadata</CardTitle>
              <CardDescription className="text-[#A5A7BF]">Additional information stored with this credential</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-4">
                {credential.metadata.fullName && (
                  <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                    <div className="text-xs font-medium text-[#A5A7BF] mb-2 uppercase tracking-wide">Full Name</div>
                    <div className="text-base font-semibold text-[#E6E7EF]">{credential.metadata.fullName}</div>
                  </div>
                )}
                {credential.metadata.country && (
                  <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                    <div className="text-xs font-medium text-[#A5A7BF] mb-2 uppercase tracking-wide">Country</div>
                    <div className="text-base font-semibold text-[#E6E7EF]">{credential.metadata.country}</div>
                  </div>
                )}
                {credential.metadata.docType && (
                  <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                    <div className="text-xs font-medium text-[#A5A7BF] mb-2 uppercase tracking-wide">Document Type</div>
                    <div className="text-base font-semibold text-[#E6E7EF]">{credential.metadata.docType}</div>
                  </div>
                )}
                {credential.metadata.overAge !== undefined && (
                  <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                    <div className="text-xs font-medium text-[#A5A7BF] mb-2 uppercase tracking-wide">Age Status</div>
                    <div className="text-base font-semibold text-[#E6E7EF]">{credential.metadata.overAge ? "Over 18" : "Under 18"}</div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* ZK Proof */}
        {credential.zkProofSummary && (
          <Card className="bg-gradient-to-br from-[#15DACC]/10 to-[#15DACC]/5 backdrop-blur-xl border-[#15DACC]/20 shadow-2xl mb-8">
            <CardHeader className="pb-4">
              <CardTitle className="text-2xl font-bold text-[#E6E7EF] flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-[#15DACC]" />
                Zero-Knowledge Proof
              </CardTitle>
              <CardDescription className="text-[#A5A7BF]">Privacy-preserving verification details</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="p-5 bg-[#15DACC]/10 border border-[#15DACC]/20 rounded-xl">
                <p className="text-sm text-[#E6E7EF] leading-relaxed">{credential.zkProofSummary}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Revocation */}
        {credential.revocationReason && (
          <Card className="bg-gradient-to-br from-red-500/10 to-red-500/5 backdrop-blur-xl border-red-500/20 shadow-2xl mb-8">
            <CardHeader className="pb-4">
              <CardTitle className="text-2xl font-bold text-red-400 flex items-center gap-2">
                <XCircle className="w-5 h-5" />
                Revocation Details
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="p-5 bg-red-500/10 border border-red-500/20 rounded-xl">
                <p className="text-sm text-red-300 leading-relaxed">{credential.revocationReason}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3">
          {credential.txHash && (
            <Button
              variant="outline"
              className="flex-1 bg-white/5 border-white/10 text-[#E6E7EF] hover:bg-[#15DACC]/10 hover:border-[#15DACC]/30 hover:text-[#15DACC] transition-all duration-300"
              onClick={() => window.open(getMidnightExplorerUrl(credential.txHash), "_blank")}
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              View on Midnight Explorer
            </Button>
          )}
          <Link href="/verify" className="flex-1">
            <Button 
              variant="outline" 
              className="w-full bg-white/5 border-white/10 text-[#E6E7EF] hover:bg-[#15DACC]/10 hover:border-[#15DACC]/30 hover:text-[#15DACC] transition-all duration-300"
            >
              Get Another Credential
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}

"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Wallet, Shield, User, Calendar, Copy, AlertCircle, CheckCircle2, Activity, LogOut } from "lucide-react"
import { useKYCStore } from "@/lib/store"
import { shortenAddress } from "@/lib/blockchain-utils"
import { useToast } from "@/hooks/use-toast"
import { AuthGuard } from "@/components/auth-guard"
import { useAuthStore } from "@/lib/auth-store"
import { useRouter } from "next/navigation"

function AccountPageContent() {
  const router = useRouter()
  const { toast } = useToast()
  const { user, credentials, actions } = useKYCStore()
  const { user: authUser, logout } = useAuthStore()

  if (!user.walletAddress) {
    return (
      <div className="container mx-auto px-4 py-16">
        <Card className="max-w-md mx-auto">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-warning" />
              Wallet Not Connected
            </CardTitle>
            <CardDescription>Please connect your wallet to view your account</CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" disabled>
              Connect Wallet
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast({
      title: "Copied!",
      description: "Wallet address copied to clipboard",
    })
  }

  const handleLogout = () => {
    logout()
    router.push("/auth/login")
  }

  const getProviderLabel = (provider: string) => {
    switch (provider) {
      case "google":
        return "Google"
      case "apple":
        return "Apple"
      case "wallet":
        return "Wallet"
      default:
        return "Unknown"
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Verified":
        return "bg-success/10 text-success border-success/20"
      case "Pending":
        return "bg-warning/10 text-warning border-warning/20"
      case "Expired":
      case "Revoked":
        return "bg-destructive/10 text-destructive border-destructive/20"
      default:
        return "bg-muted text-muted-foreground"
    }
  }

  const getActionIcon = (action: string) => {
    switch (action) {
      case "Issued":
        return <CheckCircle2 className="w-4 h-4 text-success" />
      case "Revoked":
        return <AlertCircle className="w-4 h-4 text-destructive" />
      default:
        return <Activity className="w-4 h-4" />
    }
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "Identity":
        return <Shield className="w-4 h-4" />
      case "Human":
        return <User className="w-4 h-4" />
      case "Age":
        return <Calendar className="w-4 h-4" />
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl md:text-4xl font-bold mb-2">Account</h1>
          <p className="text-muted-foreground">Manage your wallet and view your verification status</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5" />
              Authentication
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="text-sm text-muted-foreground mb-2">Login Method</div>
              <Badge variant="outline" className="capitalize">
                {authUser ? getProviderLabel(authUser.provider) : "Not logged in"}
              </Badge>
            </div>

            {authUser?.email && (
              <>
                <Separator />
                <div>
                  <div className="text-sm text-muted-foreground mb-2">Email</div>
                  <div className="text-sm">{authUser.email}</div>
                </div>
              </>
            )}

            <Separator />

            <Button variant="destructive" onClick={handleLogout} className="w-full">
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </CardContent>
        </Card>

        {/* Wallet Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="w-5 h-5" />
              Wallet Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="text-sm text-muted-foreground mb-2">Wallet Address</div>
              <div className="flex items-center gap-2">
                <code className="text-sm bg-muted px-3 py-2 rounded flex-1">{user.walletAddress}</code>
                <Button variant="outline" size="icon" onClick={() => copyToClipboard(user.walletAddress!)}>
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <Separator />

            <div>
              <div className="text-sm text-muted-foreground mb-2">Network</div>
              <Badge variant="outline" className="capitalize">
                {user.network}
              </Badge>
            </div>

            <Separator />

            <div>
              <div className="text-sm text-muted-foreground mb-3">Total Credentials</div>
              <div className="text-3xl font-bold">{credentials.length}</div>
            </div>
          </CardContent>
        </Card>

        {/* Verification Status */}
        <Card>
          <CardHeader>
            <CardTitle>Verification Status</CardTitle>
            <CardDescription>Your current Keyd verification levels</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-4">
              <div className="p-4 border rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Shield className="w-5 h-5 text-primary" />
                    <div className="font-medium">Identity</div>
                  </div>
                  <Badge className={getStatusColor(user.kyc.identity)}>{user.kyc.identity}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">Government ID verification</p>
              </div>

              <div className="p-4 border rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <User className="w-5 h-5 text-primary" />
                    <div className="font-medium">Human</div>
                  </div>
                  <Badge className={getStatusColor(user.kyc.human)}>{user.kyc.human}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">Liveness detection proof</p>
              </div>

              <div className="p-4 border rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-primary" />
                    <div className="font-medium">Age</div>
                  </div>
                  <Badge className={getStatusColor(user.kyc.age)}>{user.kyc.age}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">Age verification proof</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5" />
              Recent Activity
            </CardTitle>
            <CardDescription>Your latest verification actions</CardDescription>
          </CardHeader>
          <CardContent>
            {actions.length === 0 ? (
              <div className="text-center py-8">
                <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">No activity yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {actions.slice(0, 10).map((action) => (
                  <div key={action.id} className="flex items-center gap-3 p-3 border rounded-lg">
                    <div className="p-2 rounded-lg bg-muted">{getActionIcon(action.action)}</div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        {getTypeIcon(action.type)}
                        <span className="font-medium">
                          {action.type} {action.action}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground">{formatDate(action.timestamp)}</div>
                    </div>
                    <code className="text-xs bg-muted px-2 py-1 rounded">{shortenAddress(action.txHash, 6)}</code>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Account Stats */}
        <div className="grid md:grid-cols-4 gap-4">
          

          

          

          
        </div>

        {/* Privacy Notice */}
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="py-6">
            <div className="flex items-start gap-3">
              <Shield className="w-5 h-5 text-primary mt-0.5" />
              <div>
                <h3 className="font-semibold mb-2">Your Privacy Matters</h3>
                <p className="text-sm text-muted-foreground">
                  All your credentials are stored on the blockchain with end-to-end encryption. You have full control
                  over who can access your verification data. Your personal information is never shared without your
                  explicit consent.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default function AccountPage() {
  return (
    <AuthGuard>
      <AccountPageContent />
    </AuthGuard>
  )
}

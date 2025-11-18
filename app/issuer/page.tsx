"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Shield, User, Calendar, AlertCircle, Loader2 } from "lucide-react"
import { useKYCStore } from "@/lib/store"
import {
  generateCredentialHash,
  addLeafToMerkle,
  issueCredentialOnChain,
  revokeCredentialOnChain,
  issueAgeCredentialOnChain,
  recordHumanVerificationOnChain,
} from "@/lib/blockchain-utils"
import { useToast } from "@/hooks/use-toast"
import type { CredentialType } from "@/lib/types"
import { AuthGuard } from "@/components/auth-guard"

function IssuerPageContent() {
  const { toast } = useToast()
  const { user, walletSession, credentials, addCredential, revokeCredential, addAction, refreshLedgerSnapshot } = useKYCStore()
  const [isProcessing, setIsProcessing] = useState(false)
  const [issueForm, setIssueForm] = useState({
    holderAddress: "",
    credentialType: "" as CredentialType | "",
    expiryDays: "365",
  })
  const [revokeForm, setRevokeForm] = useState({
    credentialId: "",
    reason: "",
  })

  if (!user.walletAddress || !walletSession) {
    return (
      <div className="container mx-auto px-4 py-16">
        <Card className="max-w-md mx-auto">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-warning" />
              Wallet Not Connected
            </CardTitle>
            <CardDescription>Please connect your wallet to access the issuer portal</CardDescription>
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

  const handleIssueCredential = async () => {
    if (!issueForm.holderAddress || !issueForm.credentialType) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields",
        variant: "destructive",
      })
      return
    }

    setIsProcessing(true)

    try {
      let txHash = ""
      let credentialHash = ""
      let proofReference: string | undefined
      let chainData: { publicData?: any; finalized?: any } | undefined

      if (issueForm.credentialType === "Identity") {
        const credentialData = {
          type: "Identity",
          holder: issueForm.holderAddress,
          issuer: walletSession.address,
        }

        const result = await issueCredentialOnChain(walletSession, credentialData)
        txHash = result.txId
        credentialHash = result.commitment
        chainData = {
          publicData: result.publicData,
          finalized: result.finalized,
        }
      } else if (issueForm.credentialType === "Human") {
        const credentialData = {
          type: "Human",
          holder: issueForm.holderAddress,
          issuer: walletSession.address,
        }
        credentialHash = await generateCredentialHash(credentialData)
        proofReference = await generateCredentialHash({
          circuit: "human",
          holder: issueForm.holderAddress,
          issuer: walletSession.address,
          issuedAt: new Date().toISOString(),
        })

        const result = await recordHumanVerificationOnChain(walletSession, {
          subjectId: issueForm.holderAddress,
          humanCredentialCommitment: credentialHash,
          proofReference,
          issuerReference: walletSession.address,
        })
        txHash = result.txId
        chainData = {
          publicData: result.publicData,
          finalized: result.finalized,
        }
      } else if (issueForm.credentialType === "Age") {
      const credentialData = {
          type: "Age",
          holder: issueForm.holderAddress,
          issuer: walletSession.address,
          ageRange: "issuer-over-18",
        }
        credentialHash = await generateCredentialHash(credentialData)
        proofReference = await generateCredentialHash({
          circuit: "age",
          holder: issueForm.holderAddress,
          issuer: walletSession.address,
          bracket: "issuer-over-18",
          issuedAt: new Date().toISOString(),
        })

        const result = await issueAgeCredentialOnChain(walletSession, {
          subjectId: issueForm.holderAddress,
          ageCredentialCommitment: credentialHash,
          proofReference,
          bracketReference: "issuer-over-18",
          issuerReference: walletSession.address,
        })
        txHash = result.txId
        chainData = {
          publicData: result.publicData,
          finalized: result.finalized,
        }
      } else {
        throw new Error("Unsupported credential type")
      }

      if (!credentialHash) {
        credentialHash = await generateCredentialHash({
        type: issueForm.credentialType,
        holder: issueForm.holderAddress,
          issuer: walletSession.address,
        })
      }

      const merkleLeaf = addLeafToMerkle(credentialHash)

      const newCredential = {
        id: Date.now().toString(),
        type: issueForm.credentialType,
        holder: issueForm.holderAddress,
        issuer: walletSession.address,
        status: "Verified" as const,
        issueTime: new Date().toISOString(),
        expiryTime: new Date(Date.now() + Number.parseInt(issueForm.expiryDays) * 24 * 60 * 60 * 1000).toISOString(),
        txHash,
        credentialHash,
        merkleLeaf,
        proofReference,
        metadata: {},
        chainData,
      }

      addCredential(newCredential)
      addAction({
        id: Date.now().toString(),
        type: issueForm.credentialType,
        action: "Issued",
        timestamp: new Date().toISOString(),
        txHash,
      })

      await refreshLedgerSnapshot()

      toast({
        title: "Credential Issued!",
        description: "The credential has been successfully issued on-chain",
      })

      setIssueForm({
        holderAddress: "",
        credentialType: "",
        expiryDays: "365",
      })
    } catch (error) {
      toast({
        title: "Issuance Failed",
        description: "There was an error issuing the credential",
        variant: "destructive",
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const handleRevokeCredential = async () => {
    if (!revokeForm.credentialId || !revokeForm.reason) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields",
        variant: "destructive",
      })
      return
    }

    const credential = credentials.find((c) => c.id === revokeForm.credentialId)
    if (!credential) {
      toast({
        title: "Credential Not Found",
        description: "The credential ID you entered doesn't exist",
        variant: "destructive",
      })
      return
    }

    setIsProcessing(true)

    try {
      const result = await revokeCredentialOnChain(walletSession, revokeForm.credentialId, revokeForm.reason, user.walletAddress ?? walletSession.address)
      const txHash = result.txId

      revokeCredential(revokeForm.credentialId, revokeForm.reason)
      addAction({
        id: Date.now().toString(),
        type: credential.type,
        action: "Revoked",
        timestamp: new Date().toISOString(),
        txHash,
      })

      await refreshLedgerSnapshot()

      toast({
        title: "Credential Revoked",
        description: "The credential has been successfully revoked",
      })

      setRevokeForm({
        credentialId: "",
        reason: "",
      })
    } catch (error) {
      toast({
        title: "Revocation Failed",
        description: "There was an error revoking the credential",
        variant: "destructive",
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const issuedCredentials = credentials.filter((c) => c.issuer === user.walletAddress)

  const getTypeIcon = (type: CredentialType) => {
    switch (type) {
      case "Identity":
        return <Shield className="w-4 h-4" />
      case "Human":
        return <User className="w-4 h-4" />
      case "Age":
        return <Calendar className="w-4 h-4" />
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

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl md:text-4xl font-bold mb-2">Issuer Portal</h1>
          <p className="text-muted-foreground">Issue and manage blockchain credentials</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Issued</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{issuedCredentials.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Active</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success">
                {issuedCredentials.filter((c) => c.status === "Verified").length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Revoked</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">
                {issuedCredentials.filter((c) => c.status === "Revoked").length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Expired</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-muted-foreground">
                {issuedCredentials.filter((c) => c.status === "Expired").length}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Tabs defaultValue="issue" className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-3">
            <TabsTrigger value="issue">Issue</TabsTrigger>
            <TabsTrigger value="revoke">Revoke</TabsTrigger>
            <TabsTrigger value="issued">Issued</TabsTrigger>
          </TabsList>

          <TabsContent value="issue" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Issue New Credential</CardTitle>
                <CardDescription>Create and issue a new blockchain credential to a wallet address</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="holderAddress">Holder Wallet Address *</Label>
                  <Input
                    id="holderAddress"
                    placeholder="0x..."
                    value={issueForm.holderAddress}
                    onChange={(e) => setIssueForm({ ...issueForm, holderAddress: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="credentialType">Credential Type *</Label>
                  <Select
                    value={issueForm.credentialType}
                    onValueChange={(value) => setIssueForm({ ...issueForm, credentialType: value as CredentialType })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select credential type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Identity">Identity Verification</SelectItem>
                      <SelectItem value="Human">Human Verification</SelectItem>
                      <SelectItem value="Age">Age Verification</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="expiryDays">Expiry (Days) *</Label>
                  <Input
                    id="expiryDays"
                    type="number"
                    placeholder="365"
                    value={issueForm.expiryDays}
                    onChange={(e) => setIssueForm({ ...issueForm, expiryDays: e.target.value })}
                  />
                </div>

                <Button onClick={handleIssueCredential} disabled={isProcessing} className="w-full">
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Issuing...
                    </>
                  ) : (
                    "Issue Credential"
                  )}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="revoke" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Revoke Credential</CardTitle>
                <CardDescription>
                  Revoke an existing credential by providing the credential ID and reason
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="credentialId">Credential ID *</Label>
                  <Input
                    id="credentialId"
                    placeholder="Enter credential ID"
                    value={revokeForm.credentialId}
                    onChange={(e) => setRevokeForm({ ...revokeForm, credentialId: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="reason">Revocation Reason *</Label>
                  <Textarea
                    id="reason"
                    placeholder="Explain why this credential is being revoked"
                    value={revokeForm.reason}
                    onChange={(e) => setRevokeForm({ ...revokeForm, reason: e.target.value })}
                    rows={4}
                  />
                </div>

                <Button
                  onClick={handleRevokeCredential}
                  disabled={isProcessing}
                  variant="destructive"
                  className="w-full"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Revoking...
                    </>
                  ) : (
                    "Revoke Credential"
                  )}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="issued" className="mt-6">
            {issuedCredentials.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Credentials Issued</h3>
                  <p className="text-muted-foreground">You haven't issued any credentials yet</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {issuedCredentials.map((credential) => (
                  <Card key={credential.id}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-primary/10">{getTypeIcon(credential.type)}</div>
                          <div>
                            <CardTitle className="text-lg">{credential.type} Verification</CardTitle>
                            <CardDescription>ID: {credential.id}</CardDescription>
                          </div>
                        </div>
                        <Badge className={getStatusColor(credential.status)}>{credential.status}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="text-sm text-muted-foreground">
                        Holder: <code className="text-xs bg-muted px-1 py-0.5 rounded">{credential.holder}</code>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

export default function IssuerPage() {
  return (
    <AuthGuard>
      <IssuerPageContent />
    </AuthGuard>
  )
}

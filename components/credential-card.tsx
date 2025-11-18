import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { StatusBadge } from "./status-badge"
import type { Credential } from "@/lib/types"
import { Shield, User, Calendar } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"

interface CredentialCardProps {
  credential: Credential
}

export function CredentialCard({ credential }: CredentialCardProps) {
  const icons = {
    Identity: Shield,
    Human: User,
    Age: Calendar,
  }

  const Icon = icons[credential.type]

  return (
    <Card className="bg-white border-2 border-gray-200 hover:border-[#15DACC]/50 transition-colors">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-[#15DACC]/10">
              <Icon className="w-5 h-5 text-[#15DACC]" />
            </div>
            <div>
              <CardTitle className="text-lg text-gray-900">{credential.type} Verification</CardTitle>
              <p className="text-sm text-gray-600 mt-1">Issued {new Date(credential.issueTime).toLocaleDateString()}</p>
            </div>
          </div>
          <StatusBadge status={credential.status} />
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Expires</span>
            <span className="font-medium text-gray-900">{new Date(credential.expiryTime).toLocaleDateString()}</span>
          </div>
          {credential.metadata.country && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Country</span>
              <span className="font-medium text-gray-900">{credential.metadata.country}</span>
            </div>
          )}
          <Button
            asChild
            variant="outline"
            className="w-full mt-4 bg-white border-gray-300 text-gray-900 hover:bg-gray-50"
          >
            <Link href={`/credential/${credential.id}`}>View Details</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

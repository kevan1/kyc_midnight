import { Badge } from "@/components/ui/badge"
import type { CredentialStatus } from "@/lib/types"
import { CheckCircle2, Clock, XCircle, AlertCircle } from "lucide-react"

interface StatusBadgeProps {
  status: CredentialStatus | "None"
  size?: "sm" | "md"
}

export function StatusBadge({ status, size = "md" }: StatusBadgeProps) {
  const iconSize = size === "sm" ? 12 : 14

  const variants = {
    Verified: {
      variant: "default" as const,
      className: "bg-success/10 text-success border-success/20",
      icon: <CheckCircle2 className="w-3 h-3" />,
    },
    Pending: {
      variant: "secondary" as const,
      className: "bg-warning/10 text-warning border-warning/20",
      icon: <Clock className="w-3 h-3" />,
    },
    Revoked: {
      variant: "destructive" as const,
      className: "bg-destructive/10 text-destructive border-destructive/20",
      icon: <XCircle className="w-3 h-3" />,
    },
    Expired: {
      variant: "secondary" as const,
      className: "bg-muted-foreground/10 text-muted-foreground border-muted-foreground/20",
      icon: <AlertCircle className="w-3 h-3" />,
    },
    None: {
      variant: "outline" as const,
      className: "bg-muted/10 text-muted-foreground border-muted",
      icon: null,
    },
  }

  const config = variants[status]

  return (
    <Badge
      variant={config.variant}
      className={`${config.className} gap-1 ${size === "sm" ? "text-xs px-2 py-0.5" : ""}`}
    >
      {config.icon}
      {status}
    </Badge>
  )
}

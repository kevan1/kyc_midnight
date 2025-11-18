"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"

export default function AuthCallbackPage() {
  const router = useRouter()

  useEffect(() => {
    // Mock OAuth callback processing
    const timer = setTimeout(() => {
      router.push("/")
    }, 2000)

    return () => clearTimeout(timer)
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0F0E2A]">
      <div className="text-center">
        <Loader2 className="w-12 h-12 animate-spin text-[#15DACC] mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-[#E6E7EF] mb-2">Procesando autenticación</h2>
        <p className="text-[#A5A7BF]">Serás redirigido en un momento...</p>
      </div>
    </div>
  )
}

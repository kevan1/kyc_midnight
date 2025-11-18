"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useAuthStore } from "@/lib/auth-store"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Shield, Loader2 } from "lucide-react"
import Link from "next/link"



export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, status, loginWithGoogle, loginWithApple } = useAuthStore()
  const [hasLoggedIn, setHasLoggedIn] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const redirect = searchParams.get("redirect") || "/"
  const returnUrl = searchParams.get("returnUrl") || null

  useEffect(() => {
    if (hasLoggedIn && status === "authenticated" && user) {
      if (returnUrl) {
        router.push(`/verify/identity?returnUrl=${encodeURIComponent(returnUrl)}`)
        return
      }
      router.push(redirect)
    }
  }, [hasLoggedIn, status, user, router, redirect, returnUrl])

  const handleGoogleLogin = async () => {
    setHasLoggedIn(true)
    setError(null)
    await loginWithGoogle()
  }

  const handleAppleLogin = async () => {
    setHasLoggedIn(true)
    setError(null)
    await loginWithApple()
  }

  const isLoading = status === "authenticating"

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#0F0E2A]">
      <Card className="w-full max-w-md bg-[#2E2A5C] border-[rgba(230,231,239,0.12)] rounded-2xl shadow-xl">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto p-4 rounded-2xl bg-[#15DACC]/10 w-fit">
            <Shield className="w-12 h-12 text-[#15DACC]" />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold text-[#E6E7EF]">Inicia sesión</CardTitle>
            <CardDescription className="text-[#A5A7BF] mt-2">Elige tu método de acceso seguro</CardDescription>
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {error}
            </div>
          )}
          <Button
            onClick={handleGoogleLogin}
            disabled={isLoading}
            className="w-full h-12 bg-white hover:bg-white/90 text-[#2E2A5C] font-semibold rounded-xl"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                Continuar con Google
              </>
            )}
          </Button>

          <Button
            onClick={handleAppleLogin}
            disabled={isLoading}
            className="w-full h-12 bg-black hover:bg-black/90 text-white font-semibold rounded-xl"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
                </svg>
                Continuar con Apple
              </>
            )}
          </Button>

          <p className="text-xs text-center text-[#A5A7BF] mt-6 leading-relaxed">
            Al continuar, aceptas nuestros{" "}
            <Link href="/terms" className="text-[#15DACC] hover:underline">
              Términos de Servicio
            </Link>{" "}
            y{" "}
            <Link href="/privacy" className="text-[#15DACC] hover:underline">
              Política de Privacidad
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

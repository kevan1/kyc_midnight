"use client"

import { useEffect, useState } from "react"
import Image from "next/image"

export function SplashScreen() {
  const [show, setShow] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => {
      setShow(false)
    }, 1500)

    return () => clearTimeout(timer)
  }, [])

  if (!show) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gradient-to-br from-[#2E2A5C] via-[#6255CB] to-[#2E2A5C] animate-in fade-in duration-300">
      <div className="text-center animate-in zoom-in duration-500">
        <div className="inline-flex p-6 rounded-3xl bg-white/10 mb-4">
          <Image
            src="/loading.png"
            alt="Keyd"
            width={64}
            height={64}
            priority
            className="w-16 h-16 animate-[spin_1.2s_linear_infinite]"
          />

        </div>
        <h1 className="text-2xl font-bold text-white">Keyd</h1>
        <p className="text-[#E6E7EF]/70 mt-2">Secure Identity Verification</p>
      </div>
    </div>
  )
}

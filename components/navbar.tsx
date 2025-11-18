"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Wallet, User, ChevronDown, Copy, Check, Menu, X } from "lucide-react"
import { useKYCStore } from "@/lib/store"
import { shortenAddress } from "@/lib/blockchain-utils"
import Image from "next/image"
import { useEffect, useRef, useState } from "react"

export function Navbar() {
  const pathname = usePathname()
  const { user, connectWallet, disconnectWallet, initializeWallet } = useKYCStore()
  const [menuOpen, setMenuOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied">("idle")
  const dropdownRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    initializeWallet()
  }, [initializeWallet])

  useEffect(() => {
    if (!menuOpen) return

    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setMenuOpen(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [menuOpen])

  const links = [
    { href: "/", label: "Home" },
    { href: "/credentials", label: "My Credentials" },
    { href: "/verify", label: "Verify" },
    { href: "/issuer", label: "Issuer" },
  ]

  const handleConnect = async () => {
    try {
      await connectWallet()
      setMenuOpen(false)
      setMobileMenuOpen(false)
    } catch (error) {
      console.error("Failed to connect Lace wallet", error)
    }
  }

  const handleCopyAddress = async () => {
    if (!user.walletAddress) return
    try {
      await navigator.clipboard.writeText(user.walletAddress)
      setCopyStatus("copied")
      setTimeout(() => setCopyStatus("idle"), 2000)
    } catch (error) {
      console.error("Failed to copy wallet address", error)
    }
  }

  const handleDisconnect = () => {
    setMenuOpen(false)
    setMobileMenuOpen(false)
    setCopyStatus("idle")
    disconnectWallet()
  }

  const isActive = (href: string) => {
    if (href === "/") {
      return pathname === "/"
    }
    return pathname.startsWith(href)
  }

  return (
    <nav className="sticky top-0 z-50 border-b border-white/10 bg-gradient-to-b from-[#0A0A1F]/95 to-[#0F0E2A]/95 backdrop-blur-xl shadow-lg shadow-black/20">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16 md:h-18">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group">
            <div className="relative">
              <Image 
                src="/keyd-logo.png" 
                alt="Keyd" 
                width={80} 
                height={24} 
                className="h-6 w-auto transition-opacity group-hover:opacity-80" 
                priority 
              />
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <div className="hidden md:flex items-center gap-1">
            {links.map((link) => {
              const active = isActive(link.href)
              return (
                <Link key={link.href} href={link.href}>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={`relative px-4 py-2 rounded-lg transition-all duration-300 ${
                      active
                        ? "bg-[#15DACC]/20 text-[#15DACC] hover:bg-[#15DACC]/30 shadow-lg shadow-[#15DACC]/10"
                        : "text-[#A5A7BF] hover:text-[#E6E7EF] hover:bg-white/5"
                    }`}
                  >
                    {link.label}
                    {active && (
                      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#15DACC] shadow-lg shadow-[#15DACC]/50" />
                    )}
                  </Button>
                </Link>
              )
            })}
          </div>

          {/* Right Side Actions */}
          <div className="flex items-center gap-2">
            {/* Account Link */}
            <Link href="/account">
              <Button 
                variant="ghost" 
                size="sm" 
                className={`gap-2 transition-all duration-300 ${
                  pathname === "/account"
                    ? "bg-[#15DACC]/20 text-[#15DACC] hover:bg-[#15DACC]/30"
                    : "text-[#A5A7BF] hover:text-[#E6E7EF] hover:bg-white/5"
                }`}
              >
                <User className="w-4 h-4" />
                <span className="hidden sm:inline">Account</span>
              </Button>
            </Link>

            {/* Wallet Button */}
            {user.walletAddress ? (
              <div className="relative ml-2" ref={dropdownRef}>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2 bg-white/5 border-white/10 text-[#E6E7EF] hover:bg-white/10 hover:border-[#15DACC]/30 hover:text-[#15DACC] transition-all duration-300"
                  onClick={() => setMenuOpen((prev) => !prev)}
                >
                  <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-lg shadow-emerald-400/50" />
                  <Wallet className="w-4 h-4" />
                  <span className="hidden sm:inline font-mono text-xs">{shortenAddress(user.walletAddress)}</span>
                  <ChevronDown className={`w-3 h-3 transition-transform duration-300 ${menuOpen ? "rotate-180" : "rotate-0"}`} />
                </Button>

                {menuOpen && (
                  <div className="absolute right-0 mt-2 w-72 rounded-xl border border-white/10 bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl shadow-2xl p-4 z-50">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-lg shadow-emerald-400/50" />
                      <p className="text-xs font-medium text-[#A5A7BF] uppercase tracking-wide">Connected wallet</p>
                    </div>
                    <div className="rounded-lg bg-white/5 border border-white/10 px-3 py-2.5 font-mono text-xs text-[#E6E7EF] break-all mb-4">
                      {user.walletAddress}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="flex-1 bg-white/5 border-white/10 text-[#E6E7EF] hover:bg-[#15DACC]/10 hover:border-[#15DACC]/30 hover:text-[#15DACC] transition-all duration-300" 
                        onClick={handleCopyAddress}
                      >
                        {copyStatus === "copied" ? (
                          <>
                            <Check className="w-4 h-4 mr-2" />
                            Copied
                          </>
                        ) : (
                          <>
                            <Copy className="w-4 h-4 mr-2" />
                            Copy Address
                          </>
                        )}
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="bg-white/5 border-white/10 text-[#E6E7EF] hover:bg-red-500/10 hover:border-red-500/30 hover:text-red-400 transition-all duration-300" 
                        onClick={handleDisconnect}
                      >
                        Disconnect
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <Button 
                onClick={handleConnect} 
                size="sm" 
                className="ml-2 bg-gradient-to-r from-[#15DACC] to-[#6255CB] hover:opacity-90 text-white font-semibold shadow-lg shadow-[#15DACC]/20 hover:shadow-[#15DACC]/40 transition-all duration-300"
              >
                <Wallet className="w-4 h-4 mr-2" />
                <span className="hidden sm:inline">Connect Wallet</span>
                <span className="sm:hidden">Connect</span>
              </Button>
            )}

            {/* Mobile Menu Button */}
            <Button
              variant="ghost"
              size="sm"
              className="md:hidden text-[#E6E7EF] hover:bg-white/10 ml-2"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-white/10 py-4 space-y-2">
            {links.map((link) => {
              const active = isActive(link.href)
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`block px-4 py-2 rounded-lg transition-all duration-300 ${
                    active
                      ? "bg-[#15DACC]/20 text-[#15DACC] font-medium"
                      : "text-[#A5A7BF] hover:text-[#E6E7EF] hover:bg-white/5"
                  }`}
                >
                  {link.label}
                </Link>
              )
            })}
            {!user.walletAddress && (
              <div className="px-4 pt-2">
                <Button
                  onClick={handleConnect}
                  className="w-full bg-gradient-to-r from-[#15DACC] to-[#6255CB] hover:opacity-90 text-white font-semibold shadow-lg shadow-[#15DACC]/20"
                >
                  <Wallet className="w-4 h-4 mr-2" />
                  Connect Wallet
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </nav>
  )
}

"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, FileText, ShieldCheck, User } from "lucide-react"
import { cn } from "@/lib/utils"

export function MobileTabBar() {
  const pathname = usePathname()

  const tabs = [
    { href: "/", label: "Home", icon: Home },
    { href: "/credentials", label: "Credentials", icon: FileText },
    { href: "/verify", label: "Verify", icon: ShieldCheck },
    { href: "/account", label: "Account", icon: User },
  ]

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#2E2A5C] border-t border-[rgba(230,231,239,0.12)]">
      <div className="flex items-center justify-around h-16">
        {tabs.map((tab) => {
          const Icon = tab.icon
          const isActive = pathname === tab.href || (tab.href !== "/" && pathname.startsWith(tab.href))

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "flex flex-col items-center justify-center gap-1 flex-1 h-full transition-colors",
                isActive ? "text-[#15DACC]" : "text-[#A5A7BF]",
              )}
            >
              <Icon className="w-5 h-5" />
              <span className="text-xs font-medium">{tab.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  LayoutDashboard,
  ArrowLeftRight,
  PiggyBank,
  BarChart3,
  Settings,
  Wallet,
  CheckSquare,
  Receipt,
  LogOut,
} from "lucide-react"
import type { EmployeeRole } from "@/types/database"
import { signOut } from "@/app/actions/auth"

const NAV_ITEMS: { href: string; label: string; icon: React.ElementType; roles: EmployeeRole[] }[] = [
  { href: "/dashboard",    label: "대시보드",  icon: LayoutDashboard, roles: ["ceo"] },
  { href: "/approvals",    label: "결재 관리",  icon: CheckSquare,     roles: ["ceo"] },
  { href: "/submit",       label: "지출 신청",  icon: Receipt,         roles: ["ceo", "staff", "finance"] },
  { href: "/transactions", label: "거래 내역",  icon: ArrowLeftRight,  roles: ["ceo", "finance"] },
  { href: "/budgets",      label: "예산 관리",  icon: PiggyBank,       roles: ["ceo", "finance"] },
  { href: "/reports",      label: "리포트",     icon: BarChart3,       roles: ["ceo", "finance"] },
  { href: "/settings",     label: "설정",       icon: Settings,        roles: ["ceo"] },
]

interface SidebarProps {
  role: EmployeeRole
  unreadRejections?: number
}

export function Sidebar({ role, unreadRejections = 0 }: SidebarProps) {
  const pathname = usePathname()
  const items = NAV_ITEMS.filter((item) => item.roles.includes(role))

  return (
    <aside className="w-60 border-r bg-card flex flex-col">
      <div className="p-6 flex items-center gap-2">
        <Wallet className="h-6 w-6 text-primary" />
        <span className="font-semibold text-lg">Finance OS</span>
      </div>

      <nav className="flex-1 px-3 space-y-1">
        {items.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href
          const showBadge = href === '/submit' && unreadRejections > 0
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              <span className="flex-1">{label}</span>
              {showBadge && (
                <span className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                  {unreadRejections > 9 ? '9+' : unreadRejections}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      <div className="p-3 border-t">
        <form action={signOut}>
          <button
            type="submit"
            className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            <LogOut className="h-4 w-4" />
            로그아웃
          </button>
        </form>
      </div>
    </aside>
  )
}

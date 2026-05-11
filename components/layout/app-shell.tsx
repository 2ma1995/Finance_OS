import { createSupabaseServerClient } from "@/lib/supabase-server"
import { rawSupabase } from "@/lib/utils"
import { redirect } from "next/navigation"
import { Sidebar } from "./sidebar"
import type { EmployeeRole } from "@/types/database"

export async function AppShell({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect("/auth/login")

  const { data } = await rawSupabase(supabase)
    .from("employees")
    .select("role")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .single() as { data: { role: EmployeeRole } | null }

  if (!data?.role) redirect("/auth/login")

  // 영수증 제출 가능한 역할의 미읽은 반려 건수 조회
  let unreadRejections = 0
  if (data.role === 'staff' || data.role === 'finance' || data.role === 'ceo') {
    const { count } = await rawSupabase(supabase)
      .from('receipts')
      .select('id', { count: 'exact', head: true })
      .eq('employee_id', user.id)
      .eq('status', 'rejected')
      .is('rejection_notified_at', null) as { count: number | null }
    unreadRejections = count ?? 0
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar role={data.role as EmployeeRole} unreadRejections={unreadRejections} />
      <main className="flex-1 overflow-y-auto bg-background p-6">
        {children}
      </main>
    </div>
  )
}

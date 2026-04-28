import { createSupabaseServerClient } from '@/lib/supabase-server'
import type { EmployeeRole } from '@/types/database'

export async function requireRole(allowed: EmployeeRole[]) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('employees')
    .select('role')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()
  const emp = data as { role: EmployeeRole } | null

  if (!emp || !allowed.includes(emp.role)) return null
  return { user, role: emp.role, supabase }
}

import { createSupabaseServerClient } from '@/lib/supabase-server'
import { EmployeeTable } from './_components/employee-table'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { Employee } from '@/types/database'

export default async function SettingsPage() {
  const supabase = await createSupabaseServerClient()

  const { data: employees } = await supabase
    .from('employees')
    .select('*')
    .order('created_at', { ascending: true })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">설정</h1>
        <p className="text-sm text-muted-foreground mt-1">직원 역할 및 부서를 관리합니다.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">직원 목록</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <EmployeeTable employees={(employees as Employee[]) ?? []} />
        </CardContent>
      </Card>
    </div>
  )
}

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export function SetPasswordForm() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password.length < 8) {
      setError('비밀번호는 8자 이상이어야 합니다.')
      return
    }
    if (password !== confirm) {
      setError('비밀번호가 일치하지 않습니다.')
      return
    }

    setLoading(true)
    const supabase = createClient()
    const { error: updateError } = await supabase.auth.updateUser({
      password,
      data: { must_change_password: false },
    })
    setLoading(false)

    if (updateError) {
      setError(updateError.message)
      return
    }

    // 미들웨어가 역할에 맞는 홈으로 보내줌
    router.push('/auth/login')
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle className="text-base font-medium">비밀번호 설정</CardTitle>
        <p className="text-sm text-muted-foreground mt-1">
          처음 로그인하셨습니다. 앞으로 사용할 비밀번호를 설정해주세요.
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">새 비밀번호</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="8자 이상"
              required
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm">비밀번호 확인</Label>
            <Input
              id="confirm"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="동일하게 입력"
              required
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? '저장 중...' : '비밀번호 저장'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

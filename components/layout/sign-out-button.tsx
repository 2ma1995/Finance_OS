'use client'

import { signOut } from '@/app/actions/auth'
import { Button } from '@/components/ui/button'

export function SignOutButton() {
  return (
    <form action={signOut}>
      <Button type="submit" variant="outline" size="sm">
        로그아웃
      </Button>
    </form>
  )
}

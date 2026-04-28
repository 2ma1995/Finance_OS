import { LoginForm } from './_components/login-form'

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-sm space-y-6 px-4">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">Finance OS</h1>
          <p className="text-sm text-muted-foreground">이메일로 로그인하세요</p>
        </div>
        <LoginForm />
      </div>
    </div>
  )
}

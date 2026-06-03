import { createFileRoute, redirect } from '@tanstack/react-router'
import { SignIn } from '@/features/auth/sign-in'

export const Route = createFileRoute('/(auth)/sign-in')({
  beforeLoad: () => {
    const token = localStorage.getItem('ppe_admin_token')
    if (token) throw redirect({ to: '/' })
  },
  component: SignIn,
})

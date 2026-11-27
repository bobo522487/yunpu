import { useNavigate, useLocation } from '@tanstack/react-router'
import { useAuthStore } from '@/features/auth/useAuthStore'
import { ConfirmDialog } from '@/components/confirm-dialog'

interface SignOutDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SignOutDialog({ open, onOpenChange }: SignOutDialogProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const signOut = useAuthStore((s) => s.signOut)

  const handleSignOut = () => {
    void signOut().finally(() => {
      navigate({
        to: '/login',
        search: { redirect: location.href },
        replace: true,
      })
    })
  }

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title='退出登录'
      desc='确定要退出登录吗？退出后需要重新登录。'
      confirmText='退出登录'
      destructive
      handleConfirm={handleSignOut}
      className='sm:max-w-sm'
    />
  )
}

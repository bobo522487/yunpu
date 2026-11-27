import type { ReactNode } from 'react'
import Breadcrumb from '@/components/common/Breadcrumb'
import { ConfigDrawer } from '@/components/config-drawer'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'

type AppHeaderProps = {
  leading?: ReactNode
  actions?: ReactNode
}

export function AppHeader({ leading, actions }: AppHeaderProps) {
  return (
    <header
      data-slot='main-content-header'
      className='grid h-12 w-full min-w-0 shrink-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 bg-background px-3 shadow-[inset_0_-1px_0_var(--border)] md:h-14 md:grid-cols-[minmax(0,1fr)_auto]'
    >
      {leading ?? <span className='md:hidden' aria-hidden='true' />}
      <div className='min-w-0'>
        <Breadcrumb />
      </div>
      <div className='flex items-center justify-end gap-2'>
        {actions}
        <Search className='hidden sm:flex' />
        <ThemeSwitch />
        <ConfigDrawer />
        <ProfileDropdown />
      </div>
    </header>
  )
}

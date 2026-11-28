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
      className='flex h-12 w-full min-w-0 shrink-0 items-center gap-2 bg-background px-3 shadow-[inset_0_-1px_0_var(--border)] md:h-14'
    >
      {leading}
      <div className='min-w-0 flex-1'>
        <Breadcrumb />
      </div>
      <div className='flex shrink-0 items-center justify-end gap-2'>
        {actions}
        <Search className='hidden sm:flex' />
        <ThemeSwitch />
        <ConfigDrawer />
        <ProfileDropdown />
      </div>
    </header>
  )
}

import React from 'react'
import { useNavigate } from '@tanstack/react-router'
import { ArrowRight, ChevronRight, Laptop, Moon, Sun } from 'lucide-react'
import { useSearch } from '@/context/search-provider'
import { useTheme } from '@/context/theme-provider'
import { useWorkspaceStore } from '@/store/useWorkspaceStore'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import { sidebarData } from './layout/data/sidebar-data'
import { ScrollArea } from './ui/scroll-area'

export function CommandMenu() {
  const navigate = useNavigate()
  const { setTheme } = useTheme()
  const { open, setOpen } = useSearch()
  const activeProjectId = useWorkspaceStore((s) => s.activeProjectId)

  const runCommand = React.useCallback(
    (command: () => unknown) => {
      setOpen(false)
      command()
    },
    [setOpen]
  )

  const resolveUrl = (url?: string): string | null => {
    if (!url) return null
    if (!url.includes(':projectId')) return url
    if (!activeProjectId) return null
    return url.replaceAll(':projectId', activeProjectId)
  }

  return (
    <CommandDialog modal open={open} onOpenChange={setOpen}>
      <CommandInput placeholder='Type a command or search...' />
      <CommandList>
        <ScrollArea type='hover' className='h-72 pe-1'>
          <CommandEmpty>No results found.</CommandEmpty>
          {sidebarData.navGroups.map((group) => {
            const visibleItems = group.items.filter((navItem) => {
              if (navItem.url) return resolveUrl(navItem.url) !== null
              return Boolean(
                navItem.items?.some((sub) => resolveUrl(sub.url) !== null)
              )
            })
            if (visibleItems.length === 0) return null

            return (
              <CommandGroup key={group.title} heading={group.title}>
                {visibleItems.map((navItem, i) => {
                  if (navItem.url) {
                    const target = resolveUrl(navItem.url)
                    if (!target) return null
                    return (
                      <CommandItem
                        key={`${target}-${i}`}
                        value={navItem.title}
                        onSelect={() => {
                          runCommand(() => navigate({ to: target }))
                        }}
                      >
                        <div className='flex size-4 items-center justify-center'>
                          <ArrowRight className='size-2 text-muted-foreground/80' />
                        </div>
                        {navItem.title}
                      </CommandItem>
                    )
                  }

                  return navItem.items?.map((subItem, subIdx) => {
                    const target = resolveUrl(subItem.url)
                    if (!target) return null
                    return (
                      <CommandItem
                        key={`${navItem.title}-${target}-${subIdx}`}
                        value={`${navItem.title}-${target}`}
                        onSelect={() => {
                          runCommand(() => navigate({ to: target }))
                        }}
                      >
                        <div className='flex size-4 items-center justify-center'>
                          <ArrowRight className='size-2 text-muted-foreground/80' />
                        </div>
                        {navItem.title} <ChevronRight /> {subItem.title}
                      </CommandItem>
                    )
                  })
                })}
              </CommandGroup>
            )
          })}
          <CommandSeparator />
          <CommandGroup heading='Theme'>
            <CommandItem onSelect={() => runCommand(() => setTheme('light'))}>
              <Sun /> <span>Light</span>
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => setTheme('dark'))}>
              <Moon className='scale-90' />
              <span>Dark</span>
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => setTheme('system'))}>
              <Laptop />
              <span>System</span>
            </CommandItem>
          </CommandGroup>
        </ScrollArea>
      </CommandList>
    </CommandDialog>
  )
}

import * as React from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface NativeSelectProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {
  isPlaceholder?: boolean
  containerClassName?: string
  selectSize?: 'sm' | 'md'
}

const NativeSelect = React.forwardRef<HTMLSelectElement, NativeSelectProps>(
  (
    {
      className,
      containerClassName,
      isPlaceholder,
      selectSize = 'md',
      children,
      value,
      ...props
    },
    ref
  ) => {
    const showPlaceholderTone =
      isPlaceholder !== undefined
        ? isPlaceholder
        : value !== undefined && value === ''

    return (
      <div className={cn('relative w-full', containerClassName)}>
        <select
          ref={ref}
          value={value}
          className={cn(
            'flex w-full appearance-none rounded-md border border-input bg-card shadow-[var(--shadow-control)] ring-offset-background transition-all duration-150 outline-none hover:border-[var(--border-strong)] focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary focus-visible:shadow-[var(--shadow-focus-halo)] disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer',
            selectSize === 'sm'
              ? 'h-8 pl-2.5 pr-7 py-1 text-[13px]'
              : 'h-9 pl-3 pr-8 py-1.5 text-[14px]',
            showPlaceholderTone
              ? 'text-placeholder font-normal'
              : 'text-foreground font-normal',
            className
          )}
          {...props}
        >
          {children}
        </select>
        <ChevronDown
          size={14}
          aria-hidden='true'
          className='pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/75'
        />
      </div>
    )
  }
)
NativeSelect.displayName = 'NativeSelect'

export { NativeSelect }

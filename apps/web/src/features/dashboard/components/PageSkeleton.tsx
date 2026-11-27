import React from 'react';

type Props = {
  variant?: 'cards' | 'rows' | 'form';
  className?: string;
};

/** 加载态骨架：形状与真实内容布局一致，避免加载完成时跳版（contracts/ui-states.md §1）。 */
const PageSkeleton: React.FC<Props> = ({ variant = 'rows', className = '' }) => {
  if (variant === 'cards') {
    return (
      <div className={`space-y-6 ${className}`} aria-busy="true" aria-label="加载中">
        <div className="space-y-2">
          <div className="h-6 w-48 animate-pulse rounded bg-muted" />
          <div className="h-4 w-72 animate-pulse rounded bg-muted" />
        </div>
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
          {[0, 1, 2].map((item) => (
            <div
              key={item}
              className="h-24 animate-pulse rounded-xl border border-border bg-card"
            />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((item) => (
            <div
              key={item}
              className="h-16 animate-pulse rounded-xl border border-border bg-card"
            />
          ))}
        </div>
      </div>
    );
  }

  if (variant === 'form') {
    return (
      <div className={`space-y-4 ${className}`} aria-busy="true" aria-label="加载中">
        {[0, 1, 2].map((item) => (
          <div key={item} className="space-y-2">
            <div className="h-4 w-24 animate-pulse rounded bg-muted" />
            <div className="h-9 w-full max-w-md animate-pulse rounded-md bg-muted" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={`space-y-3 ${className}`} aria-busy="true" aria-label="加载中">
      {[0, 1, 2, 3, 4].map((item) => (
        <div
          key={item}
          className="h-12 animate-pulse rounded-lg border border-border bg-card"
        />
      ))}
    </div>
  );
};

export default PageSkeleton;

import React from 'react';
import { cn } from '../../../lib/utils';

export interface PersonAvatarPortraitProps {
  avatarUrl?: string;
  displayName: string;
  gender: 'male' | 'female' | 'unknown';
  sizeClass: string;
  textClass?: string;
}

export const PersonAvatarPortrait: React.FC<PersonAvatarPortraitProps> = ({
  avatarUrl,
  displayName,
  gender,
  sizeClass,
  textClass = 'text-sm',
}) => {
  const toneClass =
    gender === 'female'
      ? 'bg-[#ED5481]/12 text-[#B6335A] dark:bg-[#D16686]/15 dark:text-[#E590AA] border-[#ED5481]/25 dark:border-[#D16686]/30'
      : gender === 'male'
        ? 'bg-[#2097B7]/12 text-[#057091] dark:bg-[#3E9EB8]/15 dark:text-[#6EC2DB] border-[#2097B7]/25 dark:border-[#3E9EB8]/30'
        : 'bg-[#E8EAEA] text-[#56585A] dark:bg-slate-700 dark:text-slate-300 border-[#D8DADA] dark:border-slate-600';

  return (
    <div
      className={cn(
        'rounded-full overflow-hidden border flex items-center justify-center shrink-0 font-bold select-none',
        sizeClass,
        textClass,
        toneClass
      )}
    >
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={displayName}
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover"
        />
      ) : (
        <span>{displayName ? displayName.slice(0, 1) : '族'}</span>
      )}
    </div>
  );
};

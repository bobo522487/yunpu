import React from 'react';
import { cn } from '../../../lib/utils';
import { getGenderAvatarToneClass } from '../utils/lineageTheme';

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
  const toneClass = getGenderAvatarToneClass(gender);

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

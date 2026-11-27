import React from 'react';
import type { BookBindingStyle, BookFishtailStyle } from '../types';

interface BookCoverThumbProps {
  bookName: string;
  volumeNo?: string;
  bindingStyle?: BookBindingStyle;
  size?: 'sm' | 'md';
}

export const BookCoverThumb: React.FC<BookCoverThumbProps> = ({
  bookName,
  volumeNo,
  bindingStyle = 'thread',
  size = 'sm',
}) => {
  const isThread = bindingStyle === 'thread';
  const dim =
    size === 'sm'
      ? 'w-[50px] h-[70px]'
      : 'w-[76px] h-[106px]';

  const labelFontSize =
    size === 'sm'
      ? bookName.length > 6
        ? '8px'
        : '9px'
      : bookName.length > 6
        ? '10px'
        : '11px';

  return (
    <div
      className={`relative shrink-0 overflow-hidden select-none rounded-[4px] border shadow-xs ${dim} ${
        isThread
          ? 'bg-[#055873] border-[#033F54]'
          : 'bg-[#057091] border-[#044B62]'
      }`}
    >
      {/* Subtle silk texture sheen */}
      <div
        className="absolute inset-0 opacity-20 pointer-events-none"
        style={{
          backgroundImage:
            'repeating-linear-gradient(0deg, rgba(255,255,255,0.08) 0px, rgba(255,255,255,0.08) 1px, transparent 1px, transparent 3px)',
        }}
      />

      {/* Binding spine stitches (right side for traditional Chinese right-to-left binding) */}
      {isThread ? (
        <div className="absolute right-[4px] top-1.5 bottom-1.5 w-[2px] flex flex-col justify-between items-center pointer-events-none">
          {[0, 1, 2, 3].map((dot) => (
            <span
              key={dot}
              className="w-[2.5px] h-[5px] rounded-full bg-[#D9EEF4]/85 block"
            />
          ))}
        </div>
      ) : (
        <div className="absolute left-0 top-0 bottom-0 w-[4px] bg-black/25 pointer-events-none" />
      )}

      {/* Cool archival title slip (题签) */}
      <div
        title={bookName}
        className={`absolute top-1.5 left-1.5 bg-[#F7FAFA] text-[#1E293B] border border-[#057091]/40 shadow-xs flex items-center justify-center overflow-hidden ${
          size === 'sm'
            ? 'w-[22px] max-h-[50px] py-1 px-0.5'
            : 'w-[30px] max-h-[78px] py-1.5 px-1'
        }`}
        style={{
          writingMode: 'vertical-rl',
          textOrientation: 'upright',
          fontSize: labelFontSize,
          lineHeight: 1.15,
          letterSpacing: '0.06em',
          fontFamily: '"Noto Serif SC", "Songti SC", "SimSun", serif',
          fontWeight: 700,
        }}
      >
        <span className="truncate">{bookName}</span>
      </div>

      {/* Bottom volume mark */}
      {volumeNo && (
        <span
          className={`absolute bottom-1 left-1.5 text-[#D9EEF4]/90 font-serif ${
            size === 'sm' ? 'text-[7px]' : 'text-[9px]'
          }`}
        >
          {volumeNo}
        </span>
      )}
    </div>
  );
};

interface FishtailOrnamentProps {
  style: BookFishtailStyle;
  flipped?: boolean;
  className?: string;
}

export const FishtailOrnament: React.FC<FishtailOrnamentProps> = ({
  style,
  flipped = false,
  className = '',
}) => {
  if (style === 'none') return null;

  const renderSingle = (key: string, flip: boolean) => (
    <svg
      key={key}
      viewBox="0 0 28 16"
      className={`w-5 h-3 ${flip ? 'rotate-180' : ''} ${className}`}
      aria-hidden="true"
    >
      <path
        d="M2 2 H26 V14 L14 8.5 L2 14 Z"
        fill={style === 'white' ? 'none' : 'currentColor'}
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  );

  if (style === 'double') {
    return (
      <span className="inline-flex flex-col items-center gap-0.5 text-[#057091]">
        {renderSingle('top', false)}
        {renderSingle('bottom', true)}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center text-[#057091]">
      {renderSingle('single', flipped)}
    </span>
  );
};

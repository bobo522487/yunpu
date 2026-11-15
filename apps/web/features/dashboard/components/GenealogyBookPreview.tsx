import React from 'react';
import { Star } from 'lucide-react';
import { AssetColorTheme } from '../../../types';
import { ASSET_COLOR_PALETTES } from '../../../store/useWorkspaceStore';

interface GenealogyBookPreviewProps {
  projectName: string;
  primaryName: string;
  primarySurname: string;
  region: string;
  projectState: '0' | '1';
  projectLevel: number;
  colorTheme: AssetColorTheme;
}

const COVER_THEMES: Record<
  AssetColorTheme,
  { coverBg: string; spineBg: string; borderTint: string; sealBg: string }
> = {
  sky: {
    coverBg: 'from-[#1D3557] via-[#26466D] to-[#162844]',
    spineBg: '#112038',
    borderTint: 'rgba(147, 197, 253, 0.3)',
    sealBg: '#B91C1C',
  },
  indigo: {
    coverBg: 'from-[#232B52] via-[#2D386B] to-[#192040]',
    spineBg: '#121730',
    borderTint: 'rgba(165, 180, 252, 0.3)',
    sealBg: '#B91C1C',
  },
  emerald: {
    coverBg: 'from-[#163B33] via-[#1E4D42] to-[#102B25]',
    spineBg: '#0B1F1B',
    borderTint: 'rgba(110, 231, 183, 0.28)',
    sealBg: '#B91C1C',
  },
  orange: {
    coverBg: 'from-[#4A2511] via-[#5F3118] to-[#361A0B]',
    spineBg: '#271207',
    borderTint: 'rgba(253, 186, 116, 0.3)',
    sealBg: '#991B1B',
  },
  pink: {
    coverBg: 'from-[#4E1D3B] via-[#63264B] to-[#38132A]',
    spineBg: '#290D1E',
    borderTint: 'rgba(249, 168, 212, 0.28)',
    sealBg: '#9F1239',
  },
  violet: {
    coverBg: 'from-[#332152] via-[#422B69] to-[#24163B]',
    spineBg: '#1A102B',
    borderTint: 'rgba(196, 181, 253, 0.3)',
    sealBg: '#B91C1C',
  },
};

export const GenealogyBookPreview: React.FC<GenealogyBookPreviewProps> = ({
  projectName,
  primaryName,
  primarySurname,
  region,
  projectState,
  projectLevel,
  colorTheme,
}) => {
  const palette = ASSET_COLOR_PALETTES[colorTheme] || ASSET_COLOR_PALETTES.indigo;
  const cover = COVER_THEMES[colorTheme] || COVER_THEMES.indigo;
  const hasTitle = Boolean(primaryName.trim());
  const displayTitle = hasTitle ? primaryName.trim() : '右侧输入主题名';
  const displaySurname = primarySurname.trim();
  const displayRegion = region
    ? region
        .split('/')
        .map((s) => s.trim())
        .filter(Boolean)
        .join(' · ')
    : '未设置地区';

  return (
    <div className="flex flex-col items-center w-full select-none">
      {/* Traditional Thread-Bound Book Cover */}
      <div
        className={`relative w-[228px] h-[324px] rounded-l-md rounded-r-[3px] bg-gradient-to-br ${cover.coverBg} shadow-[0_14px_30px_-10px_rgba(15,23,42,0.45)] overflow-hidden transition-colors duration-200`}
        style={{
          boxShadow:
            '0 14px 28px -10px rgba(0, 0, 0, 0.38), inset 0 1px 0 rgba(255, 255, 255, 0.14)',
        }}
      >
        {/* Subtle silk-cloth weave pattern */}
        <div
          className="absolute inset-0 opacity-[0.07] pointer-events-none"
          style={{
            backgroundImage:
              'repeating-linear-gradient(45deg, #fff 0, #fff 1px, transparent 1px, transparent 5px)',
          }}
        />

        {/* Inner decorative hairline frame */}
        <div
          className="absolute inset-3 right-7 rounded-[2px] border pointer-events-none"
          style={{ borderColor: cover.borderTint }}
        />

        {/* Right Spine & Traditional 4-Needle Thread Binding (四眼线装) */}
        <div
          className="absolute top-0 right-0 bottom-0 w-5 border-l border-white/15 flex flex-col justify-between py-6 items-center"
          style={{ backgroundColor: cover.spineBg }}
        >
          {[0, 1, 2, 3].map((idx) => (
            <div key={idx} className="relative w-full flex items-center justify-center">
              <span className="block w-full h-[1.5px] bg-[#E5DEC9]/80" />
              <span className="absolute left-1 w-1.5 h-1.5 rounded-full bg-[#E5DEC9]/90 shadow-xs" />
            </div>
          ))}
        </div>

        {/* Left Vertical Ivory Title Slip (题签) */}
        <div className="absolute top-7 left-6 w-[58px] min-h-[192px] max-h-[218px] bg-[#FAF6EC] rounded-[2px] shadow-[0_2px_6px_rgba(0,0,0,0.28)] p-1 flex flex-col items-center justify-center">
          <div className="w-full h-full border border-[#3E352A]/45 rounded-[1px] px-1.5 py-3 flex items-center justify-center">
            <div
              className={`text-center tracking-[0.22em] leading-snug break-all ${
                hasTitle
                  ? 'text-[17px] font-bold text-[#1F1A14]'
                  : 'text-[13px] font-medium text-[#8C8173]'
              }`}
              style={{
                writingMode: 'vertical-rl',
                textOrientation: 'upright',
              }}
            >
              {displayTitle}
            </div>
          </div>
        </div>

        {/* Surname Vermilion Seal (朱文姓氏印章) */}
        {displaySurname ? (
          <div
            className="absolute top-8 right-9 w-9 h-9 rounded-[3px] border border-white/25 flex items-center justify-center shadow-sm"
            style={{ backgroundColor: cover.sealBg }}
            title={`主姓氏：${displaySurname}`}
          >
            <div className="w-7 h-7 border border-[#FDE8E8]/60 rounded-[2px] flex items-center justify-center">
              <span className="text-[14px] font-bold text-[#FFF5F5] leading-none">
                {displaySurname.slice(0, 1)}
              </span>
            </div>
          </div>
        ) : (
          <div
            className="absolute top-8 right-9 w-9 h-9 rounded-[3px] border border-dashed border-white/25 flex items-center justify-center"
            title="姓氏印章预览"
          >
            <span className="text-[10px] font-medium text-white/45">姓</span>
          </div>
        )}

        {/* Bottom Colophon Info on Book Cover */}
        <div className="absolute bottom-5 left-6 right-9 space-y-1.5">
          <div className="flex items-center gap-1" aria-label={`重要等级 ${projectLevel} 级`}>
            {[1, 2, 3, 4, 5].map((star) => (
              <Star
                key={star}
                size={11}
                className={
                  star <= projectLevel
                    ? 'fill-[#FBBF24] text-[#FBBF24]'
                    : 'text-white/25'
                }
              />
            ))}
          </div>
          <div className="text-[11px] font-medium text-white/85 truncate">
            {projectName.trim() || '未命名云谱项目'}
          </div>
          <div className="text-[10px] text-white/60 truncate">
            {displayRegion}
          </div>
        </div>
      </div>

      {/* Quiet Preview Metadata Summary (Zero-Pill Clean Text) */}
      <div className="mt-4 w-full max-w-[228px] text-center space-y-1">
        <div className="flex items-center justify-center gap-1.5 text-[12px] font-medium text-foreground">
          <span
            className="inline-block w-2 h-2 rounded-xs shrink-0"
            style={{ backgroundColor: palette.fillLight }}
          />
          <span className="truncate">云谱封面实时预览</span>
        </div>
        <div className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground tabular-nums">
          <span>{projectState === '1' ? '已完成' : '进行中'}</span>
          <span aria-hidden="true">·</span>
          <span>重要等级 {projectLevel} 星</span>
        </div>
      </div>
    </div>
  );
};

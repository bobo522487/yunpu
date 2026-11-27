export interface FigureAttrs {
  assetId: string;
  caption: string;
  widthPct: number;
  align: 'left' | 'center' | 'right';
}

export function normalizeFigureAttrs(input: {
  assetId?: string;
  src?: string;
  caption?: string;
  widthPct?: number;
  align?: string;
}): FigureAttrs {
  if ((input.src ?? '').startsWith('data:')) {
    throw new Error('谱文图片禁止内联 Base64');
  }
  const assetId = (input.assetId ?? '').trim();
  if (!assetId) throw new Error('谱文图片必须有 assetId');
  const width = Number.isFinite(input.widthPct) ? Number(input.widthPct) : 80;
  const align = input.align === 'left' || input.align === 'right' ? input.align : 'center';
  return {
    assetId,
    caption: input.caption ?? '',
    widthPct: Math.min(100, Math.max(20, Math.round(width))),
    align,
  };
}
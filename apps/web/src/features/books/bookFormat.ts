import type { BookPaperSize } from './types';

export const PAPER_SIZE_LABELS: Record<BookPaperSize, string> = {
  thread_185x290: '标准线装 (18.5cm x 29.0cm)',
  a4_210x297: '大十六开 A4 (21.0cm x 29.7cm)',
  k16_185x260: '传统十六开 (18.5cm x 26.0cm)',
};

export const BINDING_LABELS: Record<'thread' | 'hardcover', string> = {
  thread: '古籍线装',
  hardcover: '现代精装',
};

export const LINEAGE_STYLE_LABELS: Record<
  'euler' | 'su' | 'modern_double',
  string
> = {
  euler: '欧式',
  su: '苏式',
  modern_double: '现代双栏',
};

export function toChineseNumeral(num: number): string {
  if (!Number.isFinite(num) || num <= 0) return String(num);
  const digits = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
  if (num < 10) return digits[num];
  if (num === 10) return '十';
  if (num < 20) return `十${digits[num % 10]}`;
  if (num < 100) {
    const tens = Math.floor(num / 10);
    const ones = num % 10;
    return `${digits[tens]}十${ones > 0 ? digits[ones] : ''}`;
  }
  return String(num);
}

export function formatPageNumberLabel(
  pageNo: number,
  style: 'chinese' | 'arabic'
): string {
  if (style === 'arabic') return `第 ${pageNo} 页`;
  return `第${toChineseNumeral(pageNo)}页`;
}

export function sanitizeVolumeNo(raw: string): string {
  // 限5个汉字或字符，保留常见中文数字与卷标识
  const trimmed = raw.trim();
  const chars = Array.from(trimmed);
  return chars.slice(0, 5).join('');
}

export function formatTimestampNow(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${d} ${hh}:${mm}`;
}

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  getGenderAvatarToneClass,
  getGenderBarClass,
  getGenderCardSurfaceClass,
  getGenderFocusBgClass,
  getGenderTopStripeClass,
  resolveMiniMapNodeColor,
  type LineageGender,
} from './lineageTheme';

const LINEAGE_TOKENS = [
  '--lineage-canvas-bg',
  '--lineage-edge',
  '--lineage-minimap-node',
  '--lineage-progenitor-bg',
  '--lineage-progenitor-fg',
  '--lineage-male',
  '--lineage-male-fg',
  '--lineage-female',
  '--lineage-female-fg',
  '--lineage-unknown',
  '--lineage-unknown-fg',
  '--lineage-living',
  '--lineage-living-fg',
] as const;

const LEGACY_COLOR_PATTERN = /#[0-9a-fA-F]{3,8}|sky-|rose-|slate-|emerald-/;

function extractCssBlock(css: string, headerPattern: RegExp): string {
  const match = headerPattern.exec(css);
  if (!match) {
    throw new Error(`CSS block not found for pattern: ${headerPattern}`);
  }
  const start = match.index + match[0].length;
  let depth = 1;
  let cursor = start;
  while (cursor < css.length && depth > 0) {
    const ch = css[cursor];
    if (ch === '{') depth += 1;
    else if (ch === '}') depth -= 1;
    cursor += 1;
  }
  return css.slice(start, cursor - 1);
}

describe('lineageTheme 辅助函数与 CSS 令牌契约', () => {
  const genders: LineageGender[] = ['male', 'female', 'unknown'];

  it('性别类辅助函数返回语义化 lineage-* 类名且无硬编码色值或遗留色阶', () => {
    for (const gender of genders) {
      const classes = [
        getGenderTopStripeClass(gender),
        getGenderBarClass(gender),
        getGenderAvatarToneClass(gender),
        getGenderFocusBgClass(gender),
      ];
      for (const cls of classes) {
        expect(cls).toContain(`lineage-${gender}`);
        expect(cls).not.toMatch(LEGACY_COLOR_PATTERN);
      }

      const cardSurface = getGenderCardSurfaceClass(gender);
      expect(cardSurface).not.toMatch(LEGACY_COLOR_PATTERN);
      if (gender === 'unknown') {
        expect(cardSurface).toContain('--surface-subtle');
      } else {
        expect(cardSurface).toContain(`lineage-${gender}`);
      }
    }
  });

  it('resolveMiniMapNodeColor 仅返回 CSS 令牌且清晰区分选中节点与一世始祖', () => {
    expect(
      resolveMiniMapNodeColor({ id: 'union-1', type: 'union' }, 'p-1')
    ).toBe('var(--lineage-edge)');

    const selectedColor = resolveMiniMapNodeColor(
      { id: 'p-1', type: 'person', data: { person: { generation: 1 } } },
      'p-1'
    );
    const progenitorColor = resolveMiniMapNodeColor(
      { id: 'p-1', type: 'person', data: { person: { generation: 1 } } },
      'p-2'
    );
    const descendantColor = resolveMiniMapNodeColor(
      { id: 'p-3', type: 'person', data: { person: { generation: 3 } } },
      'p-1'
    );

    expect(selectedColor).toBe('var(--primary)');
    expect(progenitorColor).toBe('var(--lineage-progenitor-bg)');
    expect(descendantColor).toBe('var(--lineage-minimap-node)');
    expect(selectedColor).not.toBe(progenitorColor);
  });

  it('theme.css 四套预设与 @theme inline 完整定义并映射全部 13 个 --lineage-* 令牌', () => {
    const themeCssPath = path.resolve(
      import.meta.dirname,
      '../../../styles/theme.css'
    );
    const themeCss = readFileSync(themeCssPath, 'utf8');

    const presetHeaders: Array<[string, RegExp]> = [
      ['default light', /:root,\s*\[data-preset='default'\]\s*\{/],
      ['default dark', /\.dark,\s*\.dark\[data-preset='default'\]\s*\{/],
      ['solar-dusk light', /(?:^|\n)\[data-preset='solar-dusk'\]\s*\{/],
      ['solar-dusk dark', /\.dark\[data-preset='solar-dusk'\]\s*\{/],
    ];

    for (const [label, pattern] of presetHeaders) {
      const block = extractCssBlock(themeCss, pattern);
      for (const token of LINEAGE_TOKENS) {
        expect(block, `${label} missing ${token}`).toContain(`${token}:`);
      }
    }

    const themeInlineBlock = extractCssBlock(themeCss, /@theme inline\s*\{/);
    for (const token of LINEAGE_TOKENS) {
      const colorVar = token.replace('--lineage-', '--color-lineage-');
      expect(themeInlineBlock).toContain(`${colorVar}: var(${token});`);
    }
  });

  it('domain.css 已清理历史 .fs-lineage-theme 覆写并保留白纸打印与正确的遮罩透明度', () => {
    const domainCssPath = path.resolve(
      import.meta.dirname,
      '../../../styles/domain.css'
    );
    const domainCss = readFileSync(domainCssPath, 'utf8');

    expect(domainCss).not.toContain('.fs-lineage-theme');
    expect(domainCss).not.toContain('--fs-edge-stroke');
    expect(domainCss).toContain(
      'background-color: var(--lineage-canvas-bg) !important;'
    );
    expect(domainCss).toContain(
      'fill: color-mix(in oklab, var(--lineage-canvas-bg) 75%, transparent) !important;'
    );
    expect(domainCss).not.toContain('0.75%');

    const printBlock = extractCssBlock(domainCss, /@media print\s*\{/);
    expect(printBlock).toContain('--lineage-canvas-bg: #ffffff');

    // The shared print palette is the Default preset's cool snapshot, so Solar
    // Dusk needs its own warm override or printing silently reverts male nodes
    // to blue.
    const solarDuskPrintBlock = extractCssBlock(
      printBlock,
      /\[data-preset='solar-dusk'\],\s*\.dark\[data-preset='solar-dusk'\]\s*\{/
    );
    for (const token of ['--lineage-male', '--lineage-female']) {
      const value = new RegExp(`${token}:\\s*#([0-9a-fA-F]{6})`).exec(
        solarDuskPrintBlock
      );
      expect(value, `solar-dusk print missing ${token}`).not.toBeNull();
      // Warm hue: red channel dominates blue for every Solar Dusk gender colour.
      const [, hex] = value!;
      const red = parseInt(hex.slice(0, 2), 16);
      const blue = parseInt(hex.slice(4, 6), 16);
      expect(red, `${token} print value is not warm`).toBeGreaterThan(blue);
    }
  });
});

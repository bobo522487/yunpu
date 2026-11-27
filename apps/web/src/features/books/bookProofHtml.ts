import { formatPageNumberLabel, toChineseNumeral } from './bookFormat';
import type { BookEdition, BookRecord } from './types';

export function generateProofHtmlDocument(
  book: BookRecord,
  edition: BookEdition,
  mode: 'proof' | 'print'
): string {
  const fontCss =
    edition.layoutSnapshot.fontFamily === 'kai'
      ? '"Kaiti SC", "STKaiti", "KaiTi", serif'
      : edition.layoutSnapshot.fontFamily === 'fangsong'
        ? '"FangSong", "STFangsong", serif'
        : edition.layoutSnapshot.fontFamily === 'hei'
          ? '"PingFang SC", "Microsoft YaHei", sans-serif'
          : '"Noto Serif SC", "Songti SC", "SimSun", serif';

  const pagesHtml = edition.pages
    .map((p) => {
      let body = '';
      if (p.type === 'cover') {
        body = `<div style="text-align:center; padding:80px 32px; border:2px double #2b2118; height:100%; box-sizing:border-box;">
          <div style="font-size:14px; letter-spacing:4px; color:#6b5c4d; margin-bottom:24px;">${p.hallName} · ${book.volumeNo || '卷一'}</div>
          <h1 style="font-size:34px; letter-spacing:6px; margin:24px 0;">${book.bookName}</h1>
          <div style="margin-top:48px; font-size:14px; color:#4b3f35;">${book.editor || '家族编委会'} 编修 · ${book.compilationDate || ''}</div>
        </div>`;
      } else if (p.type === 'toc') {
        const rows = (p.tocEntries || [])
          .map(
            (t) =>
              `<div style="display:flex; justify-content:space-between; padding:6px 0; border-bottom:1px dashed #d6cfc4; padding-left:${t.level === 2 ? '20px' : '0'};">
                <span>${t.title}</span><span>${formatPageNumberLabel(t.pageNo, edition.layoutSnapshot.pageNumberStyle)}</span>
              </div>`
          )
          .join('');
        body = `<h2 style="font-size:20px; border-bottom:1px solid #2b2118; padding-bottom:8px; margin-bottom:16px;">谱书总目</h2>${rows || '<p>暂无目录条目</p>'}`;
      } else if (p.type === 'article') {
        body = `<h2 style="font-size:19px; margin-bottom:6px;">${p.title || ''}</h2>
          <div style="font-size:12px; color:#6b5c4d; margin-bottom:16px;">${p.author || ''}</div>
          <div style="line-height:1.9; font-size:14px;">${p.contentHtml || ''}</div>`;
      } else if (p.type === 'lineage_index') {
        const rows = (p.indexRows || [])
          .map(
            (r) =>
              `<tr><td style="padding:6px;border-bottom:1px solid #e5e0d5;">第${toChineseNumeral(r.generation)}世</td><td style="padding:6px;border-bottom:1px solid #e5e0d5;font-weight:bold;">${r.name}</td><td style="padding:6px;border-bottom:1px solid #e5e0d5;">${r.fatherName}</td><td style="padding:6px;border-bottom:1px solid #e5e0d5;text-align:right;">P.${r.pageRef}</td></tr>`
          )
          .join('');
        body = `<h2 style="font-size:18px; margin-bottom:12px;">${p.title || '族丁检索表'}</h2>
          <table style="width:100%; border-collapse:collapse; font-size:13px;">
            <thead><tr style="border-bottom:1.5px solid #2b2118;"><th style="text-align:left;padding:6px;">世次</th><th style="text-align:left;padding:6px;">谱名</th><th style="text-align:left;padding:6px;">父讳</th><th style="text-align:right;padding:6px;">页码</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>`;
      } else if (p.type === 'lineage_tree') {
        const items = (p.treePersons || [])
          .map(
            (tp) =>
              `<div style="margin-left:${Math.max(0, (tp.generation - 1) * 18)}px; padding:4px 0; font-size:13px;">
                <span style="color:#8c2d25;">[${toChineseNumeral(tp.generation)}世]</span> <strong>${tp.name}</strong> ${tp.rank ? `(${tp.rank})` : ''}
              </div>`
          )
          .join('');
        body = `<h2 style="font-size:18px; margin-bottom:12px;">${p.title || '吊线图'}</h2><div>${items}</div>`;
      } else if (p.type === 'lineage_table') {
        const items = (p.lineageEntries || [])
          .map(
            (e) =>
              `<div style="padding:10px 0; border-bottom:1px dashed #d6cfc4;">
                <div style="font-weight:bold; font-size:15px;">[第${toChineseNumeral(e.generation)}世] ${e.name} ${e.fatherName ? `（${e.fatherName}之子）` : ''}</div>
                <div style="font-size:13px; color:#3d332a; margin-top:4px; line-height:1.7;">${e.summaryText}</div>
              </div>`
          )
          .join('');
        body = `<h2 style="font-size:18px; margin-bottom:12px;">${p.title || '世系表'}</h2>${items}`;
      }

      return `<section class="book-page">
        <div class="page-head">
          <span>${edition.layoutSnapshot.showHeaderName ? p.headerTitle : ''}</span>
          <span>${p.eyebrowTitle}</span>
          <span>${edition.layoutSnapshot.showHallName ? p.hallName : ''}</span>
        </div>
        <div class="page-body">${body}</div>
        <div class="page-foot">${formatPageNumberLabel(p.pageNo, edition.layoutSnapshot.pageNumberStyle)}</div>
      </section>`;
    })
    .join('\n');

  const printPageCss =
    mode === 'print'
      ? `
    @page {
      size: A4;
      margin: 18mm 16mm 20mm;
      @bottom-center { content: counter(page) " / " counter(pages); }
    }
    @media print {
      .page-foot { display: none; }
    }`
      : '';

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <title>${book.bookName} - ${mode === 'print' ? '高清印刷版' : '校对稿'}</title>
  <style>
    body { margin: 0; padding: 24px; background: #f3f1ec; font-family: ${fontCss}; color: #1f1a14; }
    .book-page { width: 720px; min-height: 980px; margin: 0 auto 24px; background: #fffdf8; border: 1px solid #cfc8ba; padding: 36px 42px; box-sizing: border-box; display: flex; flex-direction: column; page-break-after: always; }
    .page-head { display: flex; justify-content: space-between; font-size: 12px; color: #6b5c4d; border-bottom: 1px solid #2b2118; padding-bottom: 8px; margin-bottom: 20px; }
    .page-body { flex: 1; }
    .page-foot { text-align: center; font-size: 12px; color: #6b5c4d; border-top: 1px solid #e5e0d5; padding-top: 8px; margin-top: 20px; }
    @media print { body { background: #fff; padding: 0; } .book-page { border: none; margin: 0; box-shadow: none; } }${printPageCss}
  </style>
</head>
<body>${pagesHtml}</body>
</html>`;
}

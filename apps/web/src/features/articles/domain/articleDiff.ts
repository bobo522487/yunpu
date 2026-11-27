import type { JSONContent } from '@tiptap/core';

export interface ArticleBlockDiff {
  kind: 'same' | 'added' | 'removed';
  text: string;
}

function textOf(node: JSONContent): string {
  if (node.type === 'text') return node.text ?? '';
  if (node.type === 'personMention') return String(node.attrs?.fallbackName ?? '');
  return (node.content ?? []).map((child) => textOf(child)).join('');
}

function blockTexts(json: JSONContent): string[] {
  const texts: string[] = [];
  const visit = (node: JSONContent) => {
    if (node.type === 'paragraph' || node.type === 'heading') {
      texts.push(textOf(node));
      return;
    }
    for (const child of node.content ?? []) visit(child);
  };
  for (const child of json.content ?? []) visit(child);
  return texts;
}

export function diffArticleParagraphs(before: JSONContent, after: JSONContent): ArticleBlockDiff[] {
  const left = blockTexts(before);
  const right = blockTexts(after);
  const dp: number[][] = Array.from({ length: left.length + 1 }, () => Array(right.length + 1).fill(0));
  for (let i = left.length - 1; i >= 0; i -= 1) {
    for (let j = right.length - 1; j >= 0; j -= 1) {
      dp[i][j] = left[i] === right[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const diff: ArticleBlockDiff[] = [];
  let i = 0;
  let j = 0;
  while (i < left.length && j < right.length) {
    if (left[i] === right[j]) {
      diff.push({ kind: 'same', text: left[i] });
      i += 1;
      j += 1;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      diff.push({ kind: 'removed', text: left[i] });
      i += 1;
    } else {
      diff.push({ kind: 'added', text: right[j] });
      j += 1;
    }
  }
  while (i < left.length) {
    diff.push({ kind: 'removed', text: left[i] });
    i += 1;
  }
  while (j < right.length) {
    diff.push({ kind: 'added', text: right[j] });
    j += 1;
  }
  return diff;
}
import { generateHTML, generateJSON, type JSONContent } from '@tiptap/core';
import { createArticleExtensions } from '../extensions/createArticleExtensions';
import {
  mapContentJsonPersonMentionsForOutput,
  type PersonMentionOutputContext,
} from './outputContentJson';

export function htmlToContentJson(html: string): JSONContent {
  return generateJSON(html || '<p></p>', createArticleExtensions());
}

export function contentJsonToHtml(json: JSONContent): string {
  return generateHTML(json, createArticleExtensions());
}

export function contentJsonToOutputHtml(
  json: JSONContent,
  ctx: PersonMentionOutputContext,
): string {
  const projected = mapContentJsonPersonMentionsForOutput(json, ctx);
  return generateHTML(projected, createArticleExtensions());
}
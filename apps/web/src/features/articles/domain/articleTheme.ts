export type ArticleTheme = 'modern' | 'classic';

export function nextArticleTheme(theme: ArticleTheme): ArticleTheme {
  return theme === 'modern' ? 'classic' : 'modern';
}
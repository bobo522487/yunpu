import { useEffect, useState } from 'react';
import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react';
import { createIndexedDbArticleAssetStore } from '../assets/articleAssetStore';

export function FigureImageView({ node }: NodeViewProps) {
  const assetId = String(node.attrs.assetId ?? '');
  const caption = String(node.attrs.caption ?? '');
  const widthPct = Number(node.attrs.widthPct ?? 80);
  const align = String(node.attrs.align ?? 'center');
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    if (!assetId) {
      setSrc(null);
      return;
    }
    let cancelled = false;
    let objectUrl: string | null = null;
    const store = createIndexedDbArticleAssetStore();
    void store.get(assetId).then((record) => {
      if (cancelled || !record) return;
      const blob = new Blob([new Uint8Array(record.bytes)], {
        type: record.contentType || 'image/png',
      });
      objectUrl = URL.createObjectURL(blob);
      setSrc(objectUrl);
    });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [assetId]);

  const justify =
    align === 'left' ? 'flex-start' : align === 'right' ? 'flex-end' : 'center';

  return (
    <NodeViewWrapper
      as="figure"
      className="puwen-figure"
      data-asset-id={assetId || undefined}
      data-caption={caption || undefined}
      data-width-pct={String(widthPct)}
      data-align={align}
      style={{ display: 'flex', flexDirection: 'column', alignItems: justify }}
    >
      {src ? (
        <img
          src={src}
          alt={caption}
          data-asset-id={assetId}
          style={{ width: `${widthPct}%`, maxWidth: '100%' }}
        />
      ) : (
        <div
          aria-hidden
          className="puwen-figure-placeholder"
          style={{
            width: `${widthPct}%`,
            maxWidth: '100%',
            minHeight: 120,
            background: 'var(--muted)',
          }}
        />
      )}
      {caption ? <figcaption>{caption}</figcaption> : null}
    </NodeViewWrapper>
  );
}
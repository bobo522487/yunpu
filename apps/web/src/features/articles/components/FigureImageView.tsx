import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react';
import { useProjectId } from '../../../hooks/useProjectId';
import { articleAssetUrl } from '../api';

export function FigureImageView({ node }: NodeViewProps) {
  const projectId = useProjectId();
  const assetId = String(node.attrs.assetId ?? '');
  const caption = String(node.attrs.caption ?? '');
  const widthPct = Number(node.attrs.widthPct ?? 80);
  const align = String(node.attrs.align ?? 'center');

  const src = assetId ? articleAssetUrl(projectId ?? '', assetId) : null;

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

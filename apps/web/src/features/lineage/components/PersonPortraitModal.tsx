import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Camera,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
  Upload,
  User,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ModalBody, ModalFooter, ModalShell } from '@/components/ui/modal';
import { cn } from '../../../lib/utils';
import { type PersonRecord } from '../types';

export interface PersonPortraitUpdate {
  avatarUrl?: string;
  avatarOriginalUrl?: string;
  avatarPhotos?: string[];
}

interface PersonPortraitModalProps {
  isOpen: boolean;
  person: PersonRecord;
  displayName: string;
  onClose: () => void;
  onUpdateAvatar: (updates: PersonPortraitUpdate) => void;
}

const STAGE_SIZE = 280;
const CROP_DIAMETER = 220;
const EXPORT_SIZE = 320;
const MAX_SOURCE_DIMENSION = 960;
const MAX_GALLERY_ITEMS = 8;
const MIN_ZOOM = 1;
const MAX_ZOOM = 3;

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (/^https?:\/\//i.test(src)) {
      img.crossOrigin = 'anonymous';
    }
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('图片加载失败'));
    img.src = src;
  });
}

function compressSourceImage(img: HTMLImageElement): string {
  const natW = img.naturalWidth || img.width;
  const natH = img.naturalHeight || img.height;
  const scale = Math.min(1, MAX_SOURCE_DIMENSION / Math.max(natW, natH));
  const outW = Math.max(1, Math.round(natW * scale));
  const outH = Math.max(1, Math.round(natH * scale));

  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext('2d');
  if (!ctx) return img.src;
  ctx.drawImage(img, 0, 0, outW, outH);
  return canvas.toDataURL('image/jpeg', 0.88);
}

export const PersonPortraitModal: React.FC<PersonPortraitModalProps> = ({
  isOpen,
  person,
  displayName,
  onClose,
  onUpdateAvatar,
}) => {
  const titleId = useId();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const loadedImageRef = useRef<HTMLImageElement | null>(null);
  const dragStateRef = useRef<{
    pointerId: number;
    startClientX: number;
    startClientY: number;
    startOffsetX: number;
    startOffsetY: number;
  } | null>(null);

  const [view, setView] = useState<'overview' | 'crop'>('overview');
  const [sourceUrl, setSourceUrl] = useState<string>('');
  const [naturalSize, setNaturalSize] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [isLoadingImage, setIsLoadingImage] = useState(false);
  const [cropError, setCropError] = useState<string | null>(null);
  const [overviewImgError, setOverviewImgError] = useState(false);

  const galleryPhotos = useMemo(() => {
    const items = [
      ...(person.avatarPhotos || []),
      person.avatarOriginalUrl || '',
      person.avatarUrl || '',
    ]
      .map((u) => u.trim())
      .filter(Boolean);
    return Array.from(new Set(items)).slice(0, MAX_GALLERY_ITEMS);
  }, [person.avatarPhotos, person.avatarOriginalUrl, person.avatarUrl]);

  useEffect(() => {
    if (!isOpen) return;
    setView('overview');
    setSourceUrl('');
    setNaturalSize(null);
    loadedImageRef.current = null;
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    setIsDragging(false);
    setIsLoadingImage(false);
    setCropError(null);
    setOverviewImgError(false);
  }, [isOpen, person.id]);

  useEffect(() => {
    setOverviewImgError(false);
  }, [person.avatarUrl]);

  // Escape in crop view steps back to overview instead of closing the modal
  useEffect(() => {
    if (!isOpen || view !== 'crop') return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented) {
        e.preventDefault();
        setView('overview');
        setCropError(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, view]);

  const computeCoverScale = useCallback(
    (size: { width: number; height: number } | null) => {
      if (!size || size.width <= 0 || size.height <= 0) return 1;
      return Math.max(CROP_DIAMETER / size.width, CROP_DIAMETER / size.height);
    },
    []
  );

  const clampOffset = useCallback(
    (
      nextX: number,
      nextY: number,
      targetZoom: number,
      size: { width: number; height: number } | null
    ) => {
      if (!size) return { x: 0, y: 0 };
      const effectiveScale = computeCoverScale(size) * targetZoom;
      const dispW = size.width * effectiveScale;
      const dispH = size.height * effectiveScale;
      const maxOffsetX = Math.max(0, (dispW - CROP_DIAMETER) / 2);
      const maxOffsetY = Math.max(0, (dispH - CROP_DIAMETER) / 2);
      return {
        x: clamp(nextX, -maxOffsetX, maxOffsetX),
        y: clamp(nextY, -maxOffsetY, maxOffsetY),
      };
    },
    [computeCoverScale]
  );

  const openCropperWithSource = useCallback(async (rawUrl: string) => {
    if (!rawUrl) return;
    setView('crop');
    setIsLoadingImage(true);
    setCropError(null);
    setZoom(1);
    setOffset({ x: 0, y: 0 });

    try {
      const img = await loadImageElement(rawUrl);
      const natW = img.naturalWidth || img.width;
      const natH = img.naturalHeight || img.height;
      if (!natW || !natH) {
        throw new Error('无法读取图片尺寸');
      }
      loadedImageRef.current = img;
      setSourceUrl(rawUrl);
      setNaturalSize({ width: natW, height: natH });
    } catch {
      loadedImageRef.current = null;
      setSourceUrl(rawUrl);
      setNaturalSize(null);
      setCropError('图片加载失败，请点击「更换照片」重新选择本地图片。');
    } finally {
      setIsLoadingImage(false);
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      if (typeof reader.result !== 'string') return;
      setView('crop');
      setIsLoadingImage(true);
      setCropError(null);
      setZoom(1);
      setOffset({ x: 0, y: 0 });

      try {
        const rawImg = await loadImageElement(reader.result);
        const compressedUrl = compressSourceImage(rawImg);
        const compressedImg = await loadImageElement(compressedUrl);
        loadedImageRef.current = compressedImg;
        setSourceUrl(compressedUrl);
        setNaturalSize({
          width: compressedImg.naturalWidth || compressedImg.width,
          height: compressedImg.naturalHeight || compressedImg.height,
        });
      } catch {
        setCropError('无法读取所选图片文件，请尝试其他 JPG / PNG 图片。');
      } finally {
        setIsLoadingImage(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleZoomChange = (nextZoomRaw: number) => {
    const nextZoom = clamp(Number(nextZoomRaw.toFixed(2)), MIN_ZOOM, MAX_ZOOM);
    setZoom(nextZoom);
    setOffset((prev) => clampOffset(prev.x, prev.y, nextZoom, naturalSize));
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!naturalSize || isLoadingImage) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragStateRef.current = {
      pointerId: e.pointerId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startOffsetX: offset.x,
      startOffsetY: offset.y,
    };
    setIsDragging(true);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragStateRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    const dx = e.clientX - drag.startClientX;
    const dy = e.clientY - drag.startClientY;
    setOffset(
      clampOffset(
        drag.startOffsetX + dx,
        drag.startOffsetY + dy,
        zoom,
        naturalSize
      )
    );
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragStateRef.current?.pointerId === e.pointerId) {
      dragStateRef.current = null;
      setIsDragging(false);
    }
  };

  const handleWheelZoom = (e: React.WheelEvent<HTMLDivElement>) => {
    if (!naturalSize || isLoadingImage) return;
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.1 : -0.1;
    handleZoomChange(zoom + delta);
  };

  const handleSaveCroppedPortrait = () => {
    const imgEl = loadedImageRef.current;
    if (!imgEl || !naturalSize) {
      setCropError('请先选择有效的肖像照片。');
      return;
    }

    try {
      const effectiveScale = computeCoverScale(naturalSize) * zoom;
      const dispW = naturalSize.width * effectiveScale;
      const dispH = naturalSize.height * effectiveScale;
      const clamped = clampOffset(offset.x, offset.y, zoom, naturalSize);

      const cropLeftOnDisp = (dispW - CROP_DIAMETER) / 2 - clamped.x;
      const cropTopOnDisp = (dispH - CROP_DIAMETER) / 2 - clamped.y;

      const sx = cropLeftOnDisp / effectiveScale;
      const sy = cropTopOnDisp / effectiveScale;
      const sSize = CROP_DIAMETER / effectiveScale;

      const canvas = document.createElement('canvas');
      canvas.width = EXPORT_SIZE;
      canvas.height = EXPORT_SIZE;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('浏览器画布不可用');
      }

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(
        imgEl,
        sx,
        sy,
        sSize,
        sSize,
        0,
        0,
        EXPORT_SIZE,
        EXPORT_SIZE
      );

      const croppedDataUrl = canvas.toDataURL('image/jpeg', 0.9);
      const nextOriginal = sourceUrl || croppedDataUrl;
      const nextGallery = Array.from(
        new Set([nextOriginal, ...galleryPhotos])
      ).slice(0, MAX_GALLERY_ITEMS);

      onUpdateAvatar({
        avatarUrl: croppedDataUrl,
        avatarOriginalUrl: nextOriginal,
        avatarPhotos: nextGallery,
      });
      setView('overview');
      setCropError(null);
    } catch {
      setCropError(
        '该外部链接图片受浏览器跨域限制无法裁剪，请点击「更换照片」上传本地图片。'
      );
    }
  };

  const handleRemoveActiveAvatar = () => {
    onUpdateAvatar({
      avatarUrl: undefined,
      avatarOriginalUrl: undefined,
      avatarPhotos: galleryPhotos.filter(
        (u) => u !== person.avatarUrl && u !== person.avatarOriginalUrl
      ),
    });
  };

  const handleDeleteGalleryPhoto = (photoUrl: string) => {
    const nextPhotos = galleryPhotos.filter((u) => u !== photoUrl);
    const removingActive =
      photoUrl === person.avatarUrl || photoUrl === person.avatarOriginalUrl;

    onUpdateAvatar({
      avatarUrl: removingActive ? undefined : person.avatarUrl,
      avatarOriginalUrl: removingActive
        ? undefined
        : person.avatarOriginalUrl,
      avatarPhotos: nextPhotos,
    });
  };

  const avatarToneClass =
    person.gender === 'female'
      ? 'bg-rose-500/12 text-rose-700 dark:bg-rose-400/15 dark:text-rose-300 border-rose-500/25 dark:border-rose-400/30'
      : person.gender === 'male'
        ? 'bg-sky-500/12 text-primary dark:bg-sky-400/15 dark:text-primary border-sky-500/25 dark:border-sky-400/30'
        : 'bg-[var(--surface-subtle)] text-muted-foreground border-border';

  const effectiveScale = computeCoverScale(naturalSize) * zoom;
  const dispW = naturalSize ? naturalSize.width * effectiveScale : 0;
  const dispH = naturalSize ? naturalSize.height * effectiveScale : 0;
  const clampedOffset = clampOffset(offset.x, offset.y, zoom, naturalSize);
  const currentActiveSource = person.avatarOriginalUrl || person.avatarUrl;
  const hasActiveAvatar = Boolean(person.avatarUrl && !overviewImgError);

  return (
    <ModalShell
      open={isOpen}
      onClose={onClose}
      size="xl"
      zIndexClass="z-[97]"
      closeOnEsc={view !== 'crop'}
      ariaLabelledBy={titleId}
      className="fs-lineage-theme max-w-[640px]"
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Tokenized Header with optional crop back-navigation */}
      <div className="shrink-0 bg-card border-b border-border px-6 py-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {view === 'crop' && (
            <button
              type="button"
              aria-label="返回肖像概览"
              onClick={() => {
                setView('overview');
                setCropError(null);
              }}
              className="w-8 h-8 rounded-md flex items-center justify-center text-muted-foreground hover:bg-[var(--surface-hover)] hover:text-foreground transition-colors cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ArrowLeft size={16} aria-hidden="true" />
            </button>
          )}
          <div className="min-w-0">
            <h2
              id={titleId}
              className="text-[18px] leading-6 font-semibold tracking-[-0.01em] text-foreground truncate"
            >
              {displayName}的肖像
            </h2>
            <nav
              aria-label="肖像操作路径"
              className="text-[12px] leading-4 text-muted-foreground mt-0.5 flex items-center gap-1.5"
            >
              {view === 'crop' ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setView('overview');
                      setCropError(null);
                    }}
                    className="hover:text-primary hover:underline cursor-pointer"
                  >
                    变更肖像
                  </button>
                  <span aria-hidden="true">/</span>
                  <span aria-current="page">裁剪与缩放</span>
                </>
              ) : (
                <span aria-current="page">变更肖像</span>
              )}
            </nav>
          </div>
        </div>

        <button
          type="button"
          aria-label="关闭"
          onClick={onClose}
          className="w-8 h-8 -mr-1.5 rounded-md flex items-center justify-center text-muted-foreground hover:bg-[var(--surface-hover)] hover:text-foreground transition-colors cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>

      {view === 'overview' ? (
        <ModalBody className="space-y-6">
          {/* Centered 168px Portrait + Action Buttons */}
          <div className="flex flex-col items-center">
            <div
              className={cn(
                'w-[168px] h-[168px] rounded-full overflow-hidden border-2 flex items-center justify-center shrink-0 text-5xl font-semibold select-none shadow-[var(--shadow-card)]',
                avatarToneClass
              )}
            >
              {hasActiveAvatar ? (
                <img
                  src={person.avatarUrl}
                  alt={`${displayName}当前肖像`}
                  referrerPolicy="no-referrer"
                  onError={() => setOverviewImgError(true)}
                  className="w-full h-full object-cover"
                />
              ) : displayName ? (
                <span>{displayName.slice(0, 1)}</span>
              ) : (
                <User size={48} aria-hidden="true" />
              )}
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              {person.avatarUrl ? (
                <>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    data-testid="portrait-remove-button"
                    onClick={handleRemoveActiveAvatar}
                    className="gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 size={14} aria-hidden="true" />
                    <span>移除</span>
                  </Button>

                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    data-testid="portrait-edit-button"
                    onClick={() =>
                      openCropperWithSource(
                        currentActiveSource || person.avatarUrl!
                      )
                    }
                    className="gap-1.5 text-primary hover:text-primary hover:bg-[var(--surface-active)]"
                  >
                    <Pencil size={14} aria-hidden="true" />
                    <span>编辑</span>
                  </Button>

                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    data-testid="portrait-replace-button"
                    onClick={() => fileInputRef.current?.click()}
                    className="gap-1.5 text-primary hover:text-primary hover:bg-[var(--surface-active)]"
                  >
                    <Upload size={14} aria-hidden="true" />
                    <span>更换相片</span>
                  </Button>
                </>
              ) : (
                <Button
                  type="button"
                  data-testid="portrait-add-button"
                  onClick={() => fileInputRef.current?.click()}
                  className="gap-1.5"
                >
                  <Camera size={15} aria-hidden="true" />
                  <span>加入相片</span>
                </Button>
              )}
            </div>
          </div>

          {/* Gallery Section */}
          <div className="pt-4 border-t border-border space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="yp-h3 text-foreground">{displayName}的肖像相片</h3>
              <span className="text-[12px] text-muted-foreground">
                点击相片可重新拖动与缩放裁剪
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {/* Add Photo Card */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                aria-label="加入相片"
                className="group min-h-[124px] rounded-lg border border-dashed border-[var(--border-strong)] bg-[var(--surface-subtle)] hover:border-primary hover:bg-[var(--surface-active)] flex flex-col items-center justify-center gap-1.5 text-primary transition-colors cursor-pointer"
              >
                <Plus size={26} strokeWidth={2} aria-hidden="true" />
                <span className="text-[13px] font-medium">加入相片</span>
              </button>

              {/* Existing Uploaded / Associated Photos */}
              {galleryPhotos.map((photoUrl, idx) => {
                const isCurrent =
                  photoUrl === person.avatarOriginalUrl ||
                  photoUrl === person.avatarUrl;
                return (
                  <div
                    key={`${photoUrl.slice(0, 48)}-${idx}`}
                    className={cn(
                      'group relative min-h-[124px] rounded-lg overflow-hidden border bg-[var(--surface-subtle)]',
                      isCurrent
                        ? 'border-primary ring-2 ring-primary/30'
                        : 'border-border hover:border-primary/60'
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => openCropperWithSource(photoUrl)}
                      aria-label={`选择并裁剪第 ${idx + 1} 张相片`}
                      className="w-full h-[124px] block cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                    >
                      <img
                        src={photoUrl}
                        alt=""
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-150"
                      />
                    </button>

                    <button
                      type="button"
                      aria-label={`从相片库移除第 ${idx + 1} 张相片`}
                      title="从相片库移除"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteGalleryPhoto(photoUrl);
                      }}
                      className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100 hover:bg-destructive flex items-center justify-center transition-opacity cursor-pointer"
                    >
                      <X size={13} aria-hidden="true" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </ModalBody>
      ) : (
        <>
          <ModalBody className="flex flex-col items-center gap-4">
            {/* Interactive Square Crop Stage */}
            <div
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              onWheel={handleWheelZoom}
              style={{ width: STAGE_SIZE, height: STAGE_SIZE }}
              className={cn(
                'relative rounded-lg overflow-hidden bg-slate-950 border border-border select-none touch-none shrink-0',
                naturalSize && !isLoadingImage
                  ? isDragging
                    ? 'cursor-grabbing'
                    : 'cursor-grab'
                  : 'cursor-default'
              )}
            >
              {naturalSize && sourceUrl && (
                <img
                  src={sourceUrl}
                  alt="待裁剪肖像"
                  draggable={false}
                  referrerPolicy="no-referrer"
                  style={{
                    width: `${dispW}px`,
                    height: `${dispH}px`,
                    left: '50%',
                    top: '50%',
                    transform: `translate(calc(-50% + ${clampedOffset.x}px), calc(-50% + ${clampedOffset.y}px))`,
                  }}
                  className="absolute max-w-none max-h-none pointer-events-none select-none"
                />
              )}

              {/* Circular Crop Cutout Mask */}
              <div
                aria-hidden="true"
                style={{ width: CROP_DIAMETER, height: CROP_DIAMETER }}
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/90 shadow-[0_0_0_9999px_rgba(15,23,42,0.58)] pointer-events-none"
              >
                {isDragging && (
                  <>
                    <div className="absolute inset-x-0 top-1/2 h-px bg-white/35" />
                    <div className="absolute inset-y-0 left-1/2 w-px bg-white/35" />
                  </>
                )}
              </div>

              {isLoadingImage && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-white text-[13px] font-medium">
                  正在载入图片...
                </div>
              )}
            </div>

            {/* Drag / Zoom Guidance + Slider Controls */}
            <div className="w-full max-w-[360px] space-y-2.5">
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  aria-label="缩小"
                  title="缩小"
                  disabled={!naturalSize || zoom <= MIN_ZOOM}
                  onClick={() => handleZoomChange(zoom - 0.15)}
                  className="w-8 h-8 rounded-md flex items-center justify-center text-muted-foreground hover:bg-[var(--surface-hover)] hover:text-primary disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer shrink-0"
                >
                  <ZoomOut size={16} aria-hidden="true" />
                </button>

                <input
                  type="range"
                  aria-label="肖像缩放比例"
                  min={MIN_ZOOM}
                  max={MAX_ZOOM}
                  step={0.02}
                  value={zoom}
                  disabled={!naturalSize}
                  onChange={(e) =>
                    handleZoomChange(parseFloat(e.target.value))
                  }
                  className="flex-1 h-1.5 accent-primary cursor-pointer"
                />

                <button
                  type="button"
                  aria-label="放大"
                  title="放大"
                  disabled={!naturalSize || zoom >= MAX_ZOOM}
                  onClick={() => handleZoomChange(zoom + 0.15)}
                  className="w-8 h-8 rounded-md flex items-center justify-center text-muted-foreground hover:bg-[var(--surface-hover)] hover:text-primary disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer shrink-0"
                >
                  <ZoomIn size={16} aria-hidden="true" />
                </button>

                <span className="w-12 text-right text-[12px] font-medium text-muted-foreground font-mono tabular-nums shrink-0">
                  {Math.round(zoom * 100)}%
                </span>
              </div>

              <div className="flex items-center justify-between text-[12px] text-muted-foreground">
                <span>在圆框内拖动照片调整位置，滚动或滑块缩放</span>
                <button
                  type="button"
                  disabled={!naturalSize}
                  onClick={() => {
                    setZoom(1);
                    setOffset({ x: 0, y: 0 });
                  }}
                  className="inline-flex items-center gap-1 text-primary hover:underline disabled:opacity-40 cursor-pointer shrink-0 whitespace-nowrap"
                >
                  <RotateCcw size={12} aria-hidden="true" />
                  <span>重置</span>
                </button>
              </div>

              {cropError && (
                <div
                  role="alert"
                  className="rounded-md bg-destructive/10 border border-destructive/25 px-3 py-2 text-[12px] text-destructive"
                >
                  {cropError}
                </div>
              )}
            </div>
          </ModalBody>

          <ModalFooter className="justify-between">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              className="gap-1.5 text-muted-foreground hover:text-foreground"
            >
              <Upload size={14} aria-hidden="true" />
              <span>更换照片</span>
            </Button>

            <div className="flex items-center gap-2.5">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setView('overview');
                  setCropError(null);
                }}
              >
                取消
              </Button>
              <Button
                type="button"
                disabled={!naturalSize || isLoadingImage}
                onClick={handleSaveCroppedPortrait}
              >
                保存肖像
              </Button>
            </div>
          </ModalFooter>
        </>
      )}
    </ModalShell>
  );
};

import React, { useEffect, useMemo, useState } from 'react';
import { MapPin, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalShell,
} from '@/components/ui/modal';
import { NativeSelect as Select } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import {
  MAX_PLACE_TEXT_LENGTH,
  cloneGenealogyPlace,
  createEmptyStructuredPlace,
  finalizeGenealogyPlace,
  formatGenealogyPlace,
  getAllPlaceCountries,
  isPlaceholderCityName,
} from '../place-core';
import type { GenealogyPlace } from '../place.types';

interface PlaceInputDialogProps {
  isOpen: boolean;
  title: string;
  value: GenealogyPlace | null;
  onClose: () => void;
  onConfirm: (next: GenealogyPlace | null) => void;
}

function hydrateDialogDraft(value: GenealogyPlace | null): GenealogyPlace {
  if (!value) return createEmptyStructuredPlace();
  if (value.kind === 'phrase') {
    return {
      ...createEmptyStructuredPlace(),
      originalText: value.originalText ?? '',
    };
  }
  return {
    ...createEmptyStructuredPlace(),
    ...cloneGenealogyPlace(value),
    kind: 'structured',
    countryCode: value.countryCode || 'CN',
    country: value.country || '中国',
    provinceCode: value.provinceCode || undefined,
    province: value.province || '',
    cityCode: value.cityCode || undefined,
    city: value.city || '',
    districtCode: value.districtCode || undefined,
    district: value.district || '',
    originalText: value.originalText ?? '',
  };
}

export const PlaceInputDialog: React.FC<PlaceInputDialogProps> = ({
  isOpen,
  title,
  value,
  onClose,
  onConfirm,
}) => {
  const countries = useMemo(() => getAllPlaceCountries(), []);

  const [draft, setDraft] = useState<GenealogyPlace>(() =>
    hydrateDialogDraft(value)
  );

  useEffect(() => {
    if (!isOpen) return;
    setDraft(hydrateDialogDraft(value));
  }, [isOpen, value]);

  const activeCountry = useMemo(
    () =>
      countries.find(
        (c) =>
          (draft.countryCode && c.code === draft.countryCode) ||
          c.name === (draft.country || '中国')
      ) || countries[0],
    [countries, draft.countryCode, draft.country]
  );

  const provinces = useMemo(() => activeCountry?.provinces ?? [], [activeCountry]);

  const activeProvince = useMemo(
    () =>
      provinces.find(
        (p) =>
          (draft.provinceCode && p.code === draft.provinceCode) ||
          p.name === draft.province
      ) || null,
    [provinces, draft.provinceCode, draft.province]
  );

  const cities = useMemo(() => activeProvince?.cities ?? [], [activeProvince]);

  const hasOnlyPlaceholderCities = useMemo(
    () =>
      cities.length > 0 &&
      cities.every(
        (c) => c.isInternalHolder || isPlaceholderCityName(c.name)
      ),
    [cities]
  );

  const selectableCities = useMemo(
    () =>
      cities.filter(
        (c) => !c.isInternalHolder && !isPlaceholderCityName(c.name)
      ),
    [cities]
  );

  const activeCity = useMemo(
    () =>
      selectableCities.find(
        (c) =>
          (draft.cityCode && c.code === draft.cityCode) ||
          c.name === draft.city
      ) || null,
    [selectableCities, draft.cityCode, draft.city]
  );

  const districts = useMemo(() => {
    if (activeCity) return activeCity.districts;
    if (hasOnlyPlaceholderCities) {
      return cities.flatMap((c) => c.districts);
    }
    return [];
  }, [activeCity, hasOnlyPlaceholderCities, cities]);

  const isOverseas = Boolean(activeCountry && activeCountry.code !== 'CN');
  const hasStructuredSelection = Boolean(
    isOverseas ||
      draft.province?.trim() ||
      draft.city?.trim() ||
      draft.district?.trim()
  );

  const finalizedPreview = finalizeGenealogyPlace(draft);
  const previewText = formatGenealogyPlace(finalizedPreview);
  const canConfirm = Boolean(finalizedPreview);

  const handleCountryChange = (countryCode: string) => {
    const matched = countries.find((c) => c.code === countryCode);
    setDraft((prev) => ({
      ...prev,
      kind: 'structured',
      countryCode: matched?.code || countryCode,
      country: matched?.name || '',
      provinceCode: undefined,
      province: '',
      cityCode: undefined,
      city: '',
      districtCode: undefined,
      district: '',
    }));
  };

  const handleProvinceChange = (provinceName: string) => {
    const matched = provinces.find((p) => p.name === provinceName);
    setDraft((prev) => ({
      ...prev,
      kind: 'structured',
      countryCode: activeCountry?.code || 'CN',
      country: activeCountry?.name || '中国',
      provinceCode: matched?.code,
      province: provinceName,
      cityCode: undefined,
      city: '',
      districtCode: undefined,
      district: '',
    }));
  };

  const handleCityChange = (cityName: string) => {
    const matched = selectableCities.find((c) => c.name === cityName);
    setDraft((prev) => ({
      ...prev,
      kind: 'structured',
      cityCode: matched?.code,
      city: cityName,
      districtCode: undefined,
      district: '',
    }));
  };

  const handleDistrictChange = (districtName: string) => {
    const matched = districts.find((d) => d.name === districtName);
    setDraft((prev) => ({
      ...prev,
      kind: 'structured',
      districtCode: matched?.code,
      district: districtName,
    }));
  };

  const handleClearRegion = () => {
    setDraft((prev) => ({
      ...prev,
      kind: 'structured',
      countryCode: 'CN',
      country: '中国',
      provinceCode: undefined,
      province: '',
      cityCode: undefined,
      city: '',
      districtCode: undefined,
      district: '',
    }));
  };

  return (
    <ModalShell
      open={isOpen}
      onClose={onClose}
      size="lg"
      zIndexClass="z-[110]"
      ariaLabelledBy="place-dialog-title"
    >
      <ModalHeader
        titleId="place-dialog-title"
        title={title}
        icon={<MapPin size={18} className="text-primary" aria-hidden="true" />}
        onClose={onClose}
      />

      <ModalBody className="space-y-4">
        {/* 1. 标准化区划 */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-semibold text-foreground">
              标准化区划
            </span>
            {hasStructuredSelection && (
              <button
                type="button"
                onClick={handleClearRegion}
                className="text-[12px] text-muted-foreground hover:text-primary transition-colors cursor-pointer"
              >
                清空区划
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label
                htmlFor="place-country"
                className="block text-[12px] font-medium text-muted-foreground mb-1.5"
              >
                国家 / 地区
              </label>
              <Select
                id="place-country"
                value={activeCountry?.code || 'CN'}
                onChange={(e) => handleCountryChange(e.target.value)}
              >
                {countries.map((c) => (
                  <option
                    key={c.code}
                    value={c.code}
                    className="bg-card text-foreground"
                  >
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>

            {provinces.length > 0 && (
              <div>
                <label
                  htmlFor="place-province"
                  className="block text-[12px] font-medium text-muted-foreground mb-1.5"
                >
                  省 / 直辖市 / 州
                </label>
                <Select
                  id="place-province"
                  value={draft.province || ''}
                  isPlaceholder={!draft.province}
                  onChange={(e) => handleProvinceChange(e.target.value)}
                >
                  <option value="" className="bg-card text-placeholder">
                    不详 / 留空
                  </option>
                  {provinces.map((p) => (
                    <option
                      key={p.code}
                      value={p.name}
                      className="bg-card text-foreground"
                    >
                      {p.name}
                    </option>
                  ))}
                </Select>
              </div>
            )}

            {selectableCities.length > 0 && (
              <div>
                <label
                  htmlFor="place-city"
                  className="block text-[12px] font-medium text-muted-foreground mb-1.5"
                >
                  地级市 / 郡 / 城
                </label>
                <Select
                  id="place-city"
                  value={draft.city || ''}
                  isPlaceholder={!draft.city}
                  onChange={(e) => handleCityChange(e.target.value)}
                >
                  <option value="" className="bg-card text-placeholder">
                    不详 / 留空
                  </option>
                  {selectableCities.map((c) => (
                    <option
                      key={c.code}
                      value={c.name}
                      className="bg-card text-foreground"
                    >
                      {c.name}
                    </option>
                  ))}
                </Select>
              </div>
            )}

            {districts.length > 0 && (
              <div>
                <label
                  htmlFor="place-district"
                  className="block text-[12px] font-medium text-muted-foreground mb-1.5"
                >
                  区 / 县 / 旗
                </label>
                <Select
                  id="place-district"
                  value={draft.district || ''}
                  isPlaceholder={!draft.district}
                  onChange={(e) => handleDistrictChange(e.target.value)}
                >
                  <option value="" className="bg-card text-placeholder">
                    不详 / 留空
                  </option>
                  {districts.map((d) => (
                    <option
                      key={d.code}
                      value={d.name}
                      className="bg-card text-foreground"
                    >
                      {d.name}
                    </option>
                  ))}
                </Select>
              </div>
            )}
          </div>
        </div>

        {/* 2. 原始记载 */}
        <div className="space-y-1.5 pt-3 border-t border-border/60">
          <div className="flex items-center justify-between">
            <label
              htmlFor="place-original-text"
              className="text-[13px] font-semibold text-foreground"
            >
              原始记载
            </label>
            <span className="text-[12px] text-muted-foreground tabular-nums">
              {(draft.originalText || '').length}/{MAX_PLACE_TEXT_LENGTH}
            </span>
          </div>
          <Textarea
            id="place-original-text"
            rows={3}
            maxLength={MAX_PLACE_TEXT_LENGTH}
            value={draft.originalText || ''}
            onChange={(e) =>
              setDraft((prev) => ({
                ...prev,
                originalText: e.target.value,
              }))
            }
            placeholder="例如：庐陵郡太和县南溪里、桐梓县狮子山金钗穴坐北朝南等"
            className="min-h-[76px] p-3 resize-none leading-relaxed"
          />
        </div>

        {/* Live Preview */}
        <div className="rounded-lg border border-border bg-[var(--surface-subtle)] p-3.5 space-y-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[12px] font-medium text-muted-foreground">
              地点预览
            </span>
            <span className="text-[12px] text-muted-foreground">
              {finalizedPreview?.kind === 'phrase'
                ? '原始记载'
                : finalizedPreview?.kind === 'structured'
                ? '标准化区划'
                : '未填写'}
            </span>
          </div>
          <div className="text-[14px] font-semibold text-foreground">
            {previewText || '尚未填写有效地点'}
          </div>
          {finalizedPreview?.kind === 'structured' &&
            finalizedPreview.originalText && (
              <div className="text-[12px] text-muted-foreground">
                原始记载：{finalizedPreview.originalText}
              </div>
            )}
        </div>
      </ModalBody>

      <ModalFooter className="justify-between bg-card">
        <div>
          {(value || previewText) && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onConfirm(null)}
              className="text-muted-foreground hover:text-destructive gap-1.5"
            >
              <Trash2 size={13} />
              <span>清空地点</span>
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2.5">
          <Button type="button" variant="ghost" onClick={onClose}>
            取消
          </Button>
          <Button
            type="button"
            disabled={!canConfirm}
            onClick={() => onConfirm(finalizedPreview)}
          >
            确定
          </Button>
        </div>
      </ModalFooter>
    </ModalShell>
  );
};

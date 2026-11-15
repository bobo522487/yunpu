import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, ChevronRight, MapPin, Search } from 'lucide-react';
import {
  REGION_TREE,
  RegionNode,
  formatRegionParts,
  parseRegionParts,
} from '../data/regions';

interface RegionCascaderProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  hasError?: boolean;
  id?: string;
}

export const RegionCascader: React.FC<RegionCascaderProps> = ({
  value,
  onChange,
  placeholder = '请选择项目所属地区',
  hasError = false,
  id,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(
    null
  );

  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const parts = useMemo(() => parseRegionParts(value), [value]);
  const [selectedCountryName, setSelectedCountryName] = useState<string>(
    parts[0] || '中国'
  );
  const [selectedProvinceName, setSelectedProvinceName] = useState<string>(
    parts[1] || '北京'
  );
  const [selectedCityName, setSelectedCityName] = useState<string>(
    parts[2] || '东城'
  );

  useEffect(() => {
    if (!isOpen) return;
    const p = parseRegionParts(value);
    setSelectedCountryName(p[0] || '中国');
    setSelectedProvinceName(p[1] || '');
    setSelectedCityName(p[2] || '');
    setSearch('');
  }, [isOpen, value]);

  const updatePosition = () => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const popWidth = Math.min(460, window.innerWidth - 16);
    const popHeight = 296;
    const openUpward =
      window.innerHeight - rect.bottom < popHeight + 12 && rect.top > popHeight;
    const top = openUpward
      ? Math.max(8, rect.top - popHeight - 6)
      : rect.bottom + 6;
    const left = Math.max(
      8,
      Math.min(rect.left, window.innerWidth - popWidth - 8)
    );
    setPos({ top, left, width: popWidth });
  };

  useEffect(() => {
    if (!isOpen) return;
    updatePosition();

    const handleOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        triggerRef.current &&
        !triggerRef.current.contains(target) &&
        popoverRef.current &&
        !popoverRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };

    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };

    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleEsc);
    window.addEventListener('resize', updatePosition);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleEsc);
      window.removeEventListener('resize', updatePosition);
    };
  }, [isOpen]);

  const filteredCountries = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return REGION_TREE;
    return REGION_TREE.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.children?.some(
          (p) =>
            p.name.toLowerCase().includes(q) ||
            p.children?.some((city) => city.name.toLowerCase().includes(q))
        )
    );
  }, [search]);

  const activeCountry = useMemo<RegionNode | undefined>(() => {
    return (
      filteredCountries.find((c) => c.name === selectedCountryName) ||
      REGION_TREE.find((c) => c.name === selectedCountryName) ||
      filteredCountries[0]
    );
  }, [filteredCountries, selectedCountryName]);

  const provinces = useMemo(() => {
    const list = activeCountry?.children || [];
    const q = search.trim().toLowerCase();
    if (!q || activeCountry?.name.toLowerCase().includes(q)) return list;
    return list.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.children?.some((c) => c.name.toLowerCase().includes(q))
    );
  }, [activeCountry, search]);

  const activeProvince = useMemo<RegionNode | undefined>(() => {
    return (
      provinces.find((p) => p.name === selectedProvinceName) || provinces[0]
    );
  }, [provinces, selectedProvinceName]);

  const cities = useMemo(() => {
    const list = activeProvince?.children || [];
    const q = search.trim().toLowerCase();
    if (
      !q ||
      activeCountry?.name.toLowerCase().includes(q) ||
      activeProvince?.name.toLowerCase().includes(q)
    ) {
      return list;
    }
    return list.filter((c) => c.name.toLowerCase().includes(q));
  }, [activeCountry, activeProvince, search]);

  const handleSelectCountry = (country: RegionNode) => {
    setSelectedCountryName(country.name);
    const firstProv = country.children?.[0];
    if (!firstProv) {
      setSelectedProvinceName('');
      setSelectedCityName('');
      onChange(country.name);
      setIsOpen(false);
      return;
    }
    setSelectedProvinceName(firstProv.name);
    const firstCity = firstProv.children?.[0];
    if (!firstCity) {
      setSelectedCityName('');
      onChange(formatRegionParts([country.name, firstProv.name]));
      return;
    }
    setSelectedCityName(firstCity.name);
    onChange(formatRegionParts([country.name, firstProv.name, firstCity.name]));
  };

  const handleSelectProvince = (prov: RegionNode) => {
    if (!activeCountry) return;
    setSelectedProvinceName(prov.name);
    const firstCity = prov.children?.[0];
    if (!firstCity) {
      setSelectedCityName('');
      onChange(formatRegionParts([activeCountry.name, prov.name]));
      setIsOpen(false);
      return;
    }
    setSelectedCityName(firstCity.name);
    onChange(formatRegionParts([activeCountry.name, prov.name, firstCity.name]));
  };

  const handleSelectCity = (city: RegionNode) => {
    if (!activeCountry || !activeProvince) return;
    setSelectedCityName(city.name);
    onChange(
      formatRegionParts([activeCountry.name, activeProvince.name, city.name])
    );
    setIsOpen(false);
  };

  const displaySegments = value ? parseRegionParts(value) : [];

  return (
    <>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        className={`flex h-9 w-full items-center justify-between gap-2 rounded-md border bg-background px-3 py-1.5 text-sm shadow-[var(--shadow-control)] transition-colors duration-150 text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 ${
          hasError
            ? 'border-destructive focus-visible:border-destructive'
            : isOpen
            ? 'border-primary ring-2 ring-primary/20'
            : 'border-input hover:border-[hsl(var(--border-strong))]'
        }`}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <MapPin size={14} className="text-muted-foreground shrink-0" />
          {displaySegments.length > 0 ? (
            <span className="flex items-center gap-1 text-foreground truncate">
              {displaySegments.map((seg, idx) => (
                <React.Fragment key={`${seg}-${idx}`}>
                  {idx > 0 && (
                    <span className="text-muted-foreground/60 text-xs">/</span>
                  )}
                  <span className="truncate">{seg}</span>
                </React.Fragment>
              ))}
            </span>
          ) : (
            <span className="text-muted-foreground truncate">{placeholder}</span>
          )}
        </div>
        <ChevronDown
          size={14}
          className={`text-muted-foreground shrink-0 transition-transform duration-150 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {isOpen &&
        pos &&
        createPortal(
          <div
            ref={popoverRef}
            style={{ top: pos.top, left: pos.left, width: pos.width }}
            className="fixed z-[120] rounded-xl border border-border bg-popover text-popover-foreground shadow-[var(--shadow-popover)] overflow-hidden animate-in fade-in zoom-in-95 duration-100"
          >
            {/* Quick Filter Header */}
            <div className="p-2 border-b border-border bg-[hsl(var(--surface-subtle))]">
              <div className="relative">
                <Search
                  size={13}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
                />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="快速搜索国家、省份或城市..."
                  className="w-full h-8 pl-8 pr-2.5 text-xs rounded-md border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/25"
                  autoFocus
                />
              </div>
            </div>

            {/* 3-Column Cascading Lists */}
            <div className="grid grid-cols-3 divide-x divide-border h-[232px]">
              {/* Column 1: Country */}
              <div className="overflow-y-auto p-1 space-y-0.5">
                {filteredCountries.length === 0 ? (
                  <div className="px-2 py-6 text-center text-xs text-muted-foreground">
                    无匹配国家/地区
                  </div>
                ) : (
                  filteredCountries.map((c) => {
                    const active = activeCountry?.code === c.code;
                    const hasKids = Boolean(c.children && c.children.length > 0);
                    return (
                      <button
                        key={c.code}
                        type="button"
                        onClick={() => handleSelectCountry(c)}
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs transition-colors cursor-pointer ${
                          active
                            ? 'bg-primary/10 text-primary font-semibold'
                            : 'text-foreground hover:bg-[hsl(var(--surface-hover))]'
                        }`}
                      >
                        <span className="truncate">{c.name}</span>
                        {hasKids && (
                          <ChevronRight
                            size={12}
                            className={`shrink-0 ${
                              active ? 'text-primary' : 'text-muted-foreground/60'
                            }`}
                          />
                        )}
                      </button>
                    );
                  })
                )}
              </div>

              {/* Column 2: Province / State */}
              <div className="overflow-y-auto p-1 space-y-0.5">
                {provinces.length === 0 ? (
                  <div className="px-2 py-6 text-center text-xs text-muted-foreground">
                    暂无下级省州
                  </div>
                ) : (
                  provinces.map((p) => {
                    const active = activeProvince?.code === p.code;
                    const hasKids = Boolean(p.children && p.children.length > 0);
                    return (
                      <button
                        key={p.code}
                        type="button"
                        onClick={() => handleSelectProvince(p)}
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs transition-colors cursor-pointer ${
                          active
                            ? 'bg-primary/10 text-primary font-semibold'
                            : 'text-foreground hover:bg-[hsl(var(--surface-hover))]'
                        }`}
                      >
                        <span className="truncate">{p.name}</span>
                        {hasKids && (
                          <ChevronRight
                            size={12}
                            className={`shrink-0 ${
                              active ? 'text-primary' : 'text-muted-foreground/60'
                            }`}
                          />
                        )}
                      </button>
                    );
                  })
                )}
              </div>

              {/* Column 3: City / District */}
              <div className="overflow-y-auto p-1 space-y-0.5">
                {cities.length === 0 ? (
                  <div className="px-2 py-6 text-center text-xs text-muted-foreground">
                    暂无下级区县
                  </div>
                ) : (
                  cities.map((city) => {
                    const active = selectedCityName === city.name;
                    return (
                      <button
                        key={city.code}
                        type="button"
                        onClick={() => handleSelectCity(city)}
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs transition-colors cursor-pointer ${
                          active
                            ? 'bg-primary text-primary-foreground font-semibold'
                            : 'text-foreground hover:bg-[hsl(var(--surface-hover))]'
                        }`}
                      >
                        <span className="truncate">{city.name}</span>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
};

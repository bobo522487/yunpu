import { regionData } from 'element-china-area-data';
import type { PersonRecord } from '../lineage/types';
import type {
  ClanPlaceStat,
  GenealogyPlace,
  PlaceSuggestionItem,
} from './place.types';

export const MAX_PLACE_TEXT_LENGTH = 150;

export interface PlaceRegionDistrict {
  code: string;
  name: string;
}

export interface PlaceRegionCity {
  code: string;
  name: string;
  isInternalHolder?: boolean;
  districts: PlaceRegionDistrict[];
}

export interface PlaceRegionProvince {
  code: string;
  name: string;
  cities: PlaceRegionCity[];
}

export interface PlaceRegionCountry {
  code: string;
  name: string;
  provinces: PlaceRegionProvince[];
}

const INTERNAL_CITY_HOLDERS = new Set([
  '市辖区',
  '省直辖县级行政区划',
  '自治区直辖县级行政区划',
  '县',
]);

export function isPlaceholderCityName(name?: string | null): boolean {
  if (!name) return false;
  return INTERNAL_CITY_HOLDERS.has(name.trim());
}

/**
 * Normalize element-china-area-data codes (2-digit province / 4-digit prefecture /
 * 6-digit county / 9-digit street) to standard GB/T 2260 6-digit codes where < 6 digits.
 */
function normalizeGbCode(code: string): string {
  const clean = code.trim();
  return clean.length < 6 ? clean.padEnd(6, '0') : clean;
}

/**
 * Taiwan, Hong Kong SAR, and Macau SAR provinces:
 * - Province codes follow GB/T 2260 ('710000', '810000', '820000')
 * - Subdivisions follow ISO 3166-2 / official municipal codes
 */
const SPECIAL_CHINA_PROVINCES: PlaceRegionProvince[] = [
  {
    code: '710000',
    name: '台湾省',
    cities: [
      { code: 'TW-TPE', name: '台北市', districts: [] },
      { code: 'TW-NWT', name: '新北市', districts: [] },
      { code: 'TW-TAO', name: '桃园市', districts: [] },
      { code: 'TW-TXG', name: '台中市', districts: [] },
      { code: 'TW-TNN', name: '台南市', districts: [] },
      { code: 'TW-KHH', name: '高雄市', districts: [] },
      { code: 'TW-KIN', name: '金门县', districts: [] },
    ],
  },
  {
    code: '810000',
    name: '香港特别行政区',
    cities: [
      {
        code: '810100',
        name: '市辖区',
        isInternalHolder: true,
        districts: [
          { code: 'HK-HCW', name: '中西区' },
          { code: 'HK-HWC', name: '湾仔区' },
          { code: 'HK-HEA', name: '东区' },
          { code: 'HK-HSO', name: '南区' },
          { code: 'HK-KYT', name: '油尖旺区' },
          { code: 'HK-KSS', name: '深水埗区' },
          { code: 'HK-KKC', name: '九龙城区' },
          { code: 'HK-KWT', name: '黄大仙区' },
          { code: 'HK-KKT', name: '观塘区' },
          { code: 'HK-NST', name: '沙田区' },
          { code: 'HK-NYL', name: '元朗区' },
        ],
      },
    ],
  },
  {
    code: '820000',
    name: '澳门特别行政区',
    cities: [
      {
        code: '820100',
        name: '市辖区',
        isInternalHolder: true,
        districts: [
          { code: 'MO-NSP', name: '花地玛堂区' },
          { code: 'MO-SA', name: '圣安多尼堂区' },
          { code: 'MO-SL', name: '大堂区' },
          { code: 'MO-SLZ', name: '望德堂区' },
          { code: 'MO-SLO', name: '风顺堂区' },
          { code: 'MO-T', name: '嘉模堂区' },
          { code: 'MO-C', name: '圣方济各堂区' },
        ],
      },
    ],
  },
];

/**
 * Overseas countries & regions using ISO 3166-1 alpha-2 country codes,
 * ISO 3166-2 subdivision codes, and UN/LOCODE city codes.
 */
const OVERSEAS_COUNTRIES: PlaceRegionCountry[] = [
  {
    code: 'US',
    name: '美国',
    provinces: [
      {
        code: 'US-CA',
        name: '加利福尼亚州',
        cities: [
          { code: 'US-SFO', name: '旧金山', districts: [] },
          { code: 'US-LAX', name: '洛杉矶', districts: [] },
          { code: 'US-SJC', name: '圣何塞', districts: [] },
        ],
      },
      {
        code: 'US-NY',
        name: '纽约州',
        cities: [{ code: 'US-NYC', name: '纽约市', districts: [] }],
      },
      {
        code: 'US-WA',
        name: '华盛顿州',
        cities: [{ code: 'US-SEA', name: '西雅图', districts: [] }],
      },
      {
        code: 'US-MA',
        name: '马萨诸塞州',
        cities: [{ code: 'US-BOS', name: '波士顿', districts: [] }],
      },
    ],
  },
  {
    code: 'CA',
    name: '加拿大',
    provinces: [
      {
        code: 'CA-ON',
        name: '安大略省',
        cities: [
          { code: 'CA-TOR', name: '多伦多', districts: [] },
          { code: 'CA-OTT', name: '渥太华', districts: [] },
        ],
      },
      {
        code: 'CA-BC',
        name: '不列颠哥伦比亚省',
        cities: [{ code: 'CA-VAN', name: '温哥华', districts: [] }],
      },
    ],
  },
  {
    code: 'JP',
    name: '日本',
    provinces: [
      {
        code: 'JP-13',
        name: '东京都',
        cities: [{ code: 'JP-TYO', name: '东京', districts: [] }],
      },
      {
        code: 'JP-27',
        name: '大阪府',
        cities: [{ code: 'JP-OSA', name: '大阪', districts: [] }],
      },
      {
        code: 'JP-26',
        name: '京都府',
        cities: [{ code: 'JP-UKY', name: '京都', districts: [] }],
      },
    ],
  },
  {
    code: 'SG',
    name: '新加坡',
    provinces: [
      {
        code: 'SG-01',
        name: '新加坡',
        cities: [{ code: 'SG-SIN', name: '新加坡市', districts: [] }],
      },
    ],
  },
  {
    code: 'MY',
    name: '马来西亚',
    provinces: [
      {
        code: 'MY-14',
        name: '吉隆坡',
        cities: [{ code: 'MY-KUL', name: '吉隆坡市', districts: [] }],
      },
      {
        code: 'MY-07',
        name: '槟城州',
        cities: [{ code: 'MY-PEN', name: '乔治市', districts: [] }],
      },
      {
        code: 'MY-01',
        name: '柔佛州',
        cities: [{ code: 'MY-JHB', name: '新山', districts: [] }],
      },
    ],
  },
  {
    code: 'AU',
    name: '澳大利亚',
    provinces: [
      {
        code: 'AU-NSW',
        name: '新南威尔士州',
        cities: [{ code: 'AU-SYD', name: '悉尼', districts: [] }],
      },
      {
        code: 'AU-VIC',
        name: '维多利亚州',
        cities: [{ code: 'AU-MEL', name: '墨尔本', districts: [] }],
      },
    ],
  },
  {
    code: 'GB',
    name: '英国',
    provinces: [
      {
        code: 'GB-ENG',
        name: '英格兰',
        cities: [
          { code: 'GB-LON', name: '伦敦', districts: [] },
          { code: 'GB-MAN', name: '曼彻斯特', districts: [] },
        ],
      },
    ],
  },
  {
    code: 'FR',
    name: '法国',
    provinces: [
      {
        code: 'FR-IDF',
        name: '法兰西岛',
        cities: [{ code: 'FR-PAR', name: '巴黎', districts: [] }],
      },
    ],
  },
  {
    code: 'DE',
    name: '德国',
    provinces: [
      {
        code: 'DE-BE',
        name: '柏林州',
        cities: [{ code: 'DE-BER', name: '柏林', districts: [] }],
      },
      {
        code: 'DE-BY',
        name: '巴伐利亚州',
        cities: [{ code: 'DE-MUC', name: '慕尼黑', districts: [] }],
      },
    ],
  },
  {
    code: 'KR',
    name: '韩国',
    provinces: [
      {
        code: 'KR-11',
        name: '首尔特别市',
        cities: [{ code: 'KR-SEL', name: '首尔', districts: [] }],
      },
    ],
  },
];

let cachedCountries: PlaceRegionCountry[] | null = null;

export function getAllPlaceCountries(): PlaceRegionCountry[] {
  if (cachedCountries) return cachedCountries;

  const mainlandProvinces: PlaceRegionProvince[] = regionData.map((prov) => ({
    code: normalizeGbCode(prov.value),
    name: prov.label,
    cities: (prov.children ?? []).map((city) => ({
      code: normalizeGbCode(city.value),
      name: city.label,
      isInternalHolder: INTERNAL_CITY_HOLDERS.has(city.label),
      districts: (city.children ?? []).map((dist) => ({
        code: normalizeGbCode(dist.value),
        name: dist.label,
      })),
    })),
  }));

  const china: PlaceRegionCountry = {
    code: 'CN',
    name: '中国',
    provinces: [...mainlandProvinces, ...SPECIAL_CHINA_PROVINCES],
  };

  cachedCountries = [china, ...OVERSEAS_COUNTRIES];
  return cachedCountries;
}

export function getChinaProvinces(): PlaceRegionProvince[] {
  return getAllPlaceCountries()[0]?.provinces ?? [];
}

const TRADITIONAL_TO_SIMPLIFIED_MAP: Record<string, string> = {
  國: '国',
  貴: '贵',
  陽: '阳',
  陰: '阴',
  觀: '观',
  區: '区',
  縣: '县',
  廣: '广',
  東: '东',
  漢: '汉',
  蘇: '苏',
  陝: '陕',
  蘭: '兰',
  瀋: '沈',
  龍: '龙',
  慶: '庆',
  寧: '宁',
  灣: '湾',
  門: '门',
  臺: '台',
  華: '华',
  豐: '丰',
  興: '兴',
  順: '顺',
  義: '义',
  樂: '乐',
  長: '长',
  馬: '马',
  鳳: '凤',
  嶺: '岭',
  崗: '岗',
  鎮: '镇',
  鄉: '乡',
  萬: '万',
  雲: '云',
  溫: '温',
  寶: '宝',
  開: '开',
  關: '关',
  廬: '庐',
  贛: '赣',
  閩: '闽',
  粵: '粤',
  魯: '鲁',
  晉: '晋',
  瓊: '琼',
  蒙: '蒙',
  滬: '沪',
  遼: '辽',
  齊: '齐',
  爾: '尔',
  濱: '滨',
  烏: '乌',
  澳: '澳',
  鄭: '郑',
  許: '许',
  荊: '荆',
  黃: '黄',
  嶽: '岳',
  懷: '怀',
  無: '无',
  錫: '锡',
  鹽: '盐',
  揚: '扬',
  蕪: '芜',
  銅: '铜',
  廈: '厦',
  撫: '抚',
  饒: '饶',
  青: '青',
  煙: '烟',
  濰: '潍',
  濟: '济',
  臨: '临',
  莊: '庄',
  運: '运',
  呂: '吕',
  內: '内',
  頭: '头',
  連: '连',
  營: '营',
  盤: '盘',
  雞: '鸡',
  鶴: '鹤',
  雙: '双',
  鴨: '鸭',
  達: '达',
  綿: '绵',
  瀘: '泸',
  資: '资',
  涼: '凉',
  壩: '坝',
  舊: '旧',
  磯: '矶',
  紐: '纽',
  約: '约',
  倫: '伦',
  亞: '亚',
  羅: '罗',
  來: '来',
  檳: '槟',
  法: '法',
  德: '德',
  韓: '韩',
  賓: '宾',
  畢: '毕',
  節: '节',
  麗: '丽',
  薩: '萨',
  銀: '银',
  張: '张',
  紹: '绍',
  鄧: '邓',
  鞏: '巩',
  鄒: '邹',
  榮: '荣',
  壽: '寿',
  膠: '胶',
  棗: '枣',
  瀏: '浏',
  欽: '钦',
  靈: '灵',
  蒼: '苍',
  紅: '红',
  則: '则',
  歸: '归',
  彥: '彦',
  衛: '卫',
  吳: '吴',
  諸: '诸',
  萊: '莱',
};

export function toSimplifiedPlaceText(raw: string): string {
  let out = '';
  for (const ch of raw) {
    out += TRADITIONAL_TO_SIMPLIFIED_MAP[ch] ?? ch;
  }
  return out;
}

export function normalizePlaceSearchText(raw: string): string {
  return toSimplifiedPlaceText(raw)
    .toLowerCase()
    .replace(/[，,、/·\s\-()（）]/g, '')
    .trim();
}

export function stripAdminSuffix(name: string): string {
  return name
    .replace(
      /(特别行政区|维吾尔自治区|壮族自治区|回族自治区|自治区|自治州|布依族苗族自治州|苗族侗族自治州|藏族羌族自治州|彝族自治州|土家族苗族自治州|林区|地区|省|市|县|区|州|府|盟|旗)$/g,
      ''
    )
    .trim();
}

export interface FlattenedRegionEntry {
  countryCode: string;
  country: string;
  provinceCode?: string;
  province?: string;
  cityCode?: string;
  city?: string;
  districtCode?: string;
  district?: string;
  level: 1 | 2 | 3 | 4;
  fullLabel: string;
  hierarchyMeta: string;
  leafName: string;
  leafShort: string;
  normalizedFull: string;
  normalizedLeaf: string;
  normalizedLeafShort: string;
  normalizedSegments: string[];
}

let cachedRegionIndex: FlattenedRegionEntry[] | null = null;

export function getFlattenedRegionIndex(): FlattenedRegionEntry[] {
  if (cachedRegionIndex) return cachedRegionIndex;
  const countries = getAllPlaceCountries();
  const entries: FlattenedRegionEntry[] = [];

  for (const country of countries) {
    const isChina = country.code === 'CN';
    const countryPrefix = isChina ? '' : country.name;
    const countryShort = stripAdminSuffix(country.name) || country.name;

    if (!isChina) {
      entries.push({
        countryCode: country.code,
        country: country.name,
        level: 1,
        fullLabel: country.name,
        hierarchyMeta: '国家/地区',
        leafName: country.name,
        leafShort: countryShort,
        normalizedFull: normalizePlaceSearchText(country.name),
        normalizedLeaf: normalizePlaceSearchText(country.name),
        normalizedLeafShort: normalizePlaceSearchText(countryShort),
        normalizedSegments: [normalizePlaceSearchText(country.name)],
      });
    }

    for (const prov of country.provinces) {
      const pFull = `${countryPrefix}${prov.name}`;
      const pShort = stripAdminSuffix(prov.name) || prov.name;
      entries.push({
        countryCode: country.code,
        country: country.name,
        provinceCode: prov.code,
        province: prov.name,
        level: 2,
        fullLabel: pFull,
        hierarchyMeta: isChina ? '省级' : country.name,
        leafName: prov.name,
        leafShort: pShort,
        normalizedFull: normalizePlaceSearchText(pFull),
        normalizedLeaf: normalizePlaceSearchText(prov.name),
        normalizedLeafShort: normalizePlaceSearchText(pShort),
        normalizedSegments: [
          ...(isChina ? [] : [normalizePlaceSearchText(country.name)]),
          normalizePlaceSearchText(prov.name),
          normalizePlaceSearchText(pShort),
        ],
      });

      for (const city of prov.cities) {
        const isHolder = Boolean(
          city.isInternalHolder || isPlaceholderCityName(city.name)
        );
        const storedCity = isHolder ? undefined : city.name;
        const storedCityCode = isHolder ? undefined : city.code;
        if (!isHolder) {
          const cityFull = `${countryPrefix}${prov.name}${city.name}`;
          const cityShort = stripAdminSuffix(city.name) || city.name;
          entries.push({
            countryCode: country.code,
            country: country.name,
            provinceCode: prov.code,
            province: prov.name,
            cityCode: storedCityCode,
            city: storedCity,
            level: 3,
            fullLabel: cityFull,
            hierarchyMeta: isChina
              ? prov.name
              : `${country.name} · ${prov.name}`,
            leafName: city.name,
            leafShort: cityShort,
            normalizedFull: normalizePlaceSearchText(cityFull),
            normalizedLeaf: normalizePlaceSearchText(city.name),
            normalizedLeafShort: normalizePlaceSearchText(cityShort),
            normalizedSegments: [
              ...(isChina ? [] : [normalizePlaceSearchText(country.name)]),
              normalizePlaceSearchText(prov.name),
              normalizePlaceSearchText(pShort),
              normalizePlaceSearchText(city.name),
              normalizePlaceSearchText(cityShort),
            ],
          });
        }

        for (const dist of city.districts) {
          const distFull = storedCity
            ? `${countryPrefix}${prov.name}${storedCity}${dist.name}`
            : `${countryPrefix}${prov.name}${dist.name}`;
          const distShort = stripAdminSuffix(dist.name) || dist.name;
          entries.push({
            countryCode: country.code,
            country: country.name,
            provinceCode: prov.code,
            province: prov.name,
            cityCode: storedCityCode,
            city: storedCity,
            districtCode: dist.code,
            district: dist.name,
            level: 4,
            fullLabel: distFull,
            hierarchyMeta: storedCity
              ? isChina
                ? `${prov.name} · ${storedCity}`
                : `${country.name} · ${prov.name} · ${storedCity}`
              : isChina
                ? prov.name
                : `${country.name} · ${prov.name}`,
            leafName: dist.name,
            leafShort: distShort,
            normalizedFull: normalizePlaceSearchText(distFull),
            normalizedLeaf: normalizePlaceSearchText(dist.name),
            normalizedLeafShort: normalizePlaceSearchText(distShort),
            normalizedSegments: [
              ...(isChina ? [] : [normalizePlaceSearchText(country.name)]),
              normalizePlaceSearchText(prov.name),
              normalizePlaceSearchText(pShort),
              ...(storedCity
                ? [
                    normalizePlaceSearchText(storedCity),
                    normalizePlaceSearchText(
                      stripAdminSuffix(storedCity) || storedCity
                    ),
                  ]
                : []),
              normalizePlaceSearchText(dist.name),
              normalizePlaceSearchText(distShort),
            ],
          });
        }
      }
    }
  }

  cachedRegionIndex = entries;
  return entries;
}

function getPlaceAdminSegments(
  place: GenealogyPlace | null | undefined
): string[] {
  if (!place || place.kind === 'phrase') return [];
  const cityClean = isPlaceholderCityName(place.city)
    ? ''
    : place.city?.trim() || '';
  const countryClean =
    place.country?.trim() &&
    place.countryCode !== 'CN' &&
    place.country.trim() !== '中国'
      ? place.country.trim()
      : '';
  return [
    countryClean,
    place.province?.trim() || '',
    cityClean,
    place.district?.trim() || '',
  ].filter(Boolean);
}

export function formatGenealogyPlace(
  place: GenealogyPlace | null | undefined
): string {
  if (!place) return '';
  if (place.kind === 'phrase') {
    return place.originalText?.trim() || '';
  }

  const base = getPlaceAdminSegments(place).join('');
  return base || place.originalText?.trim() || '';
}

/**
 * Format structured administrative levels with an explicit delimiter (e.g. ' / ' or ' ').
 * Useful for breadcrumbs, project cards, and prose seeds.
 */
export function formatPlacePath(
  place: GenealogyPlace | null | undefined,
  separator: string = ' / '
): string {
  if (!place) return '';
  if (place.kind === 'phrase') {
    return place.originalText?.trim() || '';
  }
  const segments = getPlaceAdminSegments(place);
  return segments.length > 0
    ? segments.join(separator)
    : place.originalText?.trim() || '';
}

export function cloneGenealogyPlace(place: GenealogyPlace): GenealogyPlace {
  return { ...place };
}

export function createEmptyStructuredPlace(): GenealogyPlace {
  return {
    schemaVersion: 1,
    kind: 'structured',
    countryCode: 'CN',
    country: '中国',
    provinceCode: undefined,
    province: '',
    cityCode: undefined,
    city: '',
    districtCode: undefined,
    district: '',
    originalText: null,
  };
}

export function finalizeGenealogyPlace(
  draft: GenealogyPlace
): GenealogyPlace | null {
  if (draft.kind === 'phrase') {
    const text = draft.originalText?.trim() || '';
    if (!text) return null;
    return {
      schemaVersion: 1,
      kind: 'phrase',
      originalText: text,
    };
  }

  const country = draft.country?.trim() || (draft.province?.trim() ? '中国' : '');
  const countryCode =
    draft.countryCode?.trim() || (country === '中国' ? 'CN' : undefined);
  const province = draft.province?.trim() || '';
  const city = isPlaceholderCityName(draft.city) ? '' : draft.city?.trim() || '';
  const district = draft.district?.trim() || '';
  const originalText = draft.originalText?.trim() || null;

  const isOverseasCountry = Boolean(
    country && country !== '中国' && countryCode !== 'CN'
  );
  const hasMeaningfulRegion = Boolean(
    isOverseasCountry || province || city || district
  );

  if (!hasMeaningfulRegion) {
    if (!originalText) return null;
    return {
      schemaVersion: 1,
      kind: 'phrase',
      originalText,
    };
  }

  return {
    schemaVersion: 1,
    kind: 'structured',
    countryCode: countryCode || undefined,
    country: country || undefined,
    provinceCode: draft.provinceCode?.trim() || undefined,
    province: province || undefined,
    cityCode: city ? draft.cityCode?.trim() || undefined : undefined,
    city: city || undefined,
    districtCode: district ? draft.districtCode?.trim() || undefined : undefined,
    district: district || undefined,
    originalText,
  };
}

export function extractClanPlaceStats(
  persons: PersonRecord[] = []
): ClanPlaceStat[] {
  const counts = new Map<
    string,
    { count: number; structuredPlace?: GenealogyPlace | null }
  >();

  const recordPlace = (structured?: GenealogyPlace | null) => {
    if (!structured) return;
    const clean = formatGenealogyPlace(structured).trim();
    if (!clean) return;
    const prev = counts.get(clean);
    if (prev) {
      prev.count += 1;
      if (!prev.structuredPlace) {
        prev.structuredPlace = structured;
      }
    } else {
      counts.set(clean, { count: 1, structuredPlace: structured });
    }
  };

  for (const p of persons) {
    recordPlace(p.birth?.structuredPlace);
    recordPlace(p.death?.structuredPlace);
    recordPlace(p.death?.structuredBurialPlace);
    p.events?.forEach((ev) => recordPlace(ev.structuredPlace));
  }

  return Array.from(counts.entries())
    .map(([label, meta]) => ({
      label,
      count: meta.count,
      structuredPlace: meta.structuredPlace,
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'zh-Hans-CN'));
}

function scoreRegionMatch(
  entry: FlattenedRegionEntry,
  tokens: string[],
  joinedNorm: string
): number {
  if (!joinedNorm) return 0;

  if (entry.normalizedFull === joinedNorm) {
    return 1000 + entry.level * 10;
  }
  if (entry.normalizedLeaf === joinedNorm) {
    return 900 + entry.level * 10;
  }
  if (entry.normalizedLeafShort === joinedNorm) {
    return 860 + entry.level * 10;
  }

  if (tokens.length > 1) {
    const allTokensMatch = tokens.every((t) => entry.normalizedFull.includes(t));
    if (!allTokensMatch) return 0;
    const lastToken = tokens[tokens.length - 1];
    if (
      entry.normalizedLeaf === lastToken ||
      entry.normalizedLeafShort === lastToken
    ) {
      return 780 + entry.level * 10;
    }
    return 620 + entry.level * 5;
  }

  if (
    entry.normalizedLeaf.startsWith(joinedNorm) ||
    entry.normalizedLeafShort.startsWith(joinedNorm)
  ) {
    return 720 + entry.level * 10;
  }

  if (entry.normalizedFull.includes(joinedNorm)) {
    return 480 + entry.level * 5 - Math.abs(entry.normalizedFull.length - joinedNorm.length);
  }

  let cursor = 0;
  for (const ch of joinedNorm) {
    const foundAt = entry.normalizedFull.indexOf(ch, cursor);
    if (foundAt < 0) return 0;
    cursor = foundAt + 1;
  }
  const matchedSegments = entry.normalizedSegments.filter(
    (seg) => seg.length >= 2 && joinedNorm.includes(seg)
  );
  if (matchedSegments.length >= 2) {
    return 680 + matchedSegments.length * 30 + entry.level * 5;
  }
  return 0;
}

function entryToGenealogyPlace(entry: FlattenedRegionEntry): GenealogyPlace {
  return {
    schemaVersion: 1,
    kind: 'structured',
    countryCode: entry.countryCode,
    country: entry.country,
    provinceCode: entry.provinceCode,
    province: entry.province,
    cityCode: entry.cityCode,
    city: entry.city,
    districtCode: entry.districtCode,
    district: entry.district,
    originalText: null,
  };
}

export function matchRegionFromText(raw: string): GenealogyPlace | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const normJoined = normalizePlaceSearchText(trimmed);
  if (!normJoined) return null;
  const cleanNorm = normJoined.startsWith('中国')
    ? normJoined.slice(2)
    : normJoined;
  if (!cleanNorm) return null;

  const entries = getFlattenedRegionIndex();
  const exact = entries.find((e) => e.normalizedFull === cleanNorm);
  if (exact) {
    return entryToGenealogyPlace(exact);
  }

  return null;
}

export interface GeneratePlaceSuggestionsOptions {
  clanPlaces?: ClanPlaceStat[];
  maxResults?: number;
}

export function generatePlaceSuggestions(
  raw: string,
  options: GeneratePlaceSuggestionsOptions = {}
): PlaceSuggestionItem[] {
  const { clanPlaces = [], maxResults = 7 } = options;
  const trimmed = raw.trim();
  if (!trimmed) return [];

  const rawTokens = trimmed
    .split(/[\s/,，、]+/)
    .map((t) => normalizePlaceSearchText(t))
    .filter(Boolean);
  const joinedNorm = normalizePlaceSearchText(trimmed);

  const suggestions: PlaceSuggestionItem[] = [];
  const seenLabels = new Set<string>();

  const pushItem = (item: Omit<PlaceSuggestionItem, 'id'>) => {
    if (seenLabels.has(item.primaryLabel)) return;
    seenLabels.add(item.primaryLabel);
    suggestions.push({
      id: `place-opt-${suggestions.length}`,
      ...item,
    });
  };

  // 1. Clan frequent places matching query
  if (clanPlaces.length > 0 && joinedNorm) {
    const matchedClan = clanPlaces
      .map((cp) => {
        const cpNorm = normalizePlaceSearchText(cp.label);
        const hit =
          rawTokens.length > 1
            ? rawTokens.every((t) => cpNorm.includes(t))
            : cpNorm.includes(joinedNorm);
        return { cp, cpNorm, hit };
      })
      .filter((x) => x.hit)
      .sort((a, b) => {
        const aExact = a.cpNorm === joinedNorm ? 1 : 0;
        const bExact = b.cpNorm === joinedNorm ? 1 : 0;
        if (aExact !== bExact) return bExact - aExact;
        return b.cp.count - a.cp.count;
      })
      .slice(0, 3);

    for (const { cp } of matchedClan) {
      const value: GenealogyPlace = cp.structuredPlace
        ? cloneGenealogyPlace(cp.structuredPlace)
        : matchRegionFromText(cp.label) ?? {
            schemaVersion: 1,
            kind: 'phrase',
            originalText: cp.label,
          };
      pushItem({
        kind: 'clan',
        primaryLabel: cp.label,
        metaLabel: cp.count > 1 ? `本族常用 · 已用${cp.count}次` : '本族已录地点',
        value,
      });
    }
  }

  // 2. Multi-level administrative region search
  const entries = getFlattenedRegionIndex();
  const regionJoinedNorm =
    joinedNorm.startsWith('中国') && joinedNorm.length > 2
      ? joinedNorm.slice(2)
      : joinedNorm;
  const regionTokens =
    rawTokens[0] === '中国'
      ? rawTokens.slice(1)
      : rawTokens.length > 0 &&
          rawTokens[0].startsWith('中国') &&
          rawTokens[0].length > 2
        ? [rawTokens[0].slice(2), ...rawTokens.slice(1)]
        : rawTokens;

  if (regionJoinedNorm) {
    const scoredRegions: Array<{ entry: FlattenedRegionEntry; score: number }> = [];
    for (const entry of entries) {
      const score = scoreRegionMatch(entry, regionTokens, regionJoinedNorm);
      if (score > 0) {
        scoredRegions.push({ entry, score });
      }
    }
    scoredRegions.sort(
      (a, b) => b.score - a.score || a.entry.fullLabel.length - b.entry.fullLabel.length
    );

    for (const { entry } of scoredRegions) {
      if (suggestions.length >= maxResults) break;
      pushItem({
        kind: 'region',
        primaryLabel: entry.fullLabel,
        metaLabel: `标准区划 · ${entry.hierarchyMeta}`,
        value: entryToGenealogyPlace(entry),
      });
    }
  }

  // 3. Original phrase fallback (always available at bottom)
  if (trimmed.length <= MAX_PLACE_TEXT_LENGTH) {
    const phrasePlace: GenealogyPlace = {
      schemaVersion: 1,
      kind: 'phrase',
      originalText: trimmed,
    };
    pushItem({
      kind: 'phrase',
      primaryLabel: trimmed,
      metaLabel:
        suggestions.length === 0 ? '原始记载 · 仅原文保存' : '按原始文本保存 · 不作标准化',
      value: phrasePlace,
    });
  }

  return suggestions;
}

export function isLosslessPlaceCarry(
  rawQuery: string,
  candidate: PlaceSuggestionItem
): boolean {
  const rawNorm = normalizePlaceSearchText(rawQuery);
  const qNorm =
    rawNorm.startsWith('中国') && rawNorm.length > 2 ? rawNorm.slice(2) : rawNorm;
  if (!qNorm) return true;
  const candNorm = normalizePlaceSearchText(candidate.primaryLabel);
  if (candNorm.includes(qNorm)) return true;

  const rawTokens = rawQuery
    .split(/[\s/,，、]+/)
    .map((t) => normalizePlaceSearchText(t))
    .filter(Boolean);
  const tokens =
    rawTokens[0] === '中国'
      ? rawTokens.slice(1)
      : rawTokens.length > 0 &&
          rawTokens[0].startsWith('中国') &&
          rawTokens[0].length > 2
        ? [rawTokens[0].slice(2), ...rawTokens.slice(1)]
        : rawTokens;
  return tokens.length > 0 && tokens.every((t) => candNorm.includes(t));
}

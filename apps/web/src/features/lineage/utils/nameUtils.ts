import { pinyin } from 'pinyin-pro';

/**
 * Strip clan surname from person names to match traditional Chinese genealogy conventions
 * e.g., "陈元英" -> "元英", "刘邦" -> "邦", "元英" -> "元英"
 */
export function stripSurname(name?: string, clanSurname: string = ''): string {
  if (!name) return '';
  const trimmed = name.trim();

  if (clanSurname && trimmed.startsWith(clanSurname) && trimmed.length > clanSurname.length) {
    return trimmed.slice(clanSurname.length);
  }

  return trimmed;
}

export function formatGivenName(name?: string, clanSurname: string = ''): string {
  return stripSurname(name, clanSurname);
}

/**
 * 常见中国姓氏（含单姓多音字、繁体异体及复姓）标准读音校正表（首字母大写、无声调）
 */
const SURNAME_PINYIN_OVERRIDES: Record<string, string> = {
  // 单姓多音字（含常见繁体）
  曾: 'Zeng',
  单: 'Shan',
  單: 'Shan',
  仇: 'Qiu',
  解: 'Xie',
  区: 'Ou',
  區: 'Ou',
  查: 'Zha',
  朴: 'Piao',
  盖: 'Ge',
  蓋: 'Ge',
  乐: 'Yue',
  樂: 'Yue',
  任: 'Ren',
  冼: 'Xian',
  洗: 'Xian',
  繁: 'Po',
  折: 'She',
  柏: 'Bai',
  秘: 'Bi',
  都: 'Du',
  乜: 'Nie',
  纪: 'Ji',
  紀: 'Ji',
  华: 'Hua',
  華: 'Hua',
  费: 'Fei',
  費: 'Fei',
  缪: 'Miao',
  繆: 'Miao',
  员: 'Yun',
  員: 'Yun',
  召: 'Shao',
  逄: 'Pang',
  种: 'Chong',
  種: 'Chong',
  句: 'Gou',
  祭: 'Zhai',
  过: 'Guo',
  過: 'Guo',
  宿: 'Su',
  盛: 'Sheng',
  覃: 'Qin',
  臧: 'Zang',
  尉: 'Wei',
  万: 'Wan',
  萬: 'Wan',
  翟: 'Zhai',
  褚: 'Chu',
  晁: 'Chao',
  毋: 'Wu',
  佘: 'She',
  谌: 'Chen',
  諶: 'Chen',
  阚: 'Kan',
  闞: 'Kan',
  瞿: 'Qu',
  葛: 'Ge',
  丁: 'Ding',
  燕: 'Yan',
  应: 'Ying',
  應: 'Ying',
  陆: 'Lu',
  陸: 'Lu',
  俞: 'Yu',
  吕: 'Lv',
  呂: 'Lv',
  阎: 'Yan',
  閻: 'Yan',
  闫: 'Yan',
  閆: 'Yan',
  那: 'Na',
  阿: 'A',
  宁: 'Ning',
  寧: 'Ning',
  齐: 'Qi',
  齊: 'Qi',
  沈: 'Shen',
  贾: 'Jia',
  賈: 'Jia',
  汤: 'Tang',
  湯: 'Tang',
  殷: 'Yin',
  石: 'Shi',
  冯: 'Feng',
  馮: 'Feng',
  程: 'Cheng',
  陈: 'Chen',
  陳: 'Chen',
  // 常见复姓（含繁体）
  欧阳: 'Ouyang',
  歐陽: 'Ouyang',
  司马: 'Sima',
  司馬: 'Sima',
  诸葛: 'Zhuge',
  諸葛: 'Zhuge',
  上官: 'Shangguan',
  夏侯: 'Xiahou',
  皇甫: 'Huangfu',
  宇文: 'Yuwen',
  公孙: 'Gongsun',
  公孫: 'Gongsun',
  慕容: 'Murong',
  尉迟: 'Yuchi',
  尉遲: 'Yuchi',
  万俟: 'Moqi',
  萬俟: 'Moqi',
  长孙: 'Zhangsun',
  長孫: 'Zhangsun',
  令狐: 'Linghu',
  澹台: 'Tantai',
  澹臺: 'Tantai',
  单于: 'Chanyu',
  單于: 'Chanyu',
  闾丘: 'Lvqiu',
  閭丘: 'Lvqiu',
  东方: 'Dongfang',
  東方: 'Dongfang',
  独孤: 'Dugu',
  獨孤: 'Dugu',
  南宫: 'Nangong',
  南宮: 'Nangong',
  闻人: 'Wenren',
  聞人: 'Wenren',
  司徒: 'Situ',
  司空: 'Sikong',
  百里: 'Baili',
  东郭: 'Dongguo',
  東郭: 'Dongguo',
  西门: 'Ximen',
  西門: 'Ximen',
  端木: 'Duanmu',
  赫连: 'Helian',
  赫連: 'Helian',
  鲜于: 'Xianyu',
  鮮于: 'Xianyu',
  太史: 'Taishi',
  呼延: 'Huyan',
  公冶: 'Gongye',
  仲孙: 'Zhongsun',
  仲孫: 'Zhongsun',
  钟离: 'Zhongli',
  鍾離: 'Zhongli',
  濮阳: 'Puyang',
  濮陽: 'Puyang',
  申屠: 'Shentu',
  轩辕: 'Xuanyuan',
  軒轅: 'Xuanyuan',
  拓跋: 'Tuoba',
  完颜: 'Wanyan',
  完顏: 'Wanyan',
  爱新觉罗: 'Aixinjueluo',
  愛新覺羅: 'Aixinjueluo',
};

function formatCapitalizedPinyin(syllables: string[]): string {
  const joined = syllables
    .map((part) => part.replace(/[^a-zA-Z0-9]/g, ''))
    .filter(Boolean)
    .join('');
  if (!joined) return '';
  return joined.charAt(0).toUpperCase() + joined.slice(1).toLowerCase();
}

/**
 * 将中文姓氏转换为「首字母大写、无声调、连写」格式（如：陈 -> Chen，欧阳 -> Ouyang，曾 -> Zeng）
 */
export function toSurnamePinyin(rawSurname?: string): string {
  const clean = rawSurname?.trim() || '';
  if (!clean) return '';

  const exactOverride = SURNAME_PINYIN_OVERRIDES[clean];
  if (exactOverride) {
    return exactOverride;
  }

  // 若输入为多字姓氏（如双姓「张曾」），逐字优先匹配姓氏校准表，其余交由 surname 模式转换
  const chars = Array.from(clean);
  if (chars.length > 1 && chars.every((ch) => /[\u4e00-\u9fff]/.test(ch))) {
    const syllables = chars.map((ch) => {
      const charOverride = SURNAME_PINYIN_OVERRIDES[ch];
      if (charOverride) return charOverride;
      return pinyin(ch, {
        surname: 'all',
        toneType: 'none',
        type: 'string',
        nonZh: 'consecutive',
        v: true,
        traditional: true,
      });
    });
    return formatCapitalizedPinyin(syllables);
  }

  const syllables = pinyin(clean, {
    surname: 'all',
    toneType: 'none',
    type: 'array',
    nonZh: 'consecutive',
    v: true,
    traditional: true,
  });

  return formatCapitalizedPinyin(syllables);
}

/**
 * 将中文名字转换为「首字母大写、无声调、连写」格式（如：文昭 -> Wenzhao）
 */
export function toGivenNamePinyin(rawGivenName?: string): string {
  const clean = rawGivenName?.trim() || '';
  if (!clean) return '';

  const syllables = pinyin(clean, {
    toneType: 'none',
    type: 'array',
    nonZh: 'consecutive',
    v: true,
    traditional: true,
  });

  return formatCapitalizedPinyin(syllables);
}

/**
 * 将中文全名转换为「姓氏拼音 + 空格 + 名字拼音」（如：陈劲 -> Chen Jing，屈海涛 -> Qu Haitao，欧阳修 -> Ouyang Xiu）
 */
export function toFullNamePinyin(
  fullName?: string,
  knownSurname?: string
): string {
  const cleanName = fullName?.trim() || '';
  if (!cleanName || !/[\u4e00-\u9fff]/.test(cleanName)) return '';

  const cleanSurname = knownSurname?.trim() || '';
  let surnamePart: string;
  let givenPart = '';

  if (cleanSurname && cleanName.startsWith(cleanSurname)) {
    surnamePart = cleanSurname;
    givenPart = cleanName.slice(cleanSurname.length).trim();
  } else if (cleanSurname) {
    surnamePart = cleanSurname;
    givenPart = cleanName;
  } else {
    const chars = Array.from(cleanName);
    const twoCharCandidate = chars.slice(0, 2).join('');
    if (chars.length >= 2 && SURNAME_PINYIN_OVERRIDES[twoCharCandidate]) {
      surnamePart = twoCharCandidate;
      givenPart = chars.slice(2).join('');
    } else if (chars.length >= 2) {
      surnamePart = chars[0];
      givenPart = chars.slice(1).join('');
    } else {
      surnamePart = cleanName;
    }
  }

  return [toSurnamePinyin(surnamePart), toGivenNamePinyin(givenPart)]
    .filter(Boolean)
    .join(' ');
}


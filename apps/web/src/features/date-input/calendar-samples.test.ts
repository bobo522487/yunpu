import assert from 'node:assert/strict';
import { test } from 'vitest';
import {
  getCalendarBasisForGregorian,
  getGanzhiForSolarDate,
  getGregorianDayOptions,
  getLunarYearInfo,
  gregorianToLunarParts,
  isValidGregorianDate,
  lunarToGregorianParts,
  normalizeDatePoint,
} from './calendar-adapter';
import {
  convertCalendarPoint,
  derivePrecisionFromParts,
  finalizeGenealogyDate,
  validateGenealogyDate,
} from './date-core';
import { formatGenealogyDate } from './date-format';
import {
  generateDateSuggestions,
  parseQuickDateInput,
} from './date-parser';
import { readGenealogyDate, writeGenealogyDate } from './legacy-adapter';
import type { PersonRecord } from '../lineage/types';

function runAllTests() {
  // 1. 2014 Spring Festival & Leap 9th month
  const y2014 = getLunarYearInfo(2014);
  assert.equal(y2014.supported, true);
  assert.equal(y2014.ganzhiLunarYear, '甲午');
  assert.equal(y2014.leapMonth, 9);
  assert.deepEqual(
    lunarToGregorianParts({ year: 2014, month: 1, isLeapMonth: false, day: 1 }),
    { year: 2014, month: 1, day: 31 }
  );
  assert.deepEqual(
    lunarToGregorianParts({ year: 2014, month: 9, isLeapMonth: true, day: 1 }),
    { year: 2014, month: 10, day: 24 }
  );

  // 2. 2020 Leap 4th month (29 days) & 2023 Leap 2nd month
  const y2020 = getLunarYearInfo(2020);
  assert.equal(y2020.leapMonth, 4);
  const leap4 = y2020.months.find((m) => m.month === 4 && m.isLeapMonth);
  assert.ok(leap4);
  assert.equal(leap4.days, 29);
  assert.deepEqual(
    lunarToGregorianParts({ year: 2020, month: 4, isLeapMonth: true, day: 1 }),
    { year: 2020, month: 5, day: 23 }
  );
  assert.deepEqual(
    gregorianToLunarParts({ year: 2023, month: 3, day: 22 }),
    { year: 2023, month: 2, isLeapMonth: true, day: 1 }
  );

  // 3. Reject non-existent leap month & day 30 in 29-day month
  const invalidLeap = validateGenealogyDate({
    schemaVersion: 1,
    kind: 'date',
    calendar: 'chinese_lunisolar',
    qualifier: 'exact',
    precision: 'day',
    parts: { year: 2020, month: 5, isLeapMonth: true, day: 1 },
  });
  assert.equal(invalidLeap.valid, false);

  const invalid30 = validateGenealogyDate({
    schemaVersion: 1,
    kind: 'date',
    calendar: 'chinese_lunisolar',
    qualifier: 'exact',
    precision: 'day',
    parts: { year: 2020, month: 4, isLeapMonth: true, day: 30 },
  });
  assert.equal(invalid30.valid, false);

  // 4. 1900 Gregorian non-leap & 1900 Lunar leap 8th month
  assert.equal(isValidGregorianDate(1900, 2, 29), false);
  assert.equal(isValidGregorianDate(2000, 2, 29), true);
  assert.equal(getLunarYearInfo(1900).leapMonth, 8);

  // 5. 1582 Julian -> Gregorian transition
  assert.equal(isValidGregorianDate(1582, 10, 4), true);
  assert.equal(isValidGregorianDate(1582, 10, 5), false);
  assert.equal(isValidGregorianDate(1582, 10, 14), false);
  assert.equal(isValidGregorianDate(1582, 10, 15), true);
  assert.equal(getGregorianDayOptions(1582, 10).length, 21);
  assert.equal(getCalendarBasisForGregorian(1582, 10, 4), 'julian');
  assert.equal(getCalendarBasisForGregorian(1582, 10, 15), 'gregorian');

  // 6. Ming Hongwu 18 (1385) & Qing Xuantong 3rd year 12th month 25th day (1912-02-12)
  const hongwuNorm = normalizeDatePoint({
    calendar: 'regnal',
    precision: 'day',
    parts: {
      dynastyId: 'ming',
      eraId: 'hongwu',
      eraName: '洪武',
      yearInEra: 18,
      month: 3,
      isLeapMonth: false,
      day: 6,
    },
  });
  assert.equal(hongwuNorm.status, 'exact');
  assert.equal(hongwuNorm.start, '1385-04-15');
  assert.equal(hongwuNorm.calendarBasis, 'julian');

  const xuantongAbdication = normalizeDatePoint({
    calendar: 'regnal',
    precision: 'day',
    parts: {
      dynastyId: 'qing',
      eraId: 'xuantong',
      eraName: '宣统',
      yearInEra: 3,
      month: 12,
      isLeapMonth: false,
      day: 25,
    },
  });
  assert.equal(xuantongAbdication.status, 'exact');
  assert.equal(xuantongAbdication.start, '1912-02-12');
  assert.equal(xuantongAbdication.calendarBasis, 'gregorian');

  // 7. Ganzhi split between Lichun (Feb 4, 2024) and Spring Festival (Feb 10, 2024)
  const cnyBasis = getGanzhiForSolarDate(2024, 2, 5, 'lunar_new_year');
  const lichunBasis = getGanzhiForSolarDate(2024, 2, 5, 'lichun');
  assert.equal(cnyBasis?.cycleYear, '癸卯');
  assert.equal(lichunBasis?.cycleYear, '甲辰');

  // 8. Sexagenary year alone never infers Gregorian year
  const jiawu = normalizeDatePoint({
    calendar: 'sexagenary',
    precision: 'year',
    parts: { cycleYear: '甲午', cycleIndex: 30, basis: 'lunar_new_year' },
  });
  assert.equal(jiawu.status, 'ambiguous');
  assert.equal(jiawu.start ?? null, null);

  // 9. Zi-hour preservation & format
  const ziLunar = finalizeGenealogyDate({
    schemaVersion: 1,
    kind: 'date',
    calendar: 'chinese_lunisolar',
    qualifier: 'exact',
    precision: 'day',
    parts: { year: 2014, month: 1, isLeapMonth: false, day: 1 },
    time: { type: 'traditional_hour', branch: 'zi' },
    originalText: '二〇一四年甲午正月初一日子时',
  });
  assert.equal(formatGenealogyDate(ziLunar), '农历2014甲午年正月初一子时');
  assert.equal(ziLunar.kind === 'date' && ziLunar.originalText, '二〇一四年甲午正月初一日子时');

  // 10. Canonical structuredDate Single Source of Truth & round-trip preservation
  const basePerson: PersonRecord = {
    id: 'p-1',
    branchId: 'default',
    name: '元英',
    gender: 'male',
    status: 'deceased',
    generation: 1,
    fatherId: null,
    birth: {
      structuredDate: {
        schemaVersion: 1,
        kind: 'phrase',
        originalText: '明洪武十八年乙丑三月初六日亥时',
      },
    },
  };
  const hydratedBirth = readGenealogyDate(basePerson, 'birth');
  assert.equal(hydratedBirth?.kind, 'phrase');
  assert.equal(hydratedBirth?.originalText, '明洪武十八年乙丑三月初六日亥时');

  const updated = writeGenealogyDate(basePerson, 'birth', ziLunar);
  assert.equal(updated.birth?.structuredDate, ziLunar);
  assert.equal(
    formatGenealogyDate(updated.birth?.structuredDate),
    '农历2014甲午年正月初一子时'
  );

  // 11. Precision derivation from optional month/day
  assert.equal(derivePrecisionFromParts(null, null), 'year');
  assert.equal(derivePrecisionFromParts(5, null), 'month');
  assert.equal(derivePrecisionFromParts(5, 12), 'day');

  // 12. Quick inline parser: Gregorian day / month / year / compact 8-digit
  const gDay = parseQuickDateInput('1990-05-12');
  assert.equal(gDay.ok, true);
  assert.equal(gDay.ok && formatGenealogyDate(gDay.value), '1990年5月12日');

  const gCompact = parseQuickDateInput('19900512');
  assert.equal(gCompact.ok, true);
  assert.equal(gCompact.ok && formatGenealogyDate(gCompact.value), '1990年5月12日');

  const gMonth = parseQuickDateInput('1990/5');
  assert.equal(gMonth.ok, true);
  assert.equal(gMonth.ok && gMonth.value?.kind === 'date' && gMonth.value.precision, 'month');
  assert.equal(gMonth.ok && formatGenealogyDate(gMonth.value), '1990年5月');

  const gYear = parseQuickDateInput('1988');
  assert.equal(gYear.ok, true);
  assert.equal(gYear.ok && gYear.value?.kind === 'date' && gYear.value.precision, 'year');

  // 13. Quick inline parser: Qualifiers & BCE
  const aboutYM = parseQuickDateInput('约1920年3月');
  assert.equal(aboutYM.ok, true);
  assert.equal(aboutYM.ok && formatGenealogyDate(aboutYM.value), '约1920年3月');

  const beforeY = parseQuickDateInput('1988年前');
  assert.equal(beforeY.ok, true);
  assert.equal(beforeY.ok && formatGenealogyDate(beforeY.value), '1988年以前');

  const bceY = parseQuickDateInput('公元前221年');
  assert.equal(bceY.ok, true);
  assert.equal(bceY.ok && formatGenealogyDate(bceY.value), '公元前221年');

  // 14. Quick inline parser: Explicit Lunar & Regnal shorthand
  const qLunar = parseQuickDateInput('农历2014年闰九月初一');
  assert.equal(qLunar.ok, true);
  assert.equal(qLunar.ok && formatGenealogyDate(qLunar.value), '农历2014甲午年闰九月初一');

  const qRegnal = parseQuickDateInput('光绪二十三年三月初六日');
  assert.equal(qRegnal.ok, true);
  assert.equal(qRegnal.ok && formatGenealogyDate(qRegnal.value), '光绪二十三年三月初六');

  // 15. Quick inline parser: Rejects invalid calendar dates & malformed numbers
  assert.equal(parseQuickDateInput('1990-02-30').ok, false);
  assert.equal(parseQuickDateInput('1582-10-10').ok, false);
  assert.equal(parseQuickDateInput('1990-').ok, false);

  // 16. Quick inline parser: Preserves archival phrase text cleanly
  const qPhrase = parseQuickDateInput('清末避乱某春');
  assert.equal(qPhrase.ok, true);
  assert.equal(qPhrase.ok && qPhrase.value?.kind, 'phrase');
  assert.equal(qPhrase.ok && formatGenealogyDate(qPhrase.value), '清末避乱某春');

  // 17. Calendar switching carry-over via convertCalendarPoint
  const gToLunar = convertCalendarPoint(
    {
      calendar: 'gregorian',
      precision: 'day',
      parts: { year: 1990, month: 5, day: 12 },
    },
    'chinese_lunisolar'
  );
  assert.equal(gToLunar.carried, true);
  assert.deepEqual(gToLunar.point, {
    calendar: 'chinese_lunisolar',
    precision: 'day',
    parts: { year: 1990, month: 4, isLeapMonth: false, day: 18 },
  });

  const lunarLeapToGreg = convertCalendarPoint(
    {
      calendar: 'chinese_lunisolar',
      precision: 'day',
      parts: { year: 2014, month: 9, isLeapMonth: true, day: 1 },
    },
    'gregorian'
  );
  assert.equal(lunarLeapToGreg.carried, true);
  assert.deepEqual(lunarLeapToGreg.point, {
    calendar: 'gregorian',
    precision: 'day',
    parts: { year: 2014, month: 10, day: 24 },
  });

  const yearOnlyGToLunar = convertCalendarPoint(
    {
      calendar: 'gregorian',
      precision: 'year',
      parts: { year: 1990, month: null, day: null },
    },
    'chinese_lunisolar'
  );
  assert.equal(yearOnlyGToLunar.carried, true);
  assert.deepEqual(yearOnlyGToLunar.point, {
    calendar: 'chinese_lunisolar',
    precision: 'year',
    parts: { year: 1990, month: null, isLeapMonth: false, day: null },
  });

  const gToRegnal = convertCalendarPoint(
    {
      calendar: 'gregorian',
      precision: 'day',
      parts: { year: 1897, month: 4, day: 7 },
    },
    'regnal'
  );
  assert.equal(gToRegnal.carried, true);
  assert.deepEqual(gToRegnal.point, {
    calendar: 'regnal',
    precision: 'day',
    parts: {
      dynastyId: 'qing',
      eraId: 'guangxu',
      eraName: '光绪',
      yearInEra: 23,
      month: 3,
      isLeapMonth: false,
      day: 6,
    },
  });

  const regnalToGreg = convertCalendarPoint(
    {
      calendar: 'regnal',
      precision: 'day',
      parts: {
        dynastyId: 'ming',
        eraId: 'hongwu',
        eraName: '洪武',
        yearInEra: 18,
        month: 3,
        isLeapMonth: false,
        day: 6,
      },
    },
    'gregorian'
  );
  assert.equal(regnalToGreg.carried, true);
  assert.deepEqual(regnalToGreg.point, {
    calendar: 'gregorian',
    precision: 'day',
    parts: { year: 1385, month: 4, day: 15 },
  });

  const gToSexagenary = convertCalendarPoint(
    {
      calendar: 'gregorian',
      precision: 'day',
      parts: { year: 1990, month: 5, day: 12 },
    },
    'sexagenary'
  );
  assert.equal(gToSexagenary.carried, true);
  assert.equal(gToSexagenary.point.calendar, 'sexagenary');
  assert.equal(gToSexagenary.point.parts.cycleYear, '庚午');

  const gUnmatchedRegnal = convertCalendarPoint(
    {
      calendar: 'gregorian',
      precision: 'day',
      parts: { year: 1990, month: 5, day: 12 },
    },
    'regnal'
  );
  assert.equal(gUnmatchedRegnal.carried, false);

  // 18. Live combobox suggestions (FamilySearch-style mid-typing & multi-calendar)
  const s1942 = generateDateSuggestions('1942-01-2');
  assert.equal(s1942[0]?.primaryLabel, '1942年1月2日');
  assert.ok(s1942.some((s) => s.primaryLabel === '农历1941辛巳年冬月十六'));
  assert.ok(s1942.some((s) => s.primaryLabel === '民国三十一年1月2日'));
  assert.equal(s1942[s1942.length - 1]?.kind, 'phrase');

  const sMonth1 = generateDateSuggestions('1942-1');
  assert.equal(sMonth1[0]?.primaryLabel, '1942年1月');
  assert.ok(sMonth1.some((s) => s.primaryLabel === '1942年10月'));
  assert.ok(sMonth1.some((s) => s.primaryLabel === '1942年12月'));

  const sTrailingDash = generateDateSuggestions('1942-');
  assert.equal(sTrailingDash[0]?.primaryLabel, '1942年');
  assert.ok(sTrailingDash.some((s) => s.primaryLabel === '农历1942壬午年'));
  assert.ok(sTrailingDash.some((s) => s.primaryLabel === '民国三十一年'));

  const sTrailingZero = generateDateSuggestions('约1942-01-0');
  assert.equal(sTrailingZero[0]?.primaryLabel, '约1942年1月');

  const sPartialRegnal = generateDateSuggestions('光绪23');
  assert.equal(sPartialRegnal[0]?.primaryLabel, '光绪二十三年');
  assert.ok(sPartialRegnal.some((s) => s.primaryLabel === '1897年'));
  assert.ok(sPartialRegnal.some((s) => s.primaryLabel === '农历1897丁酉年'));

  const sInvalid = generateDateSuggestions('1990-02-30');
  assert.equal(sInvalid.length, 0);

  console.log('All 18 calendar, quick-parser, combobox & conversion tests PASSED.');
}

test('calendar, quick-parser, combobox & conversion samples', () => {
  runAllTests();
});

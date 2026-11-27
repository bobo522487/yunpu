import assert from 'node:assert/strict';
import { test } from 'vitest';
import type { PersonRecord } from '../lineage/types';
import {
  extractClanPlaceStats,
  finalizeGenealogyPlace,
  formatGenealogyPlace,
  generatePlaceSuggestions,
  isLosslessPlaceCarry,
  matchRegionFromText,
  parsePlaceText,
  readGenealogyPlace,
  writeGenealogyPlace,
} from './index';

function runPlaceTests() {
  // 1. Traditional & Simplified search -> 贵州省贵阳市观山湖区
  const s1 = generatePlaceSuggestions('觀山湖');
  assert.ok(s1.length > 0, 'Expected suggestions for 觀山湖');
  assert.equal(s1[0].primaryLabel, '贵州省贵阳市观山湖区');
  assert.equal(s1[0].value.kind, 'structured');
  assert.equal(s1[0].value.province, '贵州省');
  assert.equal(s1[0].value.city, '贵阳市');
  assert.equal(s1[0].value.district, '观山湖区');

  const s1Full = generatePlaceSuggestions('中國貴州省貴陽市觀山湖區');
  assert.equal(s1Full[0].primaryLabel, '贵州省贵阳市观山湖区');

  // 2. Municipality flattening -> 北京市东城区 (no 市辖区)
  const s2 = generatePlaceSuggestions('东城');
  assert.ok(s2.some((item) => item.primaryLabel === '北京市东城区'));
  const dongcheng = s2.find((item) => item.primaryLabel === '北京市东城区')!;
  assert.equal(dongcheng.value.province, '北京市');
  assert.equal(dongcheng.value.city, undefined);
  assert.equal(dongcheng.value.district, '东城区');
  assert.equal(formatGenealogyPlace(dongcheng.value), '北京市东城区');

  // 3. Exact standardized region match vs non-standard phrase preservation
  const exactMatched = matchRegionFromText('贵州省贵阳市观山湖区');
  assert.ok(exactMatched);
  assert.equal(exactMatched.kind, 'structured');
  assert.equal(formatGenealogyPlace(exactMatched), '贵州省贵阳市观山湖区');

  const exactWithLeadingChina = matchRegionFromText('中国贵州省贵阳市观山湖区');
  assert.ok(exactWithLeadingChina);
  assert.equal(formatGenealogyPlace(exactWithLeadingChina), '贵州省贵阳市观山湖区');

  const phraseNotTruncated = matchRegionFromText('江西省吉安市泰和县澄江镇');
  assert.equal(phraseNotTruncated, null);

  // 4. Single-page finalizeGenealogyPlace: region empty -> phrase; region selected -> structured
  const finalizedPhrase = finalizeGenealogyPlace({
    schemaVersion: 1,
    kind: 'structured',
    province: '',
    city: '',
    district: '',
    originalText: '庐陵郡太和县南溪里',
  });
  assert.ok(finalizedPhrase);
  assert.equal(finalizedPhrase.kind, 'phrase');
  assert.equal(finalizedPhrase.originalText, '庐陵郡太和县南溪里');
  assert.equal(formatGenealogyPlace(finalizedPhrase), '庐陵郡太和县南溪里');

  const finalizedStructured = finalizeGenealogyPlace({
    schemaVersion: 1,
    kind: 'structured',
    province: '贵州省',
    city: '贵阳市',
    district: '观山湖区',
    originalText: '桐梓县狮子山金钗穴',
  });
  assert.ok(finalizedStructured);
  assert.equal(finalizedStructured.kind, 'structured');
  assert.equal(formatGenealogyPlace(finalizedStructured), '贵州省贵阳市观山湖区');
  assert.equal(finalizedStructured.originalText, '桐梓县狮子山金钗穴');

  // 5. Clan frequent places extraction & prioritization
  const taihePlace = matchRegionFromText('江西省吉安市泰和县')!;
  const guanshanhuPlace = matchRegionFromText('贵州省贵阳市观山湖区')!;
  const mockPersons: PersonRecord[] = [
    {
      id: 'p1',
      name: '始祖',
      generation: 1,
      branchId: 'b1',
      fatherId: null,
      gender: 'male',
      status: 'deceased',
      birth: { structuredPlace: taihePlace },
      death: {
        structuredBurialPlace: {
          schemaVersion: 1,
          kind: 'phrase',
          originalText: '泰和县狮子山金钗穴，坐北朝南',
        },
      },
    },
    {
      id: 'p2',
      name: '二世',
      generation: 2,
      branchId: 'b1',
      fatherId: 'p1',
      gender: 'male',
      status: 'deceased',
      birth: { structuredPlace: taihePlace },
      death: { structuredBurialPlace: guanshanhuPlace },
    },
    {
      id: 'p3',
      name: '三世',
      generation: 3,
      branchId: 'b1',
      fatherId: 'p2',
      gender: 'male',
      status: 'living',
      birth: { structuredPlace: taihePlace },
    },
  ];
  const clanStats = extractClanPlaceStats(mockPersons);
  assert.equal(clanStats[0].label, '江西省吉安市泰和县');
  assert.equal(clanStats[0].count, 3);

  const sClan = generatePlaceSuggestions('泰和', { clanPlaces: clanStats });
  assert.equal(sClan[0].kind, 'clan');
  assert.equal(sClan[0].primaryLabel, '江西省吉安市泰和县');
  assert.ok(sClan[0].metaLabel.includes('已用3次'));

  // 6. Lossless blur guard & canonical SSOT adapter round-trip
  assert.equal(isLosslessPlaceCarry('观山湖', s1[0]), true);
  const arbitrarySuggestions = generatePlaceSuggestions('老家后山，坐北朝南');
  assert.equal(arbitrarySuggestions[arbitrarySuggestions.length - 1].kind, 'phrase');
  if (arbitrarySuggestions[0].kind !== 'phrase') {
    assert.equal(
      isLosslessPlaceCarry('老家后山，坐北朝南', arbitrarySuggestions[0]),
      false
    );
  }

  const readBirth = readGenealogyPlace(mockPersons[0], 'birth');
  assert.ok(readBirth);
  assert.equal(readBirth.kind, 'structured');
  assert.equal(readBirth.district, '泰和县');
  assert.equal(readBirth.districtCode, '360826');

  const readBurial = readGenealogyPlace(mockPersons[0], 'burial');
  assert.ok(readBurial);
  assert.equal(readBurial.kind, 'phrase');
  assert.equal(readBurial.originalText, '泰和县狮子山金钗穴，坐北朝南');

  const updatedBurial = writeGenealogyPlace(
    mockPersons[0],
    'burial',
    finalizedStructured
  );
  assert.equal(
    formatGenealogyPlace(updatedBurial.death?.structuredBurialPlace),
    '贵州省贵阳市观山湖区'
  );
  assert.equal(
    updatedBurial.death?.structuredBurialPlace?.originalText,
    '桐梓县狮子山金钗穴'
  );

  const updatedDeath = writeGenealogyPlace(
    updatedBurial,
    'death',
    finalizedStructured
  );
  assert.equal(
    formatGenealogyPlace(updatedDeath.death?.structuredPlace),
    '贵州省贵阳市观山湖区'
  );
  assert.equal(
    updatedDeath.death?.structuredPlace?.originalText,
    '桐梓县狮子山金钗穴'
  );

  // 7. parsePlaceText handles legacy slash-delimited paths and non-standard phrases
  const legacySlash = parsePlaceText('江西省/九江市/德安县');
  assert.ok(legacySlash);
  assert.equal(legacySlash.kind, 'structured');
  assert.equal(formatGenealogyPlace(legacySlash), '江西省九江市德安县');

  const legacyMunicipality = parsePlaceText('北京市/市辖区/东城区');
  assert.ok(legacyMunicipality);
  assert.equal(legacyMunicipality.kind, 'structured');
  assert.equal(legacyMunicipality.city, undefined);
  assert.equal(formatGenealogyPlace(legacyMunicipality), '北京市东城区');

  const legacyShort = parsePlaceText('中国/北京/东城');
  assert.ok(legacyShort);
  assert.equal(legacyShort.kind, 'structured');
  assert.equal(formatGenealogyPlace(legacyShort), '北京市东城区');

  const overseasStructured = parsePlaceText('美国/加利福尼亚/旧金山');
  assert.ok(overseasStructured);
  assert.equal(overseasStructured.kind, 'structured');
  assert.equal(overseasStructured.countryCode, 'US');
  assert.equal(overseasStructured.provinceCode, 'US-CA');
  assert.equal(overseasStructured.cityCode, 'US-SFO');
  assert.equal(formatGenealogyPlace(overseasStructured), '美国加利福尼亚州旧金山');

  const unmappedOverseasPhrase = parsePlaceText('澳大利亚/昆士兰州/布里斯班');
  assert.ok(unmappedOverseasPhrase);
  assert.equal(unmappedOverseasPhrase.kind, 'phrase');
  assert.equal(unmappedOverseasPhrase.originalText, '澳大利亚/昆士兰州/布里斯班');

  const legacyPhrase = parsePlaceText('庐陵郡太和县南溪里');
  assert.ok(legacyPhrase);
  assert.equal(legacyPhrase.kind, 'phrase');
  assert.equal(legacyPhrase.originalText, '庐陵郡太和县南溪里');

  console.log('All 7 simplified place-input tests PASSED.');
}

test('place-input samples', () => {
  runPlaceTests();
});

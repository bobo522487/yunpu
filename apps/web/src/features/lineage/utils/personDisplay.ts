import { getPersonDateDisplay } from '../../date-input';
import { getLineageGraph } from '../domain/lineageGraph';
import type { PersonRecord } from '../types';
import { extractGregorianYear } from './dateRange';
import { formatGivenName } from './nameUtils';
import { computeAutoRankLabel } from './personHelpers';

export interface FamilyMemberRow {
  key: string;
  personId?: string;
  displayName: string;
  avatarUrl?: string;
  gender: 'male' | 'female' | 'unknown';
  relationshipLabel: string;
  yearsLabel: string;
}

export interface ImmediateFamilyGroups {
  upperGroup: FamilyMemberRow[];
  lowerGroup: FamilyMemberRow[];
  totalCount: number;
}

export function resolvePersonDisplayName(
  person: PersonRecord,
  clanSurname: string = ''
): string {
  const isSpouse = Boolean(person.spouseOfId);
  const effectiveSurname = isSpouse
    ? person.surname?.trim() || ''
    : person.surname?.trim() || clanSurname.trim();
  const baseName = isSpouse
    ? [
        effectiveSurname && !person.name.startsWith(effectiveSurname)
          ? effectiveSurname
          : '',
        person.name,
      ]
        .join('')
        .trim() || '配偶'
    : (() => {
        const given = formatGivenName(person.name, effectiveSurname);
        if (effectiveSurname && given && !given.startsWith(effectiveSurname)) {
          return `${effectiveSurname}${given}`;
        }
        return given || effectiveSurname;
      })();

  return [baseName, person.nameSuffix?.trim() || ''].join('') || '未命名';
}

export function resolveRomanizedDisplayName(person: PersonRecord): string {
  const parts = [
    person.romanizedName?.surname?.trim(),
    person.romanizedName?.name?.trim(),
    person.romanizedName?.suffix?.trim(),
  ].filter(Boolean);
  return parts.join(' ');
}

function formatCanvasGregorianYear(year: number | null): string {
  if (year === null) return '';
  return year < 0 ? `前${Math.abs(year)}` : String(year);
}

export function formatPersonGregorianLifespan(
  person: Pick<PersonRecord, 'status' | 'birth' | 'death'>
): string {
  const birthYear = extractGregorianYear(person.birth?.structuredDate);
  const isDeceased = person.status === 'deceased';
  const deathYear = isDeceased
    ? extractGregorianYear(person.death?.structuredDate)
    : null;

  const birthStr = formatCanvasGregorianYear(birthYear);
  const deathStr = formatCanvasGregorianYear(deathYear);

  if (birthStr && deathStr) return `${birthStr} - ${deathStr}`;
  if (birthStr) return isDeceased ? `${birthStr} - 歿` : `${birthStr} - 存`;
  if (deathStr) return `卒 ${deathStr}`;
  return isDeceased ? '歿' : '存';
}

export function calculateAgeDisplay(
  person: PersonRecord,
  atYear?: number | null
): number | null {
  if (
    atYear === undefined &&
    person.status === 'deceased' &&
    typeof person.death?.manualAge === 'number'
  ) {
    return person.death.manualAge;
  }

  const birthYear = extractGregorianYear(person.birth?.structuredDate);
  if (birthYear === null) return null;

  if (typeof atYear === 'number') {
    const diff = atYear - birthYear;
    return diff >= 0 && diff <= 130 ? diff : null;
  }

  if (person.status === 'deceased') {
    const deathYear = extractGregorianYear(person.death?.structuredDate);
    if (deathYear !== null) {
      const diff = deathYear - birthYear;
      return diff >= 0 && diff <= 130 ? diff : null;
    }
    return null;
  }

  const now = new Date();
  let age = now.getFullYear() - birthYear;
  const structured = person.birth?.structuredDate;
  if (structured?.kind === 'date' && structured.calendar === 'gregorian') {
    const parts = structured.parts as {
      month?: number | null;
      day?: number | null;
    };
    const m = parts.month;
    const d = parts.day;
    if (m) {
      const currentMonth = now.getMonth() + 1;
      const currentDay = now.getDate();
      if (currentMonth < m || (currentMonth === m && d && currentDay < d)) {
        age -= 1;
      }
    }
  }
  return age >= 0 && age <= 130 ? age : null;
}

export function formatPersonYearsSummary(person: PersonRecord): string {
  const birthYear = extractGregorianYear(person.birth?.structuredDate);
  const deathYear =
    person.status === 'deceased'
      ? extractGregorianYear(person.death?.structuredDate)
      : null;

  if (birthYear !== null && deathYear !== null) {
    return `${birthYear} - ${deathYear}`;
  }
  if (birthYear !== null) {
    return person.status === 'living'
      ? `出生：${birthYear}`
      : `${birthYear} - 歿`;
  }
  if (deathYear !== null) {
    return `卒于：${deathYear}`;
  }

  const rawBirth = getPersonDateDisplay(person, 'birth').trim();
  const rawDeath =
    person.status === 'deceased' ? getPersonDateDisplay(person, 'death').trim() : '';

  if (rawBirth && rawDeath) return `${rawBirth} - ${rawDeath}`;
  if (rawBirth) return `出生：${rawBirth}`;
  if (rawDeath) return `卒于：${rawDeath}`;
  return person.status === 'living' ? '健在' : '已故';
}

export function formatHeaderBirthLine(person: PersonRecord): string {
  const birthDateText = getPersonDateDisplay(person, 'birth').trim();
  const deathDateText =
    person.status === 'deceased'
      ? getPersonDateDisplay(person, 'death').trim()
      : '';

  const age = calculateAgeDisplay(person);

  if (birthDateText && person.status === 'living') {
    return age !== null ? `${birthDateText}（年龄 ${age}）` : birthDateText;
  }
  if (birthDateText && deathDateText) {
    return age !== null
      ? `${birthDateText} – ${deathDateText}（享寿 ${age} 岁）`
      : `${birthDateText} – ${deathDateText}`;
  }
  if (birthDateText) {
    return age !== null
      ? `生于 ${birthDateText}（享寿 ${age} 岁）`
      : `生于 ${birthDateText}`;
  }
  if (deathDateText) {
    return age !== null
      ? `卒于 ${deathDateText}（享寿 ${age} 岁）`
      : `卒于 ${deathDateText}`;
  }
  return '';
}

export function resolvePersonRelationshipHeader(
  person: PersonRecord,
  allPersons: PersonRecord[]
): string {
  if (person.spouseOfId) {
    const role =
      person.gender === 'male'
        ? '丈夫'
        : person.gender === 'female'
          ? '妻子'
          : '配偶';
    return `第 ${person.generation} 世 · ${role}`;
  }

  const autoRank = computeAutoRankLabel(person, allPersons);
  const titleParts = [`第 ${person.generation} 世`];
  if (person.relationTitle?.trim()) {
    titleParts.push(person.relationTitle.trim());
  } else if (autoRank) {
    titleParts.push(autoRank);
  }
  if (person.branchLabel?.trim()) {
    titleParts.push(person.branchLabel.trim());
  }
  return titleParts.join(' · ');
}

export function buildImmediateFamilyGroups(
  person: PersonRecord,
  allPersons: PersonRecord[],
  clanSurname: string = ''
): ImmediateFamilyGroups {
  const graph = getLineageGraph(allPersons);
  const upperGroup: FamilyMemberRow[] = [];
  const lowerGroup: FamilyMemberRow[] = [];

  const isSpouseNode = Boolean(person.spouseOfId);

  if (!isSpouseNode) {
    const father = person.fatherId
      ? graph.personById.get(person.fatherId) || null
      : null;

    if (father) {
      upperGroup.push({
        key: `father-${father.id}`,
        personId: father.id,
        displayName: resolvePersonDisplayName(father, clanSurname),
        avatarUrl: father.avatarUrl,
        gender: father.gender,
        relationshipLabel: '父亲',
        yearsLabel: formatPersonYearsSummary(father),
      });

      const fatherSpouses = graph.spousesByPartnerId.get(father.id) || [];
      const matchedMother = person.motherId
        ? fatherSpouses.find((m) => m.id === person.motherId) ||
          graph.personById.get(person.motherId)
        : fatherSpouses[0];

      if (matchedMother) {
        upperGroup.push({
          key: `mother-${matchedMother.id}`,
          personId: matchedMother.id,
          displayName: resolvePersonDisplayName(matchedMother, clanSurname),
          avatarUrl: matchedMother.avatarUrl,
          gender: matchedMother.gender,
          relationshipLabel: '母亲',
          yearsLabel: formatPersonYearsSummary(matchedMother),
        });
      }

      const siblings = (graph.childrenByAnyParentId.get(father.id) || []).filter(
        (sib) => sib.id !== person.id
      );
      siblings.forEach((sib) => {
        upperGroup.push({
          key: `sib-${sib.id}`,
          personId: sib.id,
          displayName: resolvePersonDisplayName(sib, clanSurname),
          avatarUrl: sib.avatarUrl,
          gender: sib.gender,
          relationshipLabel: sib.gender === 'female' ? '姐妹' : '兄弟',
          yearsLabel: formatPersonYearsSummary(sib),
        });
      });
    } else if (person.motherId) {
      const mother = graph.personById.get(person.motherId);
      if (mother) {
        upperGroup.push({
          key: `mother-${mother.id}`,
          personId: mother.id,
          displayName: resolvePersonDisplayName(mother, clanSurname),
          avatarUrl: mother.avatarUrl,
          gender: mother.gender,
          relationshipLabel: '母亲',
          yearsLabel: formatPersonYearsSummary(mother),
        });
      }
    }
  }

  if (isSpouseNode) {
    const primary = person.spouseOfId
      ? graph.personById.get(person.spouseOfId)
      : undefined;
    if (primary) {
      lowerGroup.push({
        key: `partner-${primary.id}`,
        personId: primary.id,
        displayName: resolvePersonDisplayName(primary, clanSurname),
        avatarUrl: primary.avatarUrl,
        gender: primary.gender,
        relationshipLabel: primary.gender === 'male' ? '丈夫' : '妻子',
        yearsLabel: formatPersonYearsSummary(primary),
      });

      const primarySpouses = graph.spousesByPartnerId.get(primary.id) || [];
      const children = (
        graph.childrenByAnyParentId.get(primary.id) || []
      ).filter((child) => {
        if (child.motherId) return child.motherId === person.id;
        return primarySpouses[0]?.id === person.id;
      });

      children.forEach((child) => {
        lowerGroup.push({
          key: `child-${child.id}`,
          personId: child.id,
          displayName: resolvePersonDisplayName(child, clanSurname),
          avatarUrl: child.avatarUrl,
          gender: child.gender,
          relationshipLabel: child.gender === 'female' ? '女儿' : '儿子',
          yearsLabel: formatPersonYearsSummary(child),
        });
      });
    }
  } else {
    const spouseNodes = graph.spousesByPartnerId.get(person.id) || [];
    spouseNodes.forEach((sp) => {
      const disp = resolvePersonDisplayName(sp, clanSurname);
      const baseRole =
        sp.gender === 'male'
          ? '丈夫'
          : sp.gender === 'female'
            ? '妻子'
            : '配偶';
      lowerGroup.push({
        key: `spouse-${sp.id}`,
        personId: sp.id,
        displayName: disp,
        avatarUrl: sp.avatarUrl,
        gender: sp.gender,
        relationshipLabel: baseRole,
        yearsLabel: formatPersonYearsSummary(sp),
      });
    });

    const children = graph.childrenByAnyParentId.get(person.id) || [];
    children.forEach((child) => {
      lowerGroup.push({
        key: `child-${child.id}`,
        personId: child.id,
        displayName: resolvePersonDisplayName(child, clanSurname),
        avatarUrl: child.avatarUrl,
        gender: child.gender,
        relationshipLabel: child.gender === 'female' ? '女儿' : '儿子',
        yearsLabel: formatPersonYearsSummary(child),
      });
    });
  }

  return {
    upperGroup,
    lowerGroup,
    totalCount: upperGroup.length + lowerGroup.length,
  };
}

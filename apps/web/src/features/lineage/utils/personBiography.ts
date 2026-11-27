import { formatGenealogyDate, getPersonDateDisplay } from '../../date-input';
import { formatGenealogyPlace, getPersonPlaceDisplay } from '../../place-input';
import { getLineageGraph } from '../domain/lineageGraph';
import type {
  BiographyPreviewPreferences,
  PersonEventType,
  PersonRecord,
} from '../types';
import { extractGregorianYear } from './dateRange';
import { formatGivenName } from './nameUtils';
import { formatPersonAliases } from './personAliases';
import {
  computeAutoRankLabel,
  getDerivedChildren,
  getDerivedSpouses,
  normalizeEventType,
} from './personHelpers';

const EVENT_TYPE_TEXT_MAP: Record<PersonEventType, string> = {
  birth: '出生',
  education: '求学',
  career: '任职',
  marriage: '婚姻',
  residence: '迁居',
  death: '卒葬',
  other: '其他',
};

export interface LiveBiographySummary {
  displayName: string;
  legalNameText: string;
  statusBadge: string;
  kinshipLine: string;
  spouseLine: string;
  birthLine: string;
  lifeLine: string;
  deathLine: string;
  biographyLine: string;
  childrenLine: string;
  remarksLine: string;
  privateRows: { label: string; value: string }[];
}

export function buildBiographyPreviewData(
  draft: PersonRecord,
  allPersons: PersonRecord[],
  prefs: BiographyPreviewPreferences,
  clanSurname: string = ''
): LiveBiographySummary {
  const graph = getLineageGraph(allPersons);
  const effectiveSurname = draft.spouseOfId
    ? draft.surname?.trim() || ''
    : draft.surname?.trim() || clanSurname;
  const givenName = draft.spouseOfId
    ? draft.name.trim()
    : formatGivenName(draft.name, effectiveSurname);
  const fullNameBase =
    draft.spouseOfId &&
    effectiveSurname &&
    givenName &&
    !givenName.startsWith(effectiveSurname)
      ? `${effectiveSurname}${givenName}`
      : givenName;
  const nameWithSuffix = [fullNameBase, draft.nameSuffix?.trim() || ''].join('');
  const displayName = [draft.relationPrefix, nameWithSuffix]
    .filter(Boolean)
    .join(' ');
  const legalNameText = draft.legalName ? `（${draft.legalName}）` : '';
  const statusBadge = draft.status === 'living' ? '存' : '歿';

  const parent = draft.fatherId
    ? graph.personById.get(draft.fatherId) ?? null
    : draft.motherId
      ? graph.personById.get(draft.motherId) ?? null
      : null;
  const parentLabel = parent ? formatGivenName(parent.name, effectiveSurname) : '';

  const kinshipParts: string[] = [];
  const resolvedRank = computeAutoRankLabel(draft, allPersons);
  if (draft.relationTitle) {
    kinshipParts.push(draft.relationTitle);
  } else if (parentLabel) {
    const customRelation =
      draft.relationType &&
      draft.relationType !== '生子' &&
      draft.relationType !== '生女'
        ? draft.relationType
        : '';
    const displayRank =
      customRelation ||
      resolvedRank ||
      (draft.gender === 'female' ? '女' : '子');
    kinshipParts.push(
      displayRank.startsWith('之')
        ? `${parentLabel}${displayRank}`
        : `${parentLabel}之${displayRank}`
    );
  } else if (draft.generation === 1 && !draft.spouseOfId) {
    kinshipParts.push('开基始祖');
  }

  const aliasText = formatPersonAliases(draft);
  if (aliasText) kinshipParts.push(`别名 ${aliasText}`);
  if (draft.hangOrder) kinshipParts.push(draft.hangOrder);
  if (draft.lineageRemarks) kinshipParts.push(draft.lineageRemarks);
  if (draft.branchLabel) kinshipParts.push(`分房：${draft.branchLabel}`);
  if (draft.headingLine) kinshipParts.push(`题行：${draft.headingLine}`);

  const spouseNodes = draft.spouseOfId
    ? []
    : getDerivedSpouses(allPersons, draft.id);
  const spouseLine =
    spouseNodes.length > 0
      ? spouseNodes
          .map((sp) => {
            const rel = computeAutoRankLabel(sp, allPersons) || '配';
            const pre = sp.relationPrefix ? `${sp.relationPrefix} ` : '';
            const sSurname = sp.surname?.trim() || '';
            const sName =
              sSurname && sp.name && !sp.name.startsWith(sSurname)
                ? `${sSurname}${sp.name}`
                : sp.name || '配偶';
            const origin = sp.notes?.trim() ? `（${sp.notes.trim()}）` : '';
            const burialText = getPersonPlaceDisplay(sp, 'burial').trim();
            const burial = burialText ? `，${burialText}` : '';
            const rem = sp.lineageRemarks?.trim()
              ? `，${sp.lineageRemarks.trim()}`
              : '';
            return `${rel} ${pre}${sName}${origin}${burial}${rem}`;
          })
          .join('；')
      : '';

  const birthParts: string[] = [];
  const birthDisplay = getPersonDateDisplay(draft, 'birth');
  if (prefs.showBirth && birthDisplay) {
    birthParts.push(`生于 ${birthDisplay}`);
  }
  const birthPlaceText = getPersonPlaceDisplay(draft, 'birth').trim();
  if (prefs.showBirthDetail) {
    if (birthPlaceText) {
      birthParts.push(
        `${birthParts.length ? '生地 ' : '生于 '}${birthPlaceText}`
      );
    }
    if (draft.birth?.summary) birthParts.push(draft.birth.summary);
  }

  const lifeParts = prefs.showLife
    ? (draft.events || [])
        .map((ev) => {
          const dText = ev.structuredDate
            ? formatGenealogyDate(ev.structuredDate).trim()
            : '';
          const pText = ev.structuredPlace
            ? formatGenealogyPlace(ev.structuredPlace).trim()
            : '';
          const descText = ev.description?.trim() || '';
          if (!dText && !pText && !descText) return '';
          const typeLabel = EVENT_TYPE_TEXT_MAP[normalizeEventType(ev.type)];
          const body = [dText, pText, descText].filter(Boolean).join(' ');
          return typeLabel && !descText ? `${typeLabel} ${body}`.trim() : body;
        })
        .filter(Boolean)
    : [];

  const deathParts: string[] = [];
  if (draft.status === 'deceased') {
    const deathDisplay = getPersonDateDisplay(draft, 'death');
    if (prefs.showDeath && deathDisplay) {
      deathParts.push(`卒于 ${deathDisplay}`);
    }
    const deathPlaceText = getPersonPlaceDisplay(draft, 'death').trim();
    if (prefs.showDeathDetail && deathPlaceText) {
      deathParts.push(`卒地 ${deathPlaceText}`);
    }
    if (prefs.showDeathDetail && draft.death?.cause?.trim()) {
      deathParts.push(`死因 ${draft.death.cause.trim()}`);
    }
    const birthYear = extractGregorianYear(draft.birth?.structuredDate);
    const deathYear = extractGregorianYear(draft.death?.structuredDate);
    const computedAge =
      birthYear !== null && deathYear !== null && deathYear >= birthYear
        ? deathYear - birthYear
        : null;
    const ageVal = draft.death?.manualAge ?? computedAge;
    if (prefs.showDeath && ageVal !== null && ageVal !== undefined) {
      deathParts.push(`享寿 ${ageVal} 龄`);
    }
    const burialDateDisplay = getPersonDateDisplay(draft, 'burial');
    const burialPlaceText = getPersonPlaceDisplay(draft, 'burial').trim();
    if (prefs.showDeathDetail && (burialDateDisplay || burialPlaceText)) {
      const burialJoin = [burialDateDisplay, burialPlaceText]
        .filter(Boolean)
        .join(' ');
      deathParts.push(`葬 ${burialJoin}`);
    }
    if (prefs.showDeathDetail && draft.death?.summary) {
      deathParts.push(draft.death.summary);
    }
  }

  const derivedChildren = getDerivedChildren(allPersons, draft.id);
  const sons = derivedChildren.filter((c) => c.gender !== 'female');
  const daughters = derivedChildren.filter((c) => c.gender === 'female');
  const childSegments: string[] = [];
  if (sons.length > 0) {
    childSegments.push(
      `子 ${sons.length}：${sons
        .map((s) => formatGivenName(s.name, effectiveSurname))
        .join('、')}`
    );
  }
  if (daughters.length > 0) {
    childSegments.push(
      `女 ${daughters.length}：${daughters
        .map((d) => formatGivenName(d.name, effectiveSurname))
        .join('、')}`
    );
  }

  const privateRows: { label: string; value: string }[] = [];
  if (prefs.showPrivateInfo && draft.privateInfo) {
    if (draft.privateInfo.mobile) {
      privateRows.push({ label: '电话', value: draft.privateInfo.mobile });
    }
    if (draft.privateInfo.idCardNum) {
      privateRows.push({ label: '证件', value: draft.privateInfo.idCardNum });
    }
    if (draft.privateInfo.address) {
      privateRows.push({ label: '地址', value: draft.privateInfo.address });
    }
  }

  return {
    displayName: displayName || '未命名',
    legalNameText,
    statusBadge,
    kinshipLine: kinshipParts.join(' · '),
    spouseLine,
    birthLine: birthParts.join('，'),
    lifeLine: lifeParts.join('；'),
    deathLine: deathParts.join('，'),
    biographyLine: prefs.showBiography ? draft.biography?.trim() || '' : '',
    childrenLine: prefs.showChildren ? childSegments.join('；') : '',
    remarksLine: prefs.showRemarks ? draft.notes?.trim() || '' : '',
    privateRows,
  };
}

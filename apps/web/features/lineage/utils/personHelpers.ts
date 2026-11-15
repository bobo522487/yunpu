import {
  BiographyPreviewPreferences,
  PersonRecord,
  RelationKind,
} from '../types';
import { formatGivenName } from './nameUtils';

export const RELATION_TYPE_OPTIONS: RelationKind[] = [
  '生子',
  '嗣子',
  '继子',
  '祧子',
  '养子',
  '义子',
  '抚子',
  '螟蛉子',
  '随母子',
  '赘子',
  '契子',
  '假子',
  '外子',
  '异姓子',
  '抱子',
  '拾子',
  '寄子',
  '生女',
  '养女',
  '继女',
];

export const SPOUSE_RELATION_OPTIONS = [
  '原配',
  '继配',
  '再配',
  '侧室',
  '夫君',
  '配偶',
];

export const EDUCATION_LEVEL_OPTIONS = [
  '小学',
  '初中',
  '高中',
  '技工',
  '中技',
  '中专',
  '专科',
  '大学专科',
  '大学本科',
  '研究生',
  '博士',
];

export const GRADUATION_STATUS_OPTIONS = ['毕业', '在读', '肄业'];

const RANK_SCORE: Record<string, number> = {
  始祖: 0,
  长子: 1,
  长女: 1,
  长: 1,
  次子: 2,
  次女: 2,
  二子: 2,
  二女: 2,
  三子: 3,
  三女: 3,
  四子: 4,
  四女: 4,
  五子: 5,
  五女: 5,
  六子: 6,
  六女: 6,
  幼子: 99,
  幼女: 99,
};

function getRankScore(p: PersonRecord): number {
  if (p.siblingOrder !== undefined) return p.siblingOrder;
  if (p.biographyOrder !== undefined) return p.biographyOrder;
  if (p.rank && RANK_SCORE[p.rank] !== undefined) return RANK_SCORE[p.rank];
  return 50;
}

/**
 * Derive children from the single-source-of-truth person graph using fatherId.
 */
export function getDerivedChildren(
  allPersons: PersonRecord[],
  parentId: string
): PersonRecord[] {
  return allPersons
    .filter((p) => p.fatherId === parentId)
    .sort((a, b) => getRankScore(a) - getRankScore(b));
}

/**
 * Collect self + all descendants to prevent circular parent assignments.
 */
export function getDescendantExclusionSet(
  allPersons: PersonRecord[],
  personId: string
): Set<string> {
  const excluded = new Set<string>([personId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const p of allPersons) {
      if (p.fatherId && excluded.has(p.fatherId) && !excluded.has(p.id)) {
        excluded.add(p.id);
        changed = true;
      }
    }
  }
  return excluded;
}

/**
 * Compute read-only rank display such as "1-长子" from sibling order.
 */
export function computeRankDisplay(
  person: PersonRecord,
  allPersons: PersonRecord[]
): string {
  if (!person.fatherId) {
    return person.generation === 1 ? '始祖' : person.rank || '首节点';
  }
  const siblings = getDerivedChildren(allPersons, person.fatherId);
  const idx = siblings.findIndex((s) => s.id === person.id);
  const orderNum = idx >= 0 ? idx + 1 : person.siblingOrder || 1;
  const fallbackRank =
    person.rank ||
    (orderNum === 1
      ? person.gender === 'female'
        ? '长女'
        : '长子'
      : orderNum === 2
      ? person.gender === 'female'
        ? '次女'
        : '次子'
      : `第${orderNum}${person.gender === 'female' ? '女' : '子'}`);
  return `${orderNum}-${fallbackRank}`;
}

/**
 * Hydrate draft form data from PersonRecord, seamlessly bridging legacy top-level fields.
 */
export function hydratePersonDraft(
  person: PersonRecord,
  clanSurname: string = ''
): PersonRecord {
  const career = person.career || {};
  const fallbackEduSummary =
    career.educationSummary ||
    [career.school, career.major, career.educationLevel, career.graduationStatus]
      .filter(Boolean)
      .join(' ');

  return {
    ...person,
    surname: person.surname ?? clanSurname,
    spouses: (person.spouses || []).map((s) => ({ ...s })),
    birth: {
      date: person.birth?.date ?? person.birthDate ?? '',
      place: person.birth?.place ?? '',
      summary: person.birth?.summary ?? '',
    },
    career: {
      educationLevel: career.educationLevel ?? '',
      graduationStatus: career.graduationStatus ?? '',
      school: career.school ?? '',
      major: career.major ?? '',
      educationSummary: fallbackEduSummary,
      profession: career.profession ?? '',
      title: career.title ?? person.officialTitle ?? '',
      resume: career.resume ?? '',
      lifeSummary: career.lifeSummary ?? '',
    },
    death: {
      date: person.death?.date ?? person.deathDate ?? '',
      burialPlace: person.death?.burialPlace ?? person.burialPlace ?? '',
      summary: person.death?.summary ?? '',
      age: person.death?.age ?? person.age,
    },
    sequenceMeta: {
      mainLabel: person.sequenceMeta?.mainLabel ?? '',
      mainNumber: person.sequenceMeta?.mainNumber,
      subLabel: person.sequenceMeta?.subLabel ?? '',
      subNumber: person.sequenceMeta?.subNumber,
      originalPage: person.sequenceMeta?.originalPage ?? person.biographyPage,
    },
    privateInfo: {
      idCardName: person.privateInfo?.idCardName ?? '',
      idCardNum: person.privateInfo?.idCardNum ?? '',
      mobile: person.privateInfo?.mobile ?? '',
      address: person.privateInfo?.address ?? '',
    },
  };
}

/**
 * Normalize draft before committing to the lineage store so top-level fields stay in sync.
 */
export function normalizePersonForSave(
  draft: PersonRecord,
  allPersons: PersonRecord[]
): PersonRecord {
  const father = draft.fatherId
    ? allPersons.find((p) => p.id === draft.fatherId)
    : null;

  const birthDate = draft.birth?.date?.trim() || undefined;
  const deathDate = draft.death?.date?.trim() || undefined;
  const burialPlace = draft.death?.burialPlace?.trim() || undefined;
  const age = draft.death?.age || undefined;
  const officialTitle =
    draft.career?.title?.trim() ||
    draft.career?.profession?.trim() ||
    undefined;

  const cleanedSpouses = (draft.spouses || []).filter(
    (s) => s.name?.trim() || s.clanOrigin?.trim() || s.remarks?.trim()
  );

  return {
    ...draft,
    name: draft.name.trim() || '未命名',
    surname: draft.surname?.trim() || undefined,
    legalName: draft.legalName?.trim() || undefined,
    courtesyName: draft.courtesyName?.trim() || undefined,
    hangOrder: draft.hangOrder?.trim() || undefined,
    fatherName: father ? father.name : draft.fatherId ? draft.fatherName : undefined,
    motherName: draft.motherName?.trim() || undefined,
    generationWord: draft.generationWord?.trim() || undefined,
    relationType: draft.relationType || undefined,
    relationTitle: draft.relationTitle?.trim() || undefined,
    relationPrefix: draft.relationPrefix?.trim() || undefined,
    relationNotes: draft.relationNotes?.trim() || undefined,
    lineageRemarks: draft.lineageRemarks?.trim() || undefined,
    branchLabel: draft.branchLabel?.trim() || undefined,
    headingLine: draft.headingLine?.trim() || undefined,
    biography: draft.biography?.trim() || undefined,
    notes: draft.notes?.trim() || undefined,
    spouses: cleanedSpouses,
    birthDate,
    deathDate,
    burialPlace,
    age,
    officialTitle,
    biographyPage: draft.sequenceMeta?.originalPage ?? draft.biographyPage,
  };
}

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
  const effectiveSurname = draft.surname?.trim() || clanSurname;
  const givenName = formatGivenName(draft.name, effectiveSurname);
  const displayName = [draft.relationPrefix, givenName]
    .filter(Boolean)
    .join(' ');
  const legalNameText = draft.legalName ? `（${draft.legalName}）` : '';
  const statusBadge = draft.status === 'living' ? '健在' : '殁';

  const father = draft.fatherId
    ? allPersons.find((p) => p.id === draft.fatherId)
    : null;
  const fatherLabel = father
    ? formatGivenName(father.name, effectiveSurname)
    : draft.fatherName
    ? formatGivenName(draft.fatherName, effectiveSurname)
    : '';

  const kinshipParts: string[] = [];
  if (draft.relationTitle) {
    kinshipParts.push(draft.relationTitle);
  } else if (fatherLabel) {
    kinshipParts.push(
      `${fatherLabel}之${draft.relationType || draft.rank || (draft.gender === 'female' ? '女' : '子')}`
    );
  } else if (draft.generation === 1) {
    kinshipParts.push('开基始祖');
  }
  if (draft.courtesyName) kinshipParts.push(`字号/别名 ${draft.courtesyName}`);
  if (draft.hangOrder) kinshipParts.push(draft.hangOrder);
  if (draft.lineageRemarks) kinshipParts.push(draft.lineageRemarks);
  if (draft.branchLabel) kinshipParts.push(`分房：${draft.branchLabel}`);
  if (draft.headingLine) kinshipParts.push(`题行：${draft.headingLine}`);

  const spouseLine =
    draft.spouses && draft.spouses.length > 0
      ? draft.spouses
          .filter((s) => s.name?.trim())
          .map((s) => {
            const rel = s.relationLabel || '配';
            const pre = s.prefix ? `${s.prefix} ` : '';
            const origin = s.clanOrigin ? `（${s.clanOrigin}）` : '';
            const burial = s.burialPlace ? `，${s.burialPlace}` : '';
            const rem = s.remarks ? `，${s.remarks}` : '';
            return `${rel} ${pre}${s.name}${origin}${burial}${rem}`;
          })
          .join('；')
      : '';

  const birthParts: string[] = [];
  if (prefs.showBirth && (draft.birth?.date || draft.birthDate)) {
    birthParts.push(`生于 ${draft.birth?.date || draft.birthDate}`);
  }
  if (prefs.showBirthDetail) {
    if (draft.birth?.place) birthParts.push(`生于 ${draft.birth.place}`);
    if (draft.birth?.summary) birthParts.push(draft.birth.summary);
  }

  const eduText =
    draft.career?.educationSummary ||
    [
      draft.career?.school,
      draft.career?.major,
      draft.career?.educationLevel,
      draft.career?.graduationStatus,
    ]
      .filter(Boolean)
      .join(' ');
  const lifeParts = prefs.showLife
    ? [
        eduText,
        draft.career?.profession,
        draft.career?.title || draft.officialTitle,
        draft.career?.resume,
        draft.career?.lifeSummary,
      ].filter(Boolean)
    : [];

  const deathParts: string[] = [];
  if (draft.status === 'deceased') {
    if (prefs.showDeath && (draft.death?.date || draft.deathDate)) {
      deathParts.push(`卒于 ${draft.death?.date || draft.deathDate}`);
    }
    const ageVal = draft.death?.age ?? draft.age;
    if (prefs.showDeath && ageVal) {
      deathParts.push(`享寿 ${ageVal} 龄`);
    }
    if (prefs.showDeathDetail) {
      const burial = draft.death?.burialPlace || draft.burialPlace;
      if (burial) deathParts.push(`葬 ${burial}`);
      if (draft.death?.summary) deathParts.push(draft.death.summary);
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
    if (draft.privateInfo.idCardName) {
      privateRows.push({ label: '实名', value: draft.privateInfo.idCardName });
    }
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

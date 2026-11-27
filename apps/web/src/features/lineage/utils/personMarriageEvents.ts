import { formatGenealogyDate } from '../../date-input';
import type { GenealogyDate } from '../../date-input/date.types';
import { formatGenealogyPlace } from '../../place-input';
import type { GenealogyPlace } from '../../place-input/place.types';
import type { PersonLifeEvent, PersonRecord } from '../types';
import { resolvePersonDisplayName } from './personDisplay';
import { normalizeEventType } from './personNormalization';

export interface CoupleMarriageInfo {
  dateText: string;
  placeText: string;
  structuredDate: GenealogyDate | null;
  structuredPlace: GenealogyPlace | null;
  description: string;
  partnerEventId: string;
  spouseEventId: string;
}

export function buildCoupleMarriageEventId(
  partnerId: string,
  spouseId: string
): string {
  return `ev-marriage-${partnerId}-${spouseId}`;
}

export function matchMarriageEventOnRecord(
  ownerEvents: PersonLifeEvent[],
  otherId: string,
  otherGivenName: string,
  otherDisplayName: string,
  spouseCount: number,
  partnerId?: string,
  spouseId?: string
): PersonLifeEvent | undefined {
  const marriageEvents = ownerEvents.filter(
    (ce) => normalizeEventType(ce.type) === 'marriage'
  );
  if (marriageEvents.length === 0) return undefined;

  const coupleId =
    partnerId && spouseId ? buildCoupleMarriageEventId(partnerId, spouseId) : null;

  const byDeterministicId = marriageEvents.find(
    (ce) =>
      (coupleId !== null && ce.id === coupleId) ||
      ce.id === `ev-marriage-${otherId}` ||
      ce.id === `ev-marriage-partner-${otherId}`
  );
  if (byDeterministicId) return byDeterministicId;

  const byDesc = marriageEvents.find((ce) => {
    const desc = ce.description?.trim() || '';
    return (
      (otherDisplayName && desc.includes(otherDisplayName)) ||
      (otherGivenName && desc.includes(otherGivenName))
    );
  });
  if (byDesc) return byDesc;

  if (spouseCount === 1 && marriageEvents.length === 1) {
    return marriageEvents[0];
  }
  return undefined;
}

export function findCoupleMarriageInfo(
  partner: PersonRecord,
  spouse: PersonRecord,
  spouseCount: number,
  clanSurname: string = ''
): CoupleMarriageInfo {
  const partnerName = resolvePersonDisplayName(partner, clanSurname);
  const spouseName = resolvePersonDisplayName(spouse, clanSurname);
  const canonicalCoupleId = buildCoupleMarriageEventId(partner.id, spouse.id);

  const onPartner = matchMarriageEventOnRecord(
    partner.events || [],
    spouse.id,
    spouse.name,
    spouseName,
    spouseCount,
    partner.id,
    spouse.id
  );
  const onSpouse = matchMarriageEventOnRecord(
    spouse.events || [],
    partner.id,
    partner.name,
    partnerName,
    1,
    partner.id,
    spouse.id
  );

  const primary = onPartner || onSpouse;
  const structuredDate =
    onPartner?.structuredDate ?? onSpouse?.structuredDate ?? null;
  const structuredPlace =
    onPartner?.structuredPlace ?? onSpouse?.structuredPlace ?? null;

  return {
    dateText: structuredDate ? formatGenealogyDate(structuredDate).trim() : '',
    placeText: structuredPlace
      ? formatGenealogyPlace(structuredPlace).trim()
      : '',
    structuredDate,
    structuredPlace,
    description: primary?.description?.trim() || '',
    partnerEventId: onPartner?.id || canonicalCoupleId,
    spouseEventId: onSpouse?.id || canonicalCoupleId,
  };
}

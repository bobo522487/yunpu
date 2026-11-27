import { getLineageGraph } from '../../domain/lineageGraph';
import type { PersonRecord } from '../../types';
import { getBirthComparableRange } from '../../utils/dateRange';
import { formatGivenName } from '../../utils/nameUtils';
import type { GenealogyFlowNode } from '../types';

export function computeTopologySignature(
  persons: PersonRecord[],
  collapsedNodeIds: Set<string>,
  clanSurname: string = ''
): string {
  const sortedPersons = [...persons].sort((a, b) => a.id.localeCompare(b.id));
  const personEntries = sortedPersons.map((p) => {
    const birthRange = getBirthComparableRange(p);
    const birthKey = birthRange ? `${birthRange.start}:${birthRange.end}` : '';
    const rootHasSurname =
      !p.fatherId && !p.motherId && !p.spouseOfId
        ? p.surname?.trim()
          ? '1'
          : '0'
        : '';
    return [
      p.id,
      p.generation ?? 1,
      p.fatherId ?? '',
      p.motherId ?? '',
      p.spouseOfId ?? '',
      p.siblingOrder ?? '',
      p.biographyOrder ?? '',
      birthKey,
      rootHasSurname,
    ].join('|');
  });

  const collapsedKey = Array.from(collapsedNodeIds).sort().join(',');
  const hasClanHeaderSurname = clanSurname.trim() ? '1' : '0';

  return `${hasClanHeaderSurname}::${collapsedKey}::${personEntries.join(';')}`;
}

function formatUnionMemberName(
  member: PersonRecord,
  isSpouse: boolean,
  clanSurname: string
): string {
  const effSurname = isSpouse
    ? member.surname?.trim() || ''
    : member.surname?.trim() || clanSurname.trim();
  const given = isSpouse
    ? member.name.trim()
    : formatGivenName(member.name, effSurname);
  if (effSurname && given && !given.startsWith(effSurname)) {
    return `${effSurname}${given}`;
  }
  return given || effSurname || member.name;
}

export interface PatchFlowNodesOptions {
  persons: PersonRecord[];
  selectedPersonId?: string | null;
  openMenuPersonId?: string | null;
  clanSurname?: string;
}

/**
 * Update node display attributes, selection state, and menu z-index in place
 * without discarding existing canvas positions (including user drags & ELK layout).
 */
export function patchFlowNodesAttributes(
  prevNodes: GenealogyFlowNode[],
  options: PatchFlowNodesOptions
): GenealogyFlowNode[] {
  const {
    persons,
    selectedPersonId = null,
    openMenuPersonId = null,
    clanSurname = '',
  } = options;
  const graph = getLineageGraph(persons);
  let mutated = false;

  const nextNodes = prevNodes.map((node): GenealogyFlowNode => {
    if (node.type === 'person') {
      const nextPerson = graph.personById.get(node.id);
      if (!nextPerson) return node;

      const nextSelected = node.id === selectedPersonId;
      const nextMenuOpen = node.id === openMenuPersonId;
      const nextZIndex = nextMenuOpen ? 1000 : undefined;

      if (
        node.data.person === nextPerson &&
        node.data.clanSurname === clanSurname &&
        node.data.isSelected === nextSelected &&
        node.data.isAddMenuOpen === nextMenuOpen &&
        node.zIndex === nextZIndex
      ) {
        return node;
      }

      mutated = true;
      return {
        ...node,
        zIndex: nextZIndex,
        data: {
          ...node.data,
          person: nextPerson,
          generation: nextPerson.generation,
          clanSurname,
          isSelected: nextSelected,
          isAddMenuOpen: nextMenuOpen,
        },
      };
    }

    if (node.type === 'union') {
      const father = graph.personById.get(node.data.fatherId);
      if (!father) return node;
      const spouses = graph.spousesByPartnerId.get(father.id) || [];
      const nextFatherName = formatUnionMemberName(father, false, clanSurname);
      const nextSpouseName =
        spouses
          .map((s) => formatUnionMemberName(s, true, clanSurname))
          .join('、') || undefined;

      if (
        node.data.fatherName === nextFatherName &&
        node.data.spouseName === nextSpouseName
      ) {
        return node;
      }

      mutated = true;
      return {
        ...node,
        data: {
          ...node.data,
          fatherName: nextFatherName,
          spouseName: nextSpouseName,
        },
      };
    }

    if (node.type === 'clanHeader') {
      const rootId = node.id.replace(/^clan-header-/, '');
      const root = graph.personById.get(rootId);
      const surname = root?.surname?.trim() || clanSurname.trim();
      if (!surname) return node;
      const nextLabel = surname.endsWith('氏') ? surname : `${surname} 氏`;
      if (node.data.label === nextLabel) return node;

      mutated = true;
      return {
        ...node,
        data: {
          ...node.data,
          label: nextLabel,
        },
      };
    }

    return node;
  });

  return mutated ? nextNodes : prevNodes;
}

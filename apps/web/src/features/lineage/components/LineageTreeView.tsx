import React from 'react';
import { type PersonRecord } from '../types';
import { GenealogyCanvas } from '../canvas/GenealogyCanvas';

interface LineageTreeViewProps {
  persons: PersonRecord[];
  selectedPersonId: string | null;
  branchTitle?: string;
  clanSurname?: string;
  onSelectPerson: (id: string | null) => void;
  onAddChild: (fatherId: string, gender?: 'male' | 'female') => void;
  onAddSibling?: (refPersonId: string, gender?: 'male' | 'female') => void;
  onAddSpouse: (personId: string) => void;
  onAddParent?: (personId: string) => void;
  onDeletePerson: (id: string) => void;
  onAddPersonDirectly?: (
    person: Partial<PersonRecord>,
    position?: { x: number; y: number }
  ) => void;
  onUpdatePersonFather?: (childId: string, fatherId: string | null) => void;
  maxGenerationFilter?: number;
}

export const LineageTreeView: React.FC<LineageTreeViewProps> = ({
  persons,
  selectedPersonId,
  branchTitle,
  clanSurname = '',
  onSelectPerson,
  onAddChild,
  onAddSibling,
  onAddSpouse,
  onAddParent,
  onDeletePerson,
  onAddPersonDirectly,
  onUpdatePersonFather,
  maxGenerationFilter = 20,
}) => {
  return (
    <div className="flex-1 min-h-0 w-full h-full relative overflow-hidden bg-background">
      <GenealogyCanvas
        persons={persons}
        selectedPersonId={selectedPersonId}
        branchTitle={branchTitle}
        clanSurname={clanSurname}
        onSelectPerson={onSelectPerson}
        onAddChild={onAddChild}
        onAddSibling={onAddSibling}
        onAddSpouse={onAddSpouse}
        onAddParent={onAddParent}
        onDeletePerson={onDeletePerson}
        onAddPersonDirectly={onAddPersonDirectly}
        onUpdatePersonFather={onUpdatePersonFather}
        maxGenerationFilter={maxGenerationFilter}
      />
    </div>
  );
};

export default LineageTreeView;

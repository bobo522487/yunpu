import React from 'react';
import { PersonRecord } from '../types';
import { GenealogyCanvas } from '../canvas/GenealogyCanvas';

interface LineageTreeViewProps {
  persons: PersonRecord[];
  selectedPersonId: string | null;
  branchTitle?: string;
  clanSurname?: string;
  onSelectPerson: (id: string | null) => void;
  onAddChild: (fatherId: string) => void;
  onAddSpouse: (personId: string) => void;
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
  onAddSpouse,
  onDeletePerson,
  onAddPersonDirectly,
  onUpdatePersonFather,
  maxGenerationFilter = 20,
}) => {
  return (
    <div className="w-full h-full relative overflow-hidden bg-background">
      <GenealogyCanvas
        persons={persons}
        selectedPersonId={selectedPersonId}
        branchTitle={branchTitle}
        clanSurname={clanSurname}
        onSelectPerson={onSelectPerson}
        onAddChild={onAddChild}
        onAddSpouse={onAddSpouse}
        onDeletePerson={onDeletePerson}
        onAddPersonDirectly={onAddPersonDirectly}
        onUpdatePersonFather={onUpdatePersonFather}
        maxGenerationFilter={maxGenerationFilter}
      />
    </div>
  );
};

export default LineageTreeView;

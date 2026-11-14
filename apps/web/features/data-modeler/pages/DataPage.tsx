import React, { useState, useEffect } from 'react';
import { SmartGrid } from '../components/SmartGrid/SmartGrid';
import { SchemaModelGrid } from '../components/SchemaModelGrid';
import { SchemaField } from '../../../types';
import ForeignKeyDrawer, { ForeignKeyConfig } from '../components/ForeignKeyDrawer';
import ColumnDrawer from '../components/ColumnDrawer';
import RecordDrawer from '../components/RecordDrawer';
import { useRouteContext } from '../../../hooks/useRouteContext';
import { useDataStore } from '../../../store/useDataStore';
import { getIconKeyForType } from '../utils/fieldIcons';

const EMPTY_SCHEMA: SchemaField[] = [];
const EMPTY_RECORDS: Record<string, any>[] = [];

const DataPage: React.FC = () => {
  const { activeTableId } = useRouteContext();

  const tables = useDataStore((s) => s.tables);
  const views = useDataStore((s) => s.views);
  const activeViewId = useDataStore((s) => s.activeViewId);
  const setActiveViewId = useDataStore((s) => s.setActiveViewId);
  const dataViewMode = useDataStore((s) => s.dataViewMode);
  const schemas = useDataStore((s) => s.schemas);
  const currentSchema = useDataStore((s) => s.schemas[activeTableId] || EMPTY_SCHEMA);
  const currentRecords = useDataStore((s) => s.records[activeTableId] || EMPTY_RECORDS);
  const addTableColumn = useDataStore((s) => s.addTableColumn);
  const updateTableColumn = useDataStore((s) => s.updateTableColumn);
  const deleteTableColumn = useDataStore((s) => s.deleteTableColumn);
  const setTableRecords = useDataStore((s) => s.setTableRecords);
  const addTableRecord = useDataStore((s) => s.addTableRecord);
  const updateTableRecord = useDataStore((s) => s.updateTableRecord);
  const updateTableCell = useDataStore((s) => s.updateTableCell);
  const deleteTableRecords = useDataStore((s) => s.deleteTableRecords);
  const reorderTableRecords = useDataStore((s) => s.reorderTableRecords);

  const currentTable = tables.find((t) => t.id === activeTableId);

  const [isForeignKeyDrawerOpen, setIsForeignKeyDrawerOpen] = useState(false);
  const [isColumnDrawerOpen, setIsColumnDrawerOpen] = useState(false);
  const [isRecordDrawerOpen, setIsRecordDrawerOpen] = useState(false);

  const [currentForeignKeyField, setCurrentForeignKeyField] = useState<SchemaField | null>(null);
  const [editingField, setEditingField] = useState<SchemaField | null>(null);
  const [editingRecord, setEditingRecord] = useState<Record<string, any> | null>(null);

  const activeView = views.find((v) => v.id === activeViewId);

  useEffect(() => {
    if (activeTableId && (!activeView || activeView.tableId !== activeTableId)) {
      const defaultView =
        views.find((v) => v.tableId === activeTableId && v.isDefault) ||
        views.find((v) => v.tableId === activeTableId);
      if (defaultView) {
        setActiveViewId(defaultView.id);
      }
    }
  }, [activeTableId, activeView, views, setActiveViewId]);

  const handleOpenRelationDrawer = (field: SchemaField) => {
    setCurrentForeignKeyField(field);
    setIsForeignKeyDrawerOpen(true);
  };

  const handleFKDrawerSave = (config: ForeignKeyConfig) => {
    if (currentForeignKeyField) {
      updateTableColumn(activeTableId, currentForeignKeyField.id, {
        isForeignKey: true,
        foreignKeyConfig: config,
      });
    }
    setIsForeignKeyDrawerOpen(false);
    setCurrentForeignKeyField(null);
  };

  const handleFKDrawerDelete = () => {
    if (currentForeignKeyField) {
      updateTableColumn(activeTableId, currentForeignKeyField.id, {
        isForeignKey: false,
        foreignKeyConfig: undefined,
      });
    }
    setIsForeignKeyDrawerOpen(false);
    setCurrentForeignKeyField(null);
  };

  const handleFKDrawerClose = () => {
    setIsForeignKeyDrawerOpen(false);
    if (currentForeignKeyField) {
      const field = currentSchema.find((f) => f.id === currentForeignKeyField.id);
      if (field && field.isForeignKey && !field.foreignKeyConfig) {
        updateTableColumn(activeTableId, currentForeignKeyField.id, { isForeignKey: false });
      }
    }
    setCurrentForeignKeyField(null);
  };

  const getTargetColumns = (tableId: string) => {
    const targetCols = schemas[tableId];
    if (!targetCols) return [];
    return targetCols.map((f) => ({ id: f.id, name: f.name }));
  };

  const handleAddColumnClick = () => {
    setEditingField(null);
    setIsColumnDrawerOpen(true);
  };

  const handleEditColumnClick = (field: SchemaField) => {
    setEditingField(field);
    setIsColumnDrawerOpen(true);
  };

  const handleColumnSave = (fieldConfig: Partial<SchemaField>) => {
    if (editingField) {
      updateTableColumn(activeTableId, editingField.id, fieldConfig);
    } else {
      const fieldType = fieldConfig.type || 'varchar';
      const newField: SchemaField = {
        id: `col_${Date.now()}`,
        name: fieldConfig.name || '新字段',
        type: fieldType,
        defaultValue: fieldConfig.defaultValue || '',
        isPrimary: fieldConfig.isPrimary || false,
        isForeignKey: fieldConfig.isForeignKey || false,
        foreignKeyConfig: fieldConfig.foreignKeyConfig,
        isUnique: fieldConfig.isUnique || false,
        isNullable: fieldConfig.isNullable !== undefined ? fieldConfig.isNullable : true,
        description: '',
        flex: true,
        iconName: fieldConfig.iconName || getIconKeyForType(fieldType),
        width: 150,
        timeZone: fieldConfig.timeZone,
      };
      addTableColumn(activeTableId, newField);
    }
    setIsColumnDrawerOpen(false);
    setEditingField(null);
  };

  const handleColumnDelete = (id: string) => {
    deleteTableColumn(activeTableId, id);
    setIsColumnDrawerOpen(false);
    setEditingField(null);
  };

  const handleAddRowClick = () => {
    setEditingRecord(null);
    setIsRecordDrawerOpen(true);
  };

  const handleEditRowClick = (id: string | number) => {
    const record = currentRecords.find((r) => r.id === id);
    if (record) {
      setEditingRecord(record);
      setIsRecordDrawerOpen(true);
    }
  };

  const handleRecordSave = (recordData: Record<string, any>) => {
    if (editingRecord) {
      updateTableRecord(activeTableId, editingRecord.id, recordData);
    } else {
      addTableRecord(activeTableId, recordData);
    }
    setIsRecordDrawerOpen(false);
    setEditingRecord(null);
  };

  const handleImport = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result;
      if (typeof text === 'string') {
        try {
          const rows = text.split('\n').filter((r) => r.trim());
          if (rows.length > 0) {
            const headers = rows[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
            const maxId = Math.max(...currentRecords.map((r) => Number(r.id) || 0), 0);

            const newRecords = rows.slice(1).map((row, idx) => {
              const values = row.split(',').map((v) => v.trim().replace(/^"|"$/g, ''));
              const record: Record<string, any> = { id: maxId + idx + 1 };
              headers.forEach((header, i) => {
                const schemaCol =
                  currentSchema.find((s) => s.name === header) || {
                    id: header.toLowerCase(),
                  };
                record[schemaCol.id] = values[i] || '';
              });
              return record;
            });

            setTableRecords(activeTableId, [...currentRecords, ...newRecords]);
          }
        } catch (error) {
          console.error('Error parsing CSV:', error);
        }
      }
    };
    reader.readAsText(file);
  };

  const handleExport = (type: 'csv' | 'excel') => {
    const headers = currentSchema.map((f) => f.name);
    const keys = currentSchema.map((f) => f.id);

    const csvContent = [
      headers.join(','),
      ...currentRecords.map((row) => keys.map((key) => `"${row[key] ?? ''}"`).join(',')),
    ].join('\n');

    let blob: Blob;
    let filename = `${activeTableId || 'export'}`;

    if (type === 'excel') {
      const htmlContent = `
        <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
        <head><meta charset="utf-8" /></head>
        <body>
          <table>
            <thead><tr>${headers.map((h) => `<th>${h}</th>`).join('')}</tr></thead>
            <tbody>
              ${currentRecords
                .map(
                  (row) =>
                    `<tr>${keys.map((key) => `<td>${row[key] ?? ''}</td>`).join('')}</tr>`
                )
                .join('')}
            </tbody>
          </table>
        </body>
        </html>
      `;
      blob = new Blob([htmlContent], { type: 'application/vnd.ms-excel' });
      filename += '.xls';
    } else {
      blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      filename += '.csv';
    }

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex-1 flex flex-col w-full h-full bg-background relative min-w-0">
      {dataViewMode === 'MODEL' ? (
        <SchemaModelGrid
          schema={currentSchema}
          tables={tables}
          onAddColumn={handleAddColumnClick}
          onEditColumn={handleEditColumnClick}
          onDeleteColumn={(id) => deleteTableColumn(activeTableId, id)}
          onUpdateField={(fieldId, updates) =>
            updateTableColumn(activeTableId, fieldId, updates)
          }
          onOpenRelation={handleOpenRelationDrawer}
        />
      ) : (
        <SmartGrid<any>
          data={currentRecords}
          schema={currentSchema}
          onCellEdit={(rowId, colId, value) =>
            updateTableCell(activeTableId, rowId, colId, value)
          }
          onAddColumn={handleAddColumnClick}
          onEditColumn={handleEditColumnClick}
          onDeleteColumn={(id) => deleteTableColumn(activeTableId, id)}
          onAddRow={handleAddRowClick}
          onRowSelect={() => {}}
          onRowReorder={(activeId, overId) =>
            reorderTableRecords(activeTableId, activeId, overId)
          }
          onEditRow={handleEditRowClick}
          onDeleteRows={(ids) => deleteTableRecords(activeTableId, ids)}
          onImport={handleImport}
          onExport={handleExport}
        />
      )}

      {currentForeignKeyField && (
        <ForeignKeyDrawer
          isOpen={isForeignKeyDrawerOpen}
          onClose={handleFKDrawerClose}
          sourceTableName={activeTableId}
          sourceColumnName={currentForeignKeyField.name}
          tables={tables}
          getTargetColumns={getTargetColumns}
          onSave={handleFKDrawerSave}
          onDelete={handleFKDrawerDelete}
        />
      )}

      <ColumnDrawer
        isOpen={isColumnDrawerOpen}
        onClose={() => {
          setIsColumnDrawerOpen(false);
          setEditingField(null);
        }}
        initialField={editingField}
        onSave={handleColumnSave}
        onDelete={handleColumnDelete}
        tables={tables}
        activeTableName={currentTable?.name || activeTableId}
        getTargetColumns={getTargetColumns}
      />

      <RecordDrawer
        isOpen={isRecordDrawerOpen}
        onClose={() => {
          setIsRecordDrawerOpen(false);
          setEditingRecord(null);
        }}
        initialRecord={editingRecord}
        onSave={handleRecordSave}
        schema={currentSchema}
      />
    </div>
  );
};

export default DataPage;

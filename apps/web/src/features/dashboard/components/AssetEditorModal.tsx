import React, { useEffect, useState } from 'react';
import { type AssetColorTheme } from '../../../types';
import {
  ASSET_COLOR_PALETTES,
} from '../../../store/useWorkspaceStore';
import { usePreferencesStore } from '../../../store/usePreferencesStore';
import {
  AppColoredIcon,
  ProjectColoredIcon,
} from '../../../components/common/YunpuIcons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalShell,
} from '@/components/ui/modal';
import {
  formatGenealogyPlace,
  parsePlaceText,
  type GenealogyPlace,
} from '../../place-input';
import type { ProjectStatus } from '../api';
import {
  FamilyProfileFields,
  validateFamilyProfile,
  type FamilyFieldErrors,
  type FamilyProfileFormValues,
} from '../../project/components/FamilyProfileFields';

export interface AssetEditorSubmitValues {
  name: string;
  description: string;
  colorTheme: AssetColorTheme;
  status: ProjectStatus;
  surname?: string;
  ancestor?: string;
  hallName?: string;
  originText?: string;
  projectLevel?: number;
}

export interface AssetEditorModalProps {
  open: boolean;
  mode: 'create' | 'edit';
  kind: 'project' | 'app';
  initialValue?: {
    name: string;
    description?: string;
    colorTheme: AssetColorTheme;
    surname?: string;
    ancestor?: string;
    originText?: string;
    hallName?: string;
    status?: ProjectStatus;
    projectLevel?: number;
  };
  /** 提交进行中：禁用提交按钮（由接入方驱动 API 请求）。 */
  submitting?: boolean;
  /** 提交失败的错误回显（如 409 冲突）。 */
  error?: string | null;
  onClose: () => void;
  onSubmit: (values: AssetEditorSubmitValues) => void;
}

export const AssetEditorModal: React.FC<AssetEditorModalProps> = ({
  open,
  mode,
  kind,
  initialValue,
  submitting = false,
  error = null,
  onClose,
  onSubmit,
}) => {
  const isDarkMode = usePreferencesStore((s) => s.isDarkMode);

  // App modal state
  const [appName, setAppName] = useState('');
  const [appDescription, setAppDescription] = useState('');
  const [appColorTheme, setAppColorTheme] = useState<AssetColorTheme>('indigo');
  const [appError, setAppError] = useState<string | null>(null);

  // Family project form state
  const [familyName, setFamilyName] = useState('');
  const [familySurname, setFamilySurname] = useState('');
  const [ancestor, setAncestor] = useState('');
  const [hallName, setHallName] = useState('');
  const [regionPlace, setRegionPlace] = useState<GenealogyPlace | null>(null);
  const [description, setDescription] = useState('');

  const [errors, setErrors] = useState<FamilyFieldErrors>({});

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setAppError(null);

    if (kind === 'app') {
      setAppName(initialValue?.name ?? '');
      setAppDescription(initialValue?.description ?? '');
      setAppColorTheme(initialValue?.colorTheme ?? 'indigo');
      return;
    }

    if (initialValue) {
      setFamilyName(initialValue.name || '');
      setFamilySurname(initialValue.surname || '');
      setAncestor(initialValue.ancestor || '');
      setHallName(initialValue.hallName || '');
      setRegionPlace(parsePlaceText(initialValue.originText));
      setDescription(initialValue.description || '');
    } else {
      setFamilyName('');
      setFamilySurname('');
      setAncestor('');
      setHallName('');
      setRegionPlace(null);
      setDescription('');
    }
  }, [open, initialValue, kind]);

  // Compact modal for App creation/editing
  if (kind === 'app') {
    const title = mode === 'create' ? '新建应用' : '编辑应用信息';
    const handleAppSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (!appName.trim()) {
        setAppError('请输入应用名称');
        return;
      }
      onSubmit({
        name: appName.trim(),
        description: appDescription.trim(),
        colorTheme: appColorTheme,
        status: 'planning',
      });
    };

    return (
      <ModalShell
        open={open}
        onClose={onClose}
        size="sm"
        zIndexClass="z-[95]"
        ariaLabel={title}
      >
        <ModalHeader
          title={title}
          icon={<AppColoredIcon colorTheme={appColorTheme} className="w-5 h-5" />}
          onClose={onClose}
        />
        <form onSubmit={handleAppSubmit} className="flex flex-col flex-1 min-h-0">
          <ModalBody className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="asset-editor-name">应用名称</Label>
              <Input
                id="asset-editor-name"
                value={appName}
                onChange={(e) => {
                  setAppName(e.target.value);
                  if (appError) setAppError(null);
                }}
                placeholder="例如：售后工单门户"
                autoFocus
                required
              />
              {appError && (
                <p className="text-[12px] text-destructive">{appError}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="asset-editor-desc">简介（可选）</Label>
              <Input
                id="asset-editor-desc"
                value={appDescription}
                onChange={(e) => setAppDescription(e.target.value)}
                placeholder="简要描述用途..."
              />
            </div>

            <div className="space-y-2">
              <Label>图标配色</Label>
              <div className="flex items-center gap-2">
                {(Object.keys(ASSET_COLOR_PALETTES) as AssetColorTheme[]).map(
                  (key) => {
                    const p = ASSET_COLOR_PALETTES[key];
                    const selected = appColorTheme === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setAppColorTheme(key)}
                        title={p.label}
                        className={`w-9 h-9 rounded-lg flex items-center justify-center border-2 transition-all cursor-pointer ${
                          selected
                            ? 'border-primary scale-105'
                            : 'border-transparent hover:border-border'
                        }`}
                        style={{
                          backgroundColor: isDarkMode ? p.darkTileBg : p.tileBg,
                        }}
                      >
                        <AppColoredIcon colorTheme={key} className="w-4 h-4" />
                      </button>
                    );
                  }
                )}
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              取消
            </Button>
            <Button type="submit" size="sm" disabled={!appName.trim()}>
              {mode === 'create' ? '立即创建' : '保存更改'}
            </Button>
          </ModalFooter>
        </form>
      </ModalShell>
    );
  }

  const projectColorTheme = initialValue?.colorTheme ?? 'sky';
  const modalTitle = mode === 'create' ? '新建家族' : '编辑家族';

  const handleFamilySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const nextErrors = validateFamilyProfile({
      familyName,
      familySurname,
      ancestor,
    });

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    onSubmit({
      name: familyName.trim(),
      description: description.trim(),
      colorTheme: projectColorTheme,
      surname: familySurname.trim() || undefined,
      ancestor: ancestor.trim() || undefined,
      hallName: hallName.trim() || undefined,
      originText: formatGenealogyPlace(regionPlace).trim() || undefined,
      status: initialValue?.status ?? 'planning',
      projectLevel: initialValue?.projectLevel ?? 1,
    });
  };

  const handleFieldsChange = (patch: Partial<FamilyProfileFormValues>) => {
    if (patch.familyName !== undefined) setFamilyName(patch.familyName);
    if (patch.familySurname !== undefined) setFamilySurname(patch.familySurname);
    if (patch.ancestor !== undefined) setAncestor(patch.ancestor);
    if (patch.hallName !== undefined) setHallName(patch.hallName);
    if (patch.regionPlace !== undefined) setRegionPlace(patch.regionPlace);
    if (patch.description !== undefined) setDescription(patch.description);
  };

  return (
    <ModalShell
      open={open}
      onClose={() => {
        if (!submitting) onClose();
      }}
      size="lg"
      zIndexClass="z-[95]"
      closeOnBackdrop={!submitting}
      closeOnEsc={!submitting}
      ariaLabelledBy="family-project-modal-title"
    >
      <ModalHeader
        title={modalTitle}
        titleId="family-project-modal-title"
        icon={
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
            style={{
              backgroundColor: isDarkMode
                ? ASSET_COLOR_PALETTES[projectColorTheme].darkTileBg
                : ASSET_COLOR_PALETTES[projectColorTheme].tileBg,
            }}
          >
            <ProjectColoredIcon
              colorTheme={projectColorTheme}
              className="w-4 h-4"
            />
          </div>
        }
        onClose={() => {
          if (!submitting) onClose();
        }}
        closeDisabled={submitting}
      />

      <form
        id="createFamilyForm"
        onSubmit={handleFamilySubmit}
        noValidate
        className="flex flex-col flex-1 min-h-0"
      >
        <ModalBody className="space-y-4">
          <FamilyProfileFields
            values={{
              familyName,
              familySurname,
              ancestor,
              hallName,
              regionPlace,
              description,
            }}
            errors={errors}
            onChange={handleFieldsChange}
            onClearError={(field) =>
              setErrors((prev) => ({ ...prev, [field]: undefined }))
            }
            disabled={submitting}
            autoFocusName
          />

          {error && (
            <p
              role="alert"
              className="text-[13px] text-destructive bg-destructive/5 border border-destructive/30 rounded-md px-3 py-2"
            >
              {error}
            </p>
          )}
        </ModalBody>

        <ModalFooter>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={submitting}
          >
            取消
          </Button>
          <Button type="submit" size="sm" disabled={submitting}>
            {submitting ? '保存中...' : '确认'}
          </Button>
        </ModalFooter>
      </form>
    </ModalShell>
  );
};

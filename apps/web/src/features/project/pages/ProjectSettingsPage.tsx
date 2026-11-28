import React, { useMemo, useRef, useState } from 'react';
import { RotateCcw, Trash2, Upload } from 'lucide-react';
import { useNavigate } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { FamilyIcon } from '@/components/common/FamilyIcon';
import {
  formatGenealogyPlace,
  parsePlaceText,
} from '../../place-input';
import { useProjectId } from '../../../hooks/useProjectId';
import {
  useOrganizationProjectActions,
  useProjectQuery,
} from '../../dashboard/queries';
import { uploadProjectMediaRequest } from '../../lineage/api';
import { errorMessage } from '../../../lib/api';
import {
  FamilyProfileFields,
  validateFamilyProfile,
  type FamilyFieldErrors,
  type FamilyProfileFormValues,
} from '../components/FamilyProfileFields';

const MAX_ICON_BYTES = 5 * 1024 * 1024;
const SUPPORTED_ICON_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
]);

type SettingsDraft = FamilyProfileFormValues & {
  iconKey: string | null;
};

const ProjectSettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const activeProjectId = useProjectId();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { updateProject, deleteProject } = useOrganizationProjectActions();

  const targetProjectId = activeProjectId;
  const projectQuery = useProjectQuery(targetProjectId, { retry: false });

  const activeProject = projectQuery.data;
  const expectedVersion = projectQuery.data?.version;

  const baseValues = useMemo<SettingsDraft>(
    () => ({
      familyName: activeProject?.name || '',
      familySurname: activeProject?.surname || '',
      ancestor: activeProject?.ancestor || '',
      hallName: activeProject?.hallName || '',
      regionPlace: parsePlaceText(activeProject?.originText ?? undefined),
      description: activeProject?.description || '',
      iconKey: activeProject?.iconKey ?? null,
    }),
    [activeProject],
  );

  const [draft, setDraft] = useState<{
    projectId: string;
    values: SettingsDraft;
  } | null>(null);
  const values =
    draft && draft.projectId === targetProjectId ? draft.values : baseValues;

  const [errors, setErrors] = useState<FamilyFieldErrors>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedToast, setSavedToast] = useState(false);
  const [uploadingIcon, setUploadingIcon] = useState(false);
  const [iconError, setIconError] = useState<string | null>(null);

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleFieldsChange = (patch: Partial<SettingsDraft>) => {
    setDraft((prev) => {
      const current =
        prev && prev.projectId === targetProjectId ? prev.values : baseValues;
      return { projectId: targetProjectId, values: { ...current, ...patch } };
    });
    if (savedToast) setSavedToast(false);
    if (saveError) setSaveError(null);
  };

  const handleIconFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !targetProjectId) return;

    const mime = file.type === 'image/jpg' ? 'image/jpeg' : file.type;
    if (!SUPPORTED_ICON_TYPES.has(mime)) {
      setIconError('仅支持 PNG、JPEG、WEBP 或 GIF 图片');
      return;
    }
    if (file.size > MAX_ICON_BYTES) {
      setIconError('图标图片大小不能超过 5MB');
      return;
    }

    setUploadingIcon(true);
    setIconError(null);
    try {
      const uploaded = await uploadProjectMediaRequest(
        targetProjectId,
        file,
        mime,
      );
      handleFieldsChange({ iconKey: uploaded.key });
    } catch (err) {
      setIconError(errorMessage(err));
    } finally {
      setUploadingIcon(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetProjectId) return;

    const nextErrors = validateFamilyProfile(values);
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setSaving(true);
    setSaveError(null);
    setSavedToast(false);

    const trimmedName = values.familyName.trim();
    const trimmedSurname = values.familySurname.trim();
    const trimmedAncestor = values.ancestor.trim();
    const trimmedHall = values.hallName.trim();
    const formattedRegion = formatGenealogyPlace(values.regionPlace).trim();
    const trimmedDesc = values.description.trim();

    try {
      await updateProject(targetProjectId, {
        name: trimmedName,
        surname: trimmedSurname || null,
        ancestor: trimmedAncestor || null,
        hallName: trimmedHall || null,
        originText: formattedRegion || null,
        description: trimmedDesc || null,
        iconKey: values.iconKey,
        version: expectedVersion,
      });

      setDraft(null);
      setSavedToast(true);
      setTimeout(() => setSavedToast(false), 2000);
    } catch (err) {
      setSaveError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!targetProjectId) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteProject(targetProjectId);
      void navigate({ to: '/' });
    } catch (err) {
      setDeleteError(errorMessage(err));
      setConfirmDelete(false);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="flex-1 h-full overflow-y-auto bg-background">
      <div className="max-w-3xl mx-auto px-4 md:px-8 py-6 space-y-6">
        <div>
          <h1 className="yp-h1 text-foreground">
            家族设置
          </h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">
            管理「{values.familyName || activeProject?.name || '家族'}」的谱牒基础档案信息。
          </p>
        </div>

        {/* Basic Family Profile (aligned 1:1 with Create Family modal) */}
        <section className="rounded-xl border border-border bg-card p-5 sm:p-6 space-y-5 shadow-[var(--shadow-card)]">
          <h2 className="yp-h3 text-foreground">
            基本信息
          </h2>
          <form onSubmit={(e) => void handleSave(e)} noValidate className="space-y-5 max-w-xl">
            <div className="space-y-3 pb-4 border-b border-border/70">
              <div className="flex items-center justify-between gap-2">
                <Label className="block">家族图标</Label>
                <span className="text-[11px] text-muted-foreground">
                  展示于导航条顶部、家族卡片与面包屑
                </span>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <FamilyIcon
                  project={{
                    id: targetProjectId,
                    name: values.familyName || activeProject?.name,
                    surname: values.familySurname,
                    iconKey: values.iconKey,
                  }}
                  size="xl"
                />

                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif"
                      onChange={(e) => void handleIconFileChange(e)}
                      disabled={saving || uploadingIcon}
                      className="hidden"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={saving || uploadingIcon}
                      onClick={() => fileInputRef.current?.click()}
                      className="h-8 gap-1.5 text-[12px]"
                    >
                      <Upload size={13} />
                      {uploadingIcon
                        ? '上传中...'
                        : values.iconKey
                          ? '更换图片'
                          : '上传图片'}
                    </Button>

                    {values.iconKey && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={saving || uploadingIcon}
                        onClick={() => {
                          setIconError(null);
                          handleFieldsChange({ iconKey: null });
                        }}
                        className="h-8 gap-1.5 text-[12px] text-muted-foreground hover:text-foreground"
                      >
                        <RotateCcw size={13} />
                        恢复默认姓氏图标
                      </Button>
                    )}
                  </div>

                  <p className="text-[11.5px] text-muted-foreground leading-snug">
                    默认根据家族姓氏生成并自动适配当前配色预设；也可上传自定义图片（PNG/JPEG/WEBP/GIF，不超过 5MB）。
                  </p>

                  {iconError && (
                    <p role="alert" className="text-[12px] text-destructive">
                      {iconError}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <FamilyProfileFields
              values={values}
              errors={errors}
              onChange={handleFieldsChange}
              onClearError={(field) =>
                setErrors((prev) => ({ ...prev, [field]: undefined }))
              }
              disabled={saving}
              idPrefix="settings-family"
            />

            {saveError && (
              <p
                role="alert"
                className="text-[12px] text-destructive bg-destructive/5 border border-destructive/30 rounded-md px-3 py-2"
              >
                {saveError}
              </p>
            )}

            <div className="flex items-center gap-3 pt-1">
              <Button
                type="submit"
                size="sm"
                disabled={saving || uploadingIcon}
                className="whitespace-nowrap shrink-0"
              >
                {saving ? '保存中...' : '保存更改'}
              </Button>
              {savedToast && (
                <span
                  role="status"
                  className="text-xs font-medium text-primary"
                >
                  已保存家族设置
                </span>
              )}
            </div>
          </form>
        </section>

        {/* Danger Zone: Delete Family Only */}
        <section className="rounded-xl border border-border bg-card p-5 sm:p-6 space-y-4 shadow-[var(--shadow-card)]">
          <h2 className="yp-h3 text-foreground">
            家族操作
          </h2>

          {deleteError && (
            <p
              role="alert"
              className="text-[12px] text-destructive bg-destructive/5 border border-destructive/30 rounded-md px-3 py-2"
            >
              {deleteError}
            </p>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 py-1">
            <div>
              <div className="text-[13px] font-medium text-destructive">
                删除当前家族
              </div>
              <div className="text-[12px] text-muted-foreground mt-0.5">
                删除后该家族将从工作区家族列表中移除，且不可撤销。
              </div>
            </div>
            {confirmDelete ? (
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={deleting}
                  onClick={() => setConfirmDelete(false)}
                  className="whitespace-nowrap"
                >
                  取消
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  disabled={deleting}
                  onClick={() => void handleDelete()}
                  className="gap-1.5 whitespace-nowrap"
                >
                  {deleting ? '删除中...' : '确认删除'}
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setDeleteError(null);
                  setConfirmDelete(true);
                }}
                className="gap-1.5 text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/10 whitespace-nowrap shrink-0"
              >
                <Trash2 size={13} /> 删除家族
              </Button>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

export default ProjectSettingsPage;

import React, { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Trash2 } from 'lucide-react';
import { useNavigate } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import {
  formatGenealogyPlace,
  parsePlaceText,
} from '../../place-input';
import { useProjectId } from '../../../hooks/useProjectId';
import { useWorkspaceStore } from '../../../store/useWorkspaceStore';
import {
  deleteProjectRequest,
  fetchProject,
  updateProjectRequest,
} from '../../dashboard/api';
import { dashboardKeys, useProjectQuery } from '../../dashboard/queries';
import { errorMessage } from '../../../lib/api';
import {
  FamilyProfileFields,
  validateFamilyProfile,
  type FamilyFieldErrors,
  type FamilyProfileFormValues,
} from '../components/FamilyProfileFields';

const ProjectSettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const activeProjectId = useProjectId();

  const projects = useWorkspaceStore((s) => s.projects);
  const syncProject = useWorkspaceStore((s) => s.syncProject);
  const dropProject = useWorkspaceStore((s) => s.dropProject);

  const cachedProject =
    projects.find((p) => p.id === activeProjectId) || projects[0];
  const targetProjectId = cachedProject?.id || activeProjectId;

  // 本地种子或离线项目未能命中服务端时，保留本地 store 数据展示。
  const projectQuery = useProjectQuery(targetProjectId, { retry: false });

  useEffect(() => {
    if (projectQuery.data) {
      syncProject(projectQuery.data);
    }
  }, [projectQuery.data, syncProject]);

  const activeProject = projectQuery.data ?? cachedProject;
  const expectedVersion = projectQuery.data?.version ?? null;

  const baseValues = useMemo<FamilyProfileFormValues>(
    () => ({
      familyName: activeProject?.name || '',
      familySurname: activeProject?.surname || '',
      ancestor: activeProject?.ancestor || '',
      hallName: activeProject?.hallName || '',
      regionPlace: parsePlaceText(activeProject?.originText ?? undefined),
      description: activeProject?.description || '',
    }),
    [activeProject],
  );

  const [draft, setDraft] = useState<{
    projectId: string;
    values: FamilyProfileFormValues;
  } | null>(null);
  const values =
    draft && draft.projectId === targetProjectId ? draft.values : baseValues;

  const [errors, setErrors] = useState<FamilyFieldErrors>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedToast, setSavedToast] = useState(false);

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleFieldsChange = (patch: Partial<FamilyProfileFormValues>) => {
    setDraft((prev) => {
      const current =
        prev && prev.projectId === targetProjectId ? prev.values : baseValues;
      return { projectId: targetProjectId, values: { ...current, ...patch } };
    });
    if (savedToast) setSavedToast(false);
    if (saveError) setSaveError(null);
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
      let versionStamp = expectedVersion;
      if (versionStamp == null) {
        const latest = await fetchProject(targetProjectId);
        versionStamp = latest.project.version;
      }

      const { project } = await updateProjectRequest(targetProjectId, {
        name: trimmedName,
        surname: trimmedSurname,
        ancestor: trimmedAncestor,
        hallName: trimmedHall || null,
        originText: formattedRegion || null,
        description: trimmedDesc || null,
        version: versionStamp,
      });

      syncProject(project);
      queryClient.setQueryData(dashboardKeys.project(targetProjectId), project);
      await queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
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
      await deleteProjectRequest(targetProjectId);
      dropProject(targetProjectId);
      await queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
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
                disabled={saving}
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

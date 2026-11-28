import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Archive, Save } from 'lucide-react';
import { useNavigate } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { errorMessage } from '../../../lib/api';
import { useAuthStore } from '../../auth/useAuthStore';
import {
  changePasswordRequest,
  updateAccountRequest,
} from '../api';
import {
  dashboardKeys,
  useAccountQuery,
  useCurrentOrganizationId,
  useOrganizationProjectActions,
  useOrganizationQuery,
} from '../queries';
import PageSkeleton from '../components/PageSkeleton';
import PageError from '../components/PageError';
import ConfirmDialog from '../components/ConfirmDialog';

const WorkspaceSettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const activeWorkspaceId = useCurrentOrganizationId();
  const { renameOrganization, archiveOrganization } =
    useOrganizationProjectActions();

  const orgQuery = useOrganizationQuery(activeWorkspaceId);
  const accountQuery = useAccountQuery();

  const [orgNameDraft, setOrgNameDraft] = useState<{
    orgId: string;
    value: string;
  } | null>(null);
  const [orgMessage, setOrgMessage] = useState<string | null>(null);
  const [orgSaving, setOrgSaving] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);

  const [displayNameDraft, setDisplayNameDraft] = useState<string | null>(null);
  const [accountMessage, setAccountMessage] = useState<string | null>(null);
  const [accountSaving, setAccountSaving] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSaving, setPasswordSaving] = useState(false);

  const orgDetail = orgQuery.data ?? null;
  const account = accountQuery.data ?? null;
  const orgName =
    orgNameDraft && orgNameDraft.orgId === activeWorkspaceId
      ? orgNameDraft.value
      : (orgDetail?.name ?? '');
  const displayName = displayNameDraft ?? account?.name ?? '';

  const myRole = orgDetail?.myRole;
  const canManageOrg = myRole === 'admin';

  const handleSaveOrgName = async () => {
    if (!activeWorkspaceId) return;
    setOrgSaving(true);
    setOrgMessage(null);
    try {
      await renameOrganization(activeWorkspaceId, orgName);
      setOrgNameDraft(null);
      setOrgMessage('组织名称已保存');
    } catch (error) {
      setOrgMessage(errorMessage(error));
    } finally {
      setOrgSaving(false);
    }
  };

  const handleArchive = async () => {
    if (!activeWorkspaceId) return;
    setArchiveOpen(false);
    setOrgMessage(null);
    try {
      const { nextOrganization } = await archiveOrganization(activeWorkspaceId);
      // 归档后去向（FR-013）：自动进入下一个可用组织；没有则进入引导状态。
      if (!nextOrganization) {
        void navigate({ to: '/onboarding', replace: true });
        return;
      }
      void navigate({ to: '/home', replace: true });
    } catch (error) {
      setOrgMessage(errorMessage(error));
    }
  };

  const handleSaveDisplayName = async () => {
    setAccountSaving(true);
    setAccountMessage(null);
    try {
      const result = await updateAccountRequest(displayName.trim());
      queryClient.setQueryData(dashboardKeys.account(), result);
      useAuthStore.getState().setUserName(result.name);
      setDisplayNameDraft(null);
      setAccountMessage('显示名已保存');
    } catch (error) {
      setAccountMessage(errorMessage(error));
    } finally {
      setAccountSaving(false);
    }
  };

  const handleChangePassword = async () => {
    setPasswordError(null);
    setPasswordMessage(null);
    setPasswordSaving(true);
    try {
      await changePasswordRequest(currentPassword, newPassword);
      setPasswordMessage('密码已修改，下次登录请使用新密码');
      setCurrentPassword('');
      setNewPassword('');
    } catch (error) {
      setPasswordError(errorMessage(error));
    } finally {
      setPasswordSaving(false);
    }
  };

  const isOrgLoading = Boolean(activeWorkspaceId) && orgQuery.isPending;
  const isAccountLoading = accountQuery.isPending;

  if (isOrgLoading || isAccountLoading) {
    return (
      <div className="flex-1 h-full overflow-y-auto bg-background">
        <div className="max-w-3xl mx-auto px-4 md:px-6 py-7">
          <PageSkeleton variant="form" />
        </div>
      </div>
    );
  }

  if (orgQuery.error && accountQuery.error) {
    return (
      <div className="flex-1 h-full overflow-y-auto bg-background">
        <div className="max-w-3xl mx-auto px-4 md:px-6 py-7">
          <PageError
            message={errorMessage(orgQuery.error ?? accountQuery.error)}
            onRetry={() => {
              void orgQuery.refetch();
              void accountQuery.refetch();
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 h-full overflow-y-auto bg-background">
      <div className="max-w-3xl mx-auto px-4 md:px-6 py-7 space-y-8">
        <div>
          <h1 className="yp-h1 text-foreground">
            设置
          </h1>
          <p className="text-[14px] text-muted-foreground mt-1">
            {orgDetail?.name ?? '当前组织'}
          </p>
        </div>

        {/* 组织设置分区 */}
        <section className="rounded-xl border border-border bg-card p-5 space-y-4 shadow-[var(--shadow-card)]">
          <div>
            <h2 className="yp-h3 text-foreground">
              组织设置
            </h2>
            <p className="text-[12px] text-muted-foreground mt-0.5">
              {canManageOrg
                ? '仅管理员可修改组织名称或归档组织'
                : '当前角色无权修改组织设置'}
            </p>
          </div>

          {orgQuery.error ? (
            <PageError
              message={errorMessage(orgQuery.error)}
              onRetry={() => void orgQuery.refetch()}
            />
          ) : (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="org-name">组织名称</Label>
                <div className="flex gap-2">
                  <Input
                    id="org-name"
                    value={orgName}
                    onChange={(event) =>
                      setOrgNameDraft({
                        orgId: activeWorkspaceId,
                        value: event.target.value,
                      })
                    }
                    disabled={!canManageOrg}
                  />
                  {canManageOrg && (
                    <Button
                      size="sm"
                      onClick={() => void handleSaveOrgName()}
                      disabled={orgSaving || !orgName.trim()}
                    >
                      <Save size={14} className="mr-1.5" />
                      {orgSaving ? '保存中…' : '保存'}
                    </Button>
                  )}
                </div>
              </div>

              {orgMessage && (
                <p className="text-[13px] text-muted-foreground">{orgMessage}</p>
              )}

              {canManageOrg && (
                <div className="pt-2 border-t border-border">
                  <p className="text-[12px] text-muted-foreground mb-2">
                    归档后组织数据保留，但成员无法再写入；系统会自动带你进入下一个可用组织。
                  </p>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setArchiveOpen(true)}
                  >
                    <Archive size={14} className="mr-1.5" />
                    归档组织
                  </Button>
                </div>
              )}
            </>
          )}
        </section>

        {/* 账号设置分区 */}
        <section className="rounded-xl border border-border bg-card p-5 space-y-4 shadow-[var(--shadow-card)]">
          <div>
            <h2 className="yp-h3 text-foreground">
              账号设置
            </h2>
            <p className="text-[12px] text-muted-foreground mt-0.5">
              仅对当前账号生效
            </p>
          </div>

          {accountQuery.error ? (
            <PageError
              message={errorMessage(accountQuery.error)}
              onRetry={() => void accountQuery.refetch()}
            />
          ) : (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="account-email">邮箱</Label>
                <Input
                  id="account-email"
                  value={account?.email ?? ''}
                  disabled
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="display-name">显示名</Label>
                <div className="flex gap-2">
                  <Input
                    id="display-name"
                    value={displayName}
                    onChange={(event) => setDisplayNameDraft(event.target.value)}
                  />
                  <Button
                    size="sm"
                    onClick={() => void handleSaveDisplayName()}
                    disabled={accountSaving || !displayName.trim()}
                  >
                    <Save size={14} className="mr-1.5" />
                    {accountSaving ? '保存中…' : '保存'}
                  </Button>
                </div>
                {accountMessage && (
                  <p className="text-[13px] text-muted-foreground">{accountMessage}</p>
                )}
              </div>

              <div className="pt-3 border-t border-border space-y-3">
                <Label>修改密码</Label>
                <div className="space-y-1.5">
                  <Input
                    type="password"
                    value={currentPassword}
                    onChange={(event) => setCurrentPassword(event.target.value)}
                    placeholder="当前密码"
                    autoComplete="current-password"
                  />
                  <Input
                    type="password"
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    placeholder="新密码（至少 8 个字符）"
                    autoComplete="new-password"
                  />
                </div>
                {passwordError && (
                  <p className="text-[13px] text-destructive">{passwordError}</p>
                )}
                {passwordMessage && (
                  <p className="text-[13px] text-muted-foreground">{passwordMessage}</p>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void handleChangePassword()}
                  disabled={passwordSaving || !currentPassword || newPassword.length < 8}
                >
                  {passwordSaving ? '提交中…' : '修改密码'}
                </Button>
              </div>
            </>
          )}
        </section>
      </div>

      <ConfirmDialog
        open={archiveOpen}
        title="归档组织"
        description={`归档「${orgDetail?.name ?? ''}」后，成员将无法再写入数据，该组织不再出现在可切换列表中；数据本身不会被删除。`}
        confirmLabel="归档"
        onConfirm={() => void handleArchive()}
        onCancel={() => setArchiveOpen(false)}
      />
    </div>
  );
};

export default WorkspaceSettingsPage;

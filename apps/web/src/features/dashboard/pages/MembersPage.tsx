import React, { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Crown, Trash2, UserPlus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect as Select } from '@/components/ui/native-select';
import {
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalShell,
} from '@/components/ui/modal';
import { errorMessage } from '../../../lib/api';
import { useWorkspaceStore } from '../../../store/useWorkspaceStore';
import {
  createInviteRequest,
  removeMemberRequest,
  revokeInviteRequest,
  transferOwnerRequest,
  updateMemberRoleRequest,
  type InviteRecord,
  type MemberRecord,
} from '../api';
import {
  dashboardKeys,
  useInvitesQuery,
  useMembersInfiniteQuery,
  useOrganizationQuery,
} from '../queries';
import PageSkeleton from '../components/PageSkeleton';
import PageError from '../components/PageError';
import ConfirmDialog from '../components/ConfirmDialog';
import InviteLinkDialog from '../components/InviteLinkDialog';

const ROLE_LABELS: Record<MemberRecord['role'], string> = {
  admin: '管理员',
  editor: '编辑者',
  viewer: '查看者',
};

const INVITE_STATUS_LABELS: Record<InviteRecord['status'], string> = {
  pending: '待处理',
  accepted: '已接受',
  revoked: '已撤销',
};

function InviteFormDialog(props: {
  organizationId: string;
  onClose: () => void;
  onCreated: (inviteUrl: string) => void;
}) {
  const { organizationId, onClose, onCreated } = props;
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<MemberRecord['role']>('editor');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setError(null);
    setSaving(true);
    try {
      const result = await createInviteRequest(organizationId, {
        email: email.trim(),
        role,
      });
      onCreated(result.inviteUrl);
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell
      open
      onClose={onClose}
      size="sm"
      zIndexClass="z-[90]"
      ariaLabel="邀请成员"
    >
      <ModalHeader title="邀请成员" onClose={onClose} closeDisabled={saving} />
      <ModalBody className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="invite-email">邮箱</Label>
          <Input
            id="invite-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="member@example.com"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="invite-role">角色</Label>
          <Select
            id="invite-role"
            value={role}
            onChange={(event) =>
              setRole(event.target.value as MemberRecord['role'])
            }
          >
            <option value="editor">编辑者</option>
            <option value="viewer">查看者</option>
            <option value="admin">管理员</option>
          </Select>
        </div>
        {error && <p className="text-[13px] text-destructive">{error}</p>}
      </ModalBody>
      <ModalFooter>
        <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>
          取消
        </Button>
        <Button
          size="sm"
          onClick={() => void submit()}
          disabled={saving || !email.trim()}
        >
          {saving ? '生成中…' : '创建邀请链接'}
        </Button>
      </ModalFooter>
    </ModalShell>
  );
}

const MembersPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [actionError, setActionError] = useState<string | null>(null);
  const [inviteFormOpen, setInviteFormOpen] = useState(false);
  const [createdInviteUrl, setCreatedInviteUrl] = useState<string | null>(null);
  const [removeTarget, setRemoveTarget] = useState<MemberRecord | null>(null);
  const [transferTarget, setTransferTarget] = useState<MemberRecord | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<InviteRecord | null>(null);

  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);

  const orgQuery = useOrganizationQuery(activeWorkspaceId);
  const membersQuery = useMembersInfiniteQuery(activeWorkspaceId, { limit: 50 });

  const detail = orgQuery.data ?? null;
  const isAdmin = detail?.myRole === 'admin';
  const isOwner = detail?.isOwner ?? false;

  const invitesQuery = useInvitesQuery(activeWorkspaceId, {
    limit: 50,
    enabled: isAdmin,
  });

  const memberItems = useMemo(
    () => membersQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [membersQuery.data],
  );
  const inviteItems = invitesQuery.data?.items ?? [];

  const runAction = async (action: () => Promise<void>) => {
    setActionError(null);
    try {
      await action();
    } catch (error) {
      setActionError(errorMessage(error));
    }
  };

  const handleChangeRole = (member: MemberRecord, role: MemberRecord['role']) =>
    void runAction(async () => {
      await updateMemberRoleRequest(activeWorkspaceId, member.userId, role);
      await queryClient.invalidateQueries({
        queryKey: dashboardKeys.members(activeWorkspaceId, { limit: 50 }),
      });
    });

  const handleRemove = async () => {
    if (!removeTarget) return;
    await runAction(async () => {
      await removeMemberRequest(activeWorkspaceId, removeTarget.userId);
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: dashboardKeys.members(activeWorkspaceId, { limit: 50 }),
        }),
        queryClient.invalidateQueries({
          queryKey: dashboardKeys.organization(activeWorkspaceId),
        }),
      ]);
    });
    setRemoveTarget(null);
  };

  const handleTransfer = async () => {
    if (!transferTarget) return;
    await runAction(async () => {
      await transferOwnerRequest(activeWorkspaceId, transferTarget.userId);
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: dashboardKeys.organization(activeWorkspaceId),
        }),
        queryClient.invalidateQueries({
          queryKey: dashboardKeys.members(activeWorkspaceId, { limit: 50 }),
        }),
      ]);
    });
    setTransferTarget(null);
  };

  const handleRevoke = async () => {
    if (!revokeTarget) return;
    await runAction(async () => {
      await revokeInviteRequest(activeWorkspaceId, revokeTarget.id);
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: dashboardKeys.invites(activeWorkspaceId, { limit: 50 }),
        }),
        queryClient.invalidateQueries({
          queryKey: dashboardKeys.organization(activeWorkspaceId),
        }),
      ]);
    });
    setRevokeTarget(null);
  };

  const visibleActionError =
    actionError ?? (orgQuery.error ? errorMessage(orgQuery.error) : null);

  return (
    <div className="flex-1 h-full overflow-y-auto bg-background">
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-7 space-y-8">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="yp-h1 text-foreground">
              成员
            </h1>
            <p className="text-[14px] text-muted-foreground mt-1 tabular-nums">
              {detail?.name ?? '当前组织'} · 共 {memberItems.length} 名成员
            </p>
          </div>
          {isAdmin && (
            <Button size="sm" onClick={() => setInviteFormOpen(true)}>
              <UserPlus size={15} className="mr-1.5" />
              邀请成员
            </Button>
          )}
        </div>

        {visibleActionError && (
          <div
            role="alert"
            className="flex items-center justify-between rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-2.5 text-[13px] text-destructive"
          >
            <span>{visibleActionError}</span>
            {actionError && (
              <button
                type="button"
                onClick={() => setActionError(null)}
                aria-label="关闭"
                className="cursor-pointer"
              >
                <X size={14} />
              </button>
            )}
          </div>
        )}

        {/* 成员名单 */}
        <section className="space-y-3">
          <h2 className="yp-h3 text-foreground">
            成员名单
          </h2>
          {Boolean(activeWorkspaceId) && membersQuery.isPending ? (
            <PageSkeleton variant="rows" />
          ) : membersQuery.error ? (
            <PageError
              message={errorMessage(membersQuery.error)}
              onRetry={() => void membersQuery.refetch()}
            />
          ) : (
            <div className="rounded-xl border border-border bg-card overflow-hidden shadow-[var(--shadow-card)]">
              <table className="w-full text-[14px]">
                <thead>
                  <tr className="border-b border-border bg-[var(--surface-subtle)] text-left text-[12px] text-muted-foreground">
                    <th className="px-4 py-2.5 font-medium">成员</th>
                    <th className="px-4 py-2.5 font-medium">角色</th>
                    <th className="px-4 py-2.5 font-medium">加入时间</th>
                    {isAdmin && <th className="px-4 py-2.5 font-medium">操作</th>}
                  </tr>
                </thead>
                <tbody>
                  {memberItems.map((member) => (
                    <tr
                      key={member.userId}
                      className="border-b border-border last:border-0 hover:bg-[var(--surface-hover)]/55 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-foreground">
                            {member.name || member.email}
                          </span>
                          {member.isOwner && (
                            <span className="inline-flex items-center gap-1 text-[12px] font-medium text-primary whitespace-nowrap shrink-0">
                              <Crown size={12} />
                              所有者
                            </span>
                          )}
                        </div>
                        <div className="text-[12px] text-muted-foreground">
                          {member.email}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {isAdmin && !member.isOwner ? (
                          <Select
                            selectSize="sm"
                            containerClassName="w-28"
                            value={member.role}
                            onChange={(event) =>
                              handleChangeRole(
                                member,
                                event.target.value as MemberRecord['role'],
                              )
                            }
                            aria-label={`${member.name} 的角色`}
                          >
                            {(Object.keys(ROLE_LABELS) as MemberRecord['role'][]).map(
                              (value) => (
                                <option key={value} value={value}>
                                  {ROLE_LABELS[value]}
                                </option>
                              ),
                            )}
                          </Select>
                        ) : (
                          <span className="text-[13px] text-foreground">
                            {ROLE_LABELS[member.role]}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-[13px] text-muted-foreground tabular-nums">
                        {new Date(member.joinedAt).toLocaleDateString()}
                      </td>
                      {isAdmin && (
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            {isOwner && !member.isOwner && (
                              <button
                                type="button"
                                className="text-[13px] text-primary hover:underline cursor-pointer whitespace-nowrap shrink-0"
                                onClick={() => setTransferTarget(member)}
                              >
                                设为所有者
                              </button>
                            )}
                            {!member.isOwner && (
                              <button
                                type="button"
                                className="inline-flex items-center gap-1 text-[13px] text-destructive hover:underline cursor-pointer whitespace-nowrap shrink-0"
                                onClick={() => setRemoveTarget(member)}
                              >
                                <Trash2 size={13} />
                                移除
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
              {membersQuery.hasNextPage && (
                <div className="flex justify-center border-t border-border py-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={membersQuery.isFetchingNextPage}
                    onClick={() => void membersQuery.fetchNextPage()}
                  >
                    {membersQuery.isFetchingNextPage ? '加载中…' : '加载更多'}
                  </Button>
                </div>
              )}
            </div>
          )}
        </section>

        {/* 邀请列表（仅管理员可见，与 C3 权限矩阵一致） */}
        {isAdmin && (
          <section className="space-y-3">
            <h2 className="yp-h3 text-foreground">
              邀请
            </h2>
            {invitesQuery.isPending ? (
              <PageSkeleton variant="rows" />
            ) : invitesQuery.error ? (
              <PageError
                message={errorMessage(invitesQuery.error)}
                onRetry={() => void invitesQuery.refetch()}
              />
            ) : inviteItems.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-card px-6 py-8 text-center text-[13px] text-muted-foreground">
                暂无待处理邀请
              </div>
            ) : (
              <div className="rounded-xl border border-border bg-card overflow-hidden shadow-[var(--shadow-card)]">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-[var(--surface-subtle)] text-left text-[12px] text-muted-foreground">
                      <th className="px-4 py-2.5 font-medium">邮箱</th>
                      <th className="px-4 py-2.5 font-medium">角色</th>
                      <th className="px-4 py-2.5 font-medium">状态</th>
                      <th className="px-4 py-2.5 font-medium">创建时间</th>
                      <th className="px-4 py-2.5 font-medium">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inviteItems.map((invite) => (
                      <tr
                        key={invite.id}
                        className="border-b border-border last:border-0 hover:bg-[var(--surface-hover)]/55 transition-colors"
                      >
                        <td className="px-4 py-3 text-foreground">{invite.email}</td>
                        <td className="px-4 py-3 text-[13px] text-muted-foreground">
                          {ROLE_LABELS[invite.role]}
                        </td>
                        <td className="px-4 py-3 text-[13px] text-muted-foreground">
                          {INVITE_STATUS_LABELS[invite.status]}
                        </td>
                        <td className="px-4 py-3 text-[13px] text-muted-foreground tabular-nums">
                          {new Date(invite.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3">
                          {invite.status === 'pending' && (
                            <button
                              type="button"
                              className="text-[13px] text-destructive hover:underline cursor-pointer whitespace-nowrap shrink-0"
                              onClick={() => setRevokeTarget(invite)}
                            >
                              撤销
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}
      </div>

      {inviteFormOpen && (
        <InviteFormDialog
          organizationId={activeWorkspaceId}
          onClose={() => setInviteFormOpen(false)}
          onCreated={(url) => setCreatedInviteUrl(url)}
        />
      )}

      {createdInviteUrl && (
        <InviteLinkDialog
          inviteUrl={createdInviteUrl}
          onClose={() => {
            setCreatedInviteUrl(null);
            void queryClient.invalidateQueries({
              queryKey: dashboardKeys.invites(activeWorkspaceId, { limit: 50 }),
            });
            void queryClient.invalidateQueries({
              queryKey: dashboardKeys.organization(activeWorkspaceId),
            });
          }}
        />
      )}

      <ConfirmDialog
        open={removeTarget !== null}
        title="移除成员"
        description={`移除「${(removeTarget?.name || removeTarget?.email) ?? ''}」后，该成员将无法再访问本组织的任何数据。`}
        confirmLabel="移除"
        onConfirm={() => void handleRemove()}
        onCancel={() => setRemoveTarget(null)}
      />

      <ConfirmDialog
        open={transferTarget !== null}
        title="转移所有权"
        description={`把所有者转移给「${(transferTarget?.name || transferTarget?.email) ?? ''}」后，你将不再是本组织的所有者，此操作不可撤销。`}
        confirmLabel="转移"
        onConfirm={() => void handleTransfer()}
        onCancel={() => setTransferTarget(null)}
      />

      <ConfirmDialog
        open={revokeTarget !== null}
        title="撤销邀请"
        description={`撤销发给「${revokeTarget?.email ?? ''}」的邀请后，该链接立即失效，受邀者将无法再通过它加入。`}
        confirmLabel="撤销"
        onConfirm={() => void handleRevoke()}
        onCancel={() => setRevokeTarget(null)}
      />
    </div>
  );
};

export default MembersPage;

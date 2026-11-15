import React, { useCallback, useEffect, useState } from 'react';
import { Crown, Trash2, UserPlus, X } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { errorMessage } from '../../../lib/api';
import { useWorkspaceStore } from '../../../store/useWorkspaceStore';
import {
  createInviteRequest,
  fetchInvites,
  fetchMembers,
  fetchOrganization,
  removeMemberRequest,
  revokeInviteRequest,
  transferOwnerRequest,
  updateMemberRoleRequest,
  type InviteRecord,
  type MemberRecord,
  type OrgDetail,
} from '../api';
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

type MemberState = {
  loading: boolean;
  error: string | null;
  items: MemberRecord[];
  nextCursor: string | null;
};

type InviteState = {
  loading: boolean;
  error: string | null;
  items: InviteRecord[];
};

const EMPTY_MEMBERS: MemberState = {
  loading: true,
  error: null,
  items: [],
  nextCursor: null,
};

const EMPTY_INVITES: InviteState = { loading: false, error: null, items: [] };

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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-sm rounded-xl border border-border bg-card p-5 shadow-xl"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="邀请成员"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-[15px] font-semibold text-foreground">邀请成员</h2>
          <button type="button" onClick={onClose} aria-label="关闭">
            <X size={16} className="text-muted-foreground" />
          </button>
        </div>
        <div className="mt-4 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="invite-email">邮箱</Label>
            <Input
              id="invite-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="teammate@example.com"
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="invite-role">角色</Label>
            <select
              id="invite-role"
              value={role}
              onChange={(event) => setRole(event.target.value as MemberRecord['role'])}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
            >
              {(Object.keys(ROLE_LABELS) as MemberRecord['role'][]).map((value) => (
                <option key={value} value={value}>
                  {ROLE_LABELS[value]}
                </option>
              ))}
            </select>
          </div>
          {error && <p className="text-[13px] text-destructive">{error}</p>}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>
            取消
          </Button>
          <Button size="sm" onClick={() => void submit()} disabled={saving || !email.trim()}>
            {saving ? '创建中…' : '创建邀请'}
          </Button>
        </div>
      </div>
    </div>
  );
}

const MembersPage: React.FC = () => {
  const [detail, setDetail] = useState<OrgDetail | null>(null);
  const [members, setMembers] = useState<MemberState>(EMPTY_MEMBERS);
  const [invites, setInvites] = useState<InviteState>(EMPTY_INVITES);
  const [actionError, setActionError] = useState<string | null>(null);
  const [inviteFormOpen, setInviteFormOpen] = useState(false);
  const [createdInviteUrl, setCreatedInviteUrl] = useState<string | null>(null);
  const [removeTarget, setRemoveTarget] = useState<MemberRecord | null>(null);
  const [transferTarget, setTransferTarget] = useState<MemberRecord | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<InviteRecord | null>(null);

  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);

  const loadDetail = useCallback(async () => {
    if (!activeWorkspaceId) return;
    try {
      const result = await fetchOrganization(activeWorkspaceId);
      setDetail(result.organization);
    } catch (error) {
      setActionError(errorMessage(error));
    }
  }, [activeWorkspaceId]);

  const loadMembers = useCallback(async () => {
    if (!activeWorkspaceId) return;
    setMembers((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const page = await fetchMembers(activeWorkspaceId, { limit: 50 });
      setMembers({ loading: false, error: null, items: page.items, nextCursor: page.nextCursor });
    } catch (error) {
      setMembers((prev) => ({ ...prev, loading: false, error: errorMessage(error) }));
    }
  }, [activeWorkspaceId]);

  const loadInvites = useCallback(async () => {
    if (!activeWorkspaceId) return;
    setInvites((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const page = await fetchInvites(activeWorkspaceId, { limit: 50 });
      setInvites({ loading: false, error: null, items: page.items });
    } catch (error) {
      setInvites((prev) => ({ ...prev, loading: false, error: errorMessage(error) }));
    }
  }, [activeWorkspaceId]);

  useEffect(() => {
    void loadDetail();
    void loadMembers();
  }, [loadDetail, loadMembers]);

  useEffect(() => {
    if (detail?.myRole === 'admin') void loadInvites();
  }, [detail?.myRole, loadInvites]);

  const isAdmin = detail?.myRole === 'admin';
  const isOwner = detail?.isOwner ?? false;

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
      setMembers((prev) => ({
        ...prev,
        items: prev.items.map((item) =>
          item.userId === member.userId ? { ...item, role } : item,
        ),
      }));
    });

  const handleRemove = async () => {
    if (!removeTarget) return;
    await runAction(async () => {
      await removeMemberRequest(activeWorkspaceId, removeTarget.userId);
      setMembers((prev) => ({
        ...prev,
        items: prev.items.filter((item) => item.userId !== removeTarget.userId),
      }));
    });
    setRemoveTarget(null);
  };

  const handleTransfer = async () => {
    if (!transferTarget) return;
    await runAction(async () => {
      await transferOwnerRequest(activeWorkspaceId, transferTarget.userId);
      await loadDetail();
      await loadMembers();
    });
    setTransferTarget(null);
  };

  const handleRevoke = async () => {
    if (!revokeTarget) return;
    await runAction(async () => {
      await revokeInviteRequest(activeWorkspaceId, revokeTarget.id);
      setInvites((prev) => ({
        ...prev,
        items: prev.items.map((item) =>
          item.id === revokeTarget.id ? { ...item, status: 'revoked' as const } : item,
        ),
      }));
    });
    setRevokeTarget(null);
  };

  const loadMoreMembers = async () => {
    if (!members.nextCursor) return;
    try {
      const page = await fetchMembers(activeWorkspaceId, {
        cursor: members.nextCursor,
        limit: 50,
      });
      setMembers((prev) => ({
        ...prev,
        items: [...prev.items, ...page.items],
        nextCursor: page.nextCursor,
      }));
    } catch (error) {
      setMembers((prev) => ({ ...prev, error: errorMessage(error) }));
    }
  };

  return (
    <div className="flex-1 h-full overflow-y-auto bg-background">
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-7 space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground tracking-tight">成员</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {detail?.name ?? '当前组织'} · 共 {members.items.length} 名成员
            </p>
          </div>
          {isAdmin && (
            <Button size="sm" onClick={() => setInviteFormOpen(true)}>
              <UserPlus size={15} className="mr-1.5" />
              邀请成员
            </Button>
          )}
        </div>

        {actionError && (
          <div
            role="alert"
            className="flex items-center justify-between rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-2.5 text-[13px] text-destructive"
          >
            <span>{actionError}</span>
            <button type="button" onClick={() => setActionError(null)} aria-label="关闭">
              <X size={14} />
            </button>
          </div>
        )}

        {/* 成员名单 */}
        <section className="space-y-3">
          <h2 className="text-[14px] font-semibold text-foreground">成员名单</h2>
          {members.loading ? (
            <PageSkeleton variant="rows" />
          ) : members.error ? (
            <PageError message={members.error} onRetry={() => void loadMembers()} />
          ) : (
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-[12px] text-muted-foreground">
                    <th className="px-4 py-2.5 font-medium">成员</th>
                    <th className="px-4 py-2.5 font-medium">角色</th>
                    <th className="px-4 py-2.5 font-medium">加入时间</th>
                    {isAdmin && <th className="px-4 py-2.5 font-medium">操作</th>}
                  </tr>
                </thead>
                <tbody>
                  {members.items.map((member) => (
                    <tr key={member.userId} className="border-b border-border last:border-0">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-foreground">
                            {member.name || member.email}
                          </span>
                          {member.isOwner && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-600 dark:text-amber-400">
                              <Crown size={11} />
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
                          <select
                            value={member.role}
                            onChange={(event) =>
                              handleChangeRole(
                                member,
                                event.target.value as MemberRecord['role'],
                              )
                            }
                            className="h-8 rounded-md border border-input bg-background px-2 text-[13px] text-foreground"
                            aria-label={`${member.name} 的角色`}
                          >
                            {(Object.keys(ROLE_LABELS) as MemberRecord['role'][]).map(
                              (value) => (
                                <option key={value} value={value}>
                                  {ROLE_LABELS[value]}
                                </option>
                              ),
                            )}
                          </select>
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
                          <div className="flex items-center gap-2">
                            {isOwner && !member.isOwner && (
                              <button
                                type="button"
                                className="text-[13px] text-primary hover:underline"
                                onClick={() => setTransferTarget(member)}
                              >
                                设为所有者
                              </button>
                            )}
                            {!member.isOwner && (
                              <button
                                type="button"
                                className="inline-flex items-center gap-1 text-[13px] text-destructive hover:underline"
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
              {members.nextCursor && (
                <div className="flex justify-center border-t border-border py-2">
                  <Button variant="ghost" size="sm" onClick={() => void loadMoreMembers()}>
                    加载更多
                  </Button>
                </div>
              )}
            </div>
          )}
        </section>

        {/* 邀请列表（仅管理员可见，与 C3 权限矩阵一致） */}
        {isAdmin && (
          <section className="space-y-3">
            <h2 className="text-[14px] font-semibold text-foreground">邀请</h2>
            {invites.loading ? (
              <PageSkeleton variant="rows" />
            ) : invites.error ? (
              <PageError message={invites.error} onRetry={() => void loadInvites()} />
            ) : invites.items.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-card px-6 py-8 text-center text-[13px] text-muted-foreground">
                暂无待处理邀请
              </div>
            ) : (
              <div className="rounded-xl border border-border bg-card overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-[12px] text-muted-foreground">
                      <th className="px-4 py-2.5 font-medium">邮箱</th>
                      <th className="px-4 py-2.5 font-medium">角色</th>
                      <th className="px-4 py-2.5 font-medium">状态</th>
                      <th className="px-4 py-2.5 font-medium">创建时间</th>
                      <th className="px-4 py-2.5 font-medium">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invites.items.map((invite) => (
                      <tr
                        key={invite.id}
                        className="border-b border-border last:border-0"
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
                              className="text-[13px] text-destructive hover:underline"
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
            void loadInvites();
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

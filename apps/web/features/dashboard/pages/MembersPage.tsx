import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Trash2, UserPlus, X } from 'lucide-react';
import { useWorkspaceStore } from '../../../store/useWorkspaceStore';
import { WorkspaceMember } from '../../../types';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';

const MembersPage: React.FC = () => {
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const members = useWorkspaceStore((s) => s.members);
  const searchQuery = useWorkspaceStore((s) => s.searchQuery);
  const inviteMember = useWorkspaceStore((s) => s.inviteMember);
  const updateMemberRole = useWorkspaceStore((s) => s.updateMemberRole);
  const removeMember = useWorkspaceStore((s) => s.removeMember);

  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<WorkspaceMember['role']>('编辑者');

  const activeWorkspace =
    workspaces.find((w) => w.id === activeWorkspaceId) || workspaces[0];

  const q = searchQuery.trim().toLowerCase();
  const wsMembers = members.filter(
    (m) =>
      m.workspaceId === activeWorkspaceId &&
      (!q ||
        m.name.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q))
  );

  const handleInviteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteName.trim() || !inviteEmail.trim()) return;
    inviteMember({
      name: inviteName,
      email: inviteEmail,
      role: inviteRole,
    });
    setInviteName('');
    setInviteEmail('');
    setInviteRole('编辑者');
    setIsInviteOpen(false);
  };

  const roles: WorkspaceMember['role'][] = ['所有者', '管理员', '编辑者', '查看者'];

  return (
    <div className="flex-1 h-full overflow-y-auto bg-background">
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-6 space-y-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold text-foreground">成员和团队</h1>
            <p className="text-[13px] text-muted-foreground mt-0.5">
              管理「{activeWorkspace?.name}」的成员访问权限与协作角色（共{' '}
              <span className="tabular-nums font-medium">{wsMembers.length}</span> 人）
            </p>
          </div>
          <Button
            size="sm"
            onClick={() => setIsInviteOpen(true)}
            className="h-8 text-[13px] gap-1.5 whitespace-nowrap"
          >
            <UserPlus size={14} /> 邀请成员
          </Button>
        </div>

        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-[13px] font-semibold text-foreground/80">
                  <th className="py-2.5 px-4">成员</th>
                  <th className="py-2.5 px-4">邮箱</th>
                  <th className="py-2.5 px-4">角色</th>
                  <th className="py-2.5 px-4">加入日期</th>
                  <th className="py-2.5 px-4 text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-[13px]">
                {wsMembers.map((member) => (
                  <tr
                    key={member.id}
                    className="hover:bg-muted/30 transition-colors"
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        <div
                          className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-semibold shrink-0"
                          style={{ backgroundColor: member.avatarColor }}
                        >
                          {member.name.slice(0, 1).toUpperCase()}
                        </div>
                        <span className="font-semibold text-foreground">
                          {member.name}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-muted-foreground">
                      {member.email}
                    </td>
                    <td className="py-3 px-4">
                      <select
                        value={member.role}
                        disabled={member.role === '所有者'}
                        onChange={(e) =>
                          updateMemberRole(
                            member.id,
                            e.target.value as WorkspaceMember['role']
                          )
                        }
                        className="h-7 px-2 rounded-md border border-border bg-background text-[13px] font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-65"
                      >
                        {roles.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-3 px-4 text-[13px] text-muted-foreground tabular-nums">
                      {member.joinedAt}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {member.role !== '所有者' && (
                        <button
                          type="button"
                          onClick={() => removeMember(member.id)}
                          className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                          title="移除成员"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {wsMembers.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="py-10 text-center text-xs text-muted-foreground"
                    >
                      暂无匹配的成员记录
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {isInviteOpen &&
        createPortal(
          <div className="fixed inset-0 z-[95] flex items-center justify-center p-4">
            <div
              className="fixed inset-0 bg-black/40 backdrop-blur-xs"
              onClick={() => setIsInviteOpen(false)}
            />
            <div className="relative z-10 w-full max-w-md rounded-xl border border-border bg-card shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
                <h3 className="text-sm font-semibold text-foreground">
                  邀请新成员加入工作区
                </h3>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 rounded-full"
                  onClick={() => setIsInviteOpen(false)}
                >
                  <X size={14} />
                </Button>
              </div>
              <form onSubmit={handleInviteSubmit} className="p-5 space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="invite-name">成员姓名</Label>
                  <Input
                    id="invite-name"
                    value={inviteName}
                    onChange={(e) => setInviteName(e.target.value)}
                    placeholder="例如：张敏"
                    autoFocus
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="invite-email">邮箱地址</Label>
                  <Input
                    id="invite-email"
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="member@company.com"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="invite-role">分配角色</Label>
                  <select
                    id="invite-role"
                    value={inviteRole}
                    onChange={(e) =>
                      setInviteRole(e.target.value as WorkspaceMember['role'])
                    }
                    className="w-full h-9 px-3 rounded-md border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="管理员">管理员</option>
                    <option value="编辑者">编辑者</option>
                    <option value="查看者">查看者</option>
                  </select>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsInviteOpen(false)}
                  >
                    取消
                  </Button>
                  <Button type="submit" size="sm" className="gap-1">
                    <Plus size={14} /> 发送邀请
                  </Button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};

export default MembersPage;

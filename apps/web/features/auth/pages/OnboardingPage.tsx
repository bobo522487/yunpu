import React, { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import AuthLayout from '../layouts/AuthLayout';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { errorMessage } from '../../../lib/api';
import { acceptInviteRequest, createOrganizationRequest } from '../api';
import { useAuthStore } from '../useAuthStore';

const OnboardingPage: React.FC = () => {
  const navigate = useNavigate();
  const status = useAuthStore((s) => s.status);
  const defaultOrganization = useAuthStore((s) => s.defaultOrganization);
  const refreshSession = useAuthStore((s) => s.refreshSession);

  const [name, setName] = useState('');
  const [token, setToken] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  if (status === 'anonymous') {
    return <Navigate to="/login" replace />;
  }

  if (status === 'authenticated' && defaultOrganization) {
    return <Navigate to="/" replace />;
  }

  const run = async (action: () => Promise<unknown>) => {
    setError(null);
    setIsLoading(true);
    try {
      await action();
      await refreshSession();
      navigate('/', { replace: true });
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout
      title="开始使用"
      subtitle="你还没有可用的组织。创建一个新组织，或接受邀请。"
    >
      {error && (
        <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          void run(() => createOrganizationRequest(name.trim()));
        }}
      >
        <h2 className="text-sm font-semibold text-foreground">创建组织</h2>
        <div className="space-y-2">
          <Label htmlFor="organizationName">组织名</Label>
          <Input
            id="organizationName"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="例如：我的谱牒工作室"
            maxLength={120}
            required
          />
        </div>
        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? '正在创建...' : '创建并进入工作区'}
        </Button>
      </form>

      <div className="my-6 border-t border-border" />

      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          void run(() => acceptInviteRequest(token.trim()));
        }}
      >
        <h2 className="text-sm font-semibold text-foreground">接受邀请</h2>
        <div className="space-y-2">
          <Label htmlFor="inviteToken">邀请 token</Label>
          <Input
            id="inviteToken"
            value={token}
            onChange={(event) => setToken(event.target.value)}
            required
          />
        </div>
        <Button type="submit" variant="outline" className="w-full" disabled={isLoading}>
          {isLoading ? '正在接受...' : '接受邀请'}
        </Button>
      </form>
    </AuthLayout>
  );
};

export default OnboardingPage;

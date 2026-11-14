import React, { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import AuthLayout from '../layouts/AuthLayout';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { useAuthStore } from '../useAuthStore';

const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const status = useAuthStore((s) => s.status);
  const error = useAuthStore((s) => s.error);
  const signUp = useAuthStore((s) => s.signUp);
  const clearError = useAuthStore((s) => s.clearError);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [inviteToken, setInviteToken] = useState(
    () => new URLSearchParams(location.search).get('invite') ?? '',
  );
  const [isLoading, setIsLoading] = useState(false);

  if (status === 'authenticated') {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    setIsLoading(true);
    try {
      await signUp(email.trim(), password, inviteToken.trim() || undefined);
      navigate('/', { replace: true });
    } catch {
      // The store exposes the API error message below the form.
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout
      title="创建账号"
      subtitle="使用邮箱注册，注册后会自动创建你的默认组织"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}
        <div className="space-y-2">
          <Label htmlFor="email">邮箱地址</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@example.com"
            autoComplete="email"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">设置密码</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="至少 8 位字符"
            autoComplete="new-password"
            minLength={8}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="inviteToken">
            邀请 token <span className="text-muted-foreground">（可选）</span>
          </Label>
          <Input
            id="inviteToken"
            value={inviteToken}
            onChange={(e) => setInviteToken(e.target.value)}
            placeholder="从邀请链接带入"
          />
        </div>
        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? '正在创建...' : '注册并进入工作区'}
        </Button>
      </form>

      <div className="mt-6 text-center text-sm">
        <span className="text-muted-foreground">已有账号？</span>
        <Link to="/login" className="font-medium text-primary hover:underline ml-1">
          直接登录
        </Link>
      </div>
    </AuthLayout>
  );
};

export default RegisterPage;

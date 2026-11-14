import React, { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Github, Mail } from 'lucide-react';
import AuthLayout from '../layouts/AuthLayout';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { usePreferencesStore } from '../../../store/usePreferencesStore';

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const isAuthenticated = usePreferencesStore((s) => s.isAuthenticated);
  const defaultEmail = usePreferencesStore((s) => s.user.email);
  const login = usePreferencesStore((s) => s.login);

  const [email, setEmail] = useState(defaultEmail || 'bobo522487@gmail.com');
  const [password, setPassword] = useState('••••••••');
  const [isLoading, setIsLoading] = useState(false);

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  const from = (location.state as { from?: string } | null)?.from || '/';

  const completeLogin = () => {
    const derivedName = email.includes('@') ? email.split('@')[0] : undefined;
    login({
      email,
      name: email === 'bobo522487@gmail.com' ? '电波' : derivedName,
    });
    navigate(from, { replace: true });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      completeLogin();
    }, 350);
  };

  return (
    <AuthLayout
      title="欢迎回来"
      subtitle="登录你的工作区，管理项目、数据表与应用"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">邮箱地址</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@example.com"
            required
          />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">密码</Label>
            <Link
              to="/forgot-password"
              className="text-xs text-primary hover:underline font-medium"
            >
              忘记密码？
            </Link>
          </div>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? '正在登录...' : '登录工作区'}
        </Button>
      </form>

      <div className="mt-6">
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-card px-2 text-muted-foreground">或使用以下方式继续</span>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={completeLogin}
          >
            <Github className="mr-2 h-4 w-4" />
            GitHub
          </Button>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={completeLogin}
          >
            <Mail className="mr-2 h-4 w-4" />
            Google
          </Button>
        </div>
      </div>

      <div className="mt-6 text-center text-sm">
        <span className="text-muted-foreground">还没有账号？</span>
        <Link to="/register" className="font-medium text-primary hover:underline ml-1">
          立即注册
        </Link>
      </div>
    </AuthLayout>
  );
};

export default LoginPage;
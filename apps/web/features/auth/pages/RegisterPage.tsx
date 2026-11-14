import React, { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import AuthLayout from '../layouts/AuthLayout';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { usePreferencesStore } from '../../../store/usePreferencesStore';

const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const isAuthenticated = usePreferencesStore((s) => s.isAuthenticated);
  const login = usePreferencesStore((s) => s.login);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      login({ name: name || '新用户', email });
      navigate('/', { replace: true });
    }, 350);
  };

  return (
    <AuthLayout
      title="创建账号"
      subtitle="填写以下信息以创建你的工作区账号"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">昵称 / 姓名</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例如：电波"
            required
          />
        </div>
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
          <Label htmlFor="password">设置密码</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="至少 6 位字符"
            required
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
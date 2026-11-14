import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import AuthLayout from '../layouts/AuthLayout';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';

const ForgotPasswordPage: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      setIsSubmitted(true);
    }, 500);
  };

  return (
    <AuthLayout
      title="重置密码"
      subtitle="输入你的注册邮箱，我们将发送密码重置链接"
    >
      {!isSubmitted ? (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">邮箱地址</Label>
            <Input id="email" type="email" placeholder="name@example.com" required />
          </div>
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? '正在发送...' : '发送重置邮件'}
          </Button>
        </form>
      ) : (
        <div className="text-center space-y-4">
          <div className="p-4 bg-primary/10 rounded-lg text-sm text-foreground border border-primary/20">
            重置链接已发送至你的邮箱。如果几分钟内未收到，请检查垃圾邮件箱。
          </div>
        </div>
      )}

      <div className="mt-6 text-center text-sm">
        <Link to="/login" className="font-medium text-primary hover:underline inline-flex items-center">
          <ArrowLeft size={14} className="mr-1.5" /> 返回登录
        </Link>
      </div>
    </AuthLayout>
  );
};

export default ForgotPasswordPage;
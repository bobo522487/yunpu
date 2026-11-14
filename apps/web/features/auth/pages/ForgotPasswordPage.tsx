import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import AuthLayout from '../layouts/AuthLayout';

const ForgotPasswordPage: React.FC = () => {
  return (
    <AuthLayout
      title="重置密码"
      subtitle="当前版本暂不支持自助找回密码"
    >
      <div className="space-y-4 text-sm text-muted-foreground">
        <p>
          请联系你的组织管理员重置密码。管理员可以在账号安全设置中为你生成新的临时密码。
        </p>
        <p>
          如果你还没有加入任何组织，请使用注册邮箱联系支持人员。
        </p>
      </div>

      <div className="mt-6 text-center text-sm">
        <Link to="/login" className="font-medium text-primary hover:underline inline-flex items-center">
          <ArrowLeft size={14} className="mr-1.5" /> 返回登录
        </Link>
      </div>
    </AuthLayout>
  );
};

export default ForgotPasswordPage;

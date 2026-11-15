import React from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from '../../../components/ui/button';

type Props = {
  message?: string;
  onRetry: () => void;
  className?: string;
};

/**
 * 页内加载失败态：错误 + 「重试」。
 * 重试只重发读请求（由调用方的 onRetry 保证），不清空既有数据、不跳登录
 * （会话失效的 401 由全局处理，见 contracts/ui-states.md §1）。
 */
const PageError: React.FC<Props> = ({
  message = '加载失败，请稍后重试',
  onRetry,
  className = '',
}) => (
  <div
    role="alert"
    className={`flex flex-col items-center justify-center gap-3 rounded-lg border border-border bg-card px-6 py-10 text-center ${className}`}
  >
    <p className="text-sm text-muted-foreground">{message}</p>
    <Button variant="outline" size="sm" onClick={onRetry}>
      <RefreshCw size={14} className="mr-1.5" />
      重试
    </Button>
  </div>
);

export default PageError;

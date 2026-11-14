
import React, { useState } from 'react';
import { Search, Database, Globe, FileSpreadsheet, CreditCard, HardDrive, Bot, Hexagon, Server, Cloud, LayoutGrid, Mail, Box } from 'lucide-react';
import { Input } from "../../../components/ui/input";
import { Button } from "../../../components/ui/button";
import { useNavigate } from 'react-router-dom';
import { useRouteContext } from "../../../hooks/useRouteContext";

interface DataSource {
  id: string;
  name: string;
  icon: React.ElementType;
  color: string;
  bgColor?: string;
}

const CATEGORIES: { title: string; items: DataSource[] }[] = [
  {
    title: "常用数据源",
    items: [
      { id: 'rest', name: 'REST API', icon: Globe, color: 'text-blue-500', bgColor: 'bg-blue-500/10' },
      { id: 'postgres', name: 'PostgreSQL', icon: Database, color: 'text-blue-600', bgColor: 'bg-blue-600/10' },
      { id: 'google-sheets', name: 'Google Sheets', icon: FileSpreadsheet, color: 'text-green-600', bgColor: 'bg-green-600/10' },
      { id: 'mysql', name: 'MySQL', icon: Database, color: 'text-orange-500', bgColor: 'bg-orange-500/10' },
      { id: 'airtable', name: 'Airtable', icon: Hexagon, color: 'text-yellow-500', bgColor: 'bg-yellow-500/10' },
    ]
  },
  {
    title: "关系型与文档数据库",
    items: [
      { id: 'postgres', name: 'PostgreSQL', icon: Database, color: 'text-blue-600', bgColor: 'bg-blue-600/10' },
      { id: 'mysql', name: 'MySQL', icon: Database, color: 'text-orange-500', bgColor: 'bg-orange-500/10' },
      { id: 'mongodb', name: 'MongoDB', icon: Database, color: 'text-green-500', bgColor: 'bg-green-500/10' },
      { id: 'redis', name: 'Redis', icon: Database, color: 'text-red-600', bgColor: 'bg-red-600/10' },
      { id: 'mssql', name: 'SQL Server', icon: Server, color: 'text-red-700', bgColor: 'bg-red-700/10' },
      { id: 'snowflake', name: 'Snowflake', icon: Cloud, color: 'text-sky-500', bgColor: 'bg-sky-500/10' },
      { id: 'mariadb', name: 'MariaDB', icon: Database, color: 'text-amber-600', bgColor: 'bg-amber-600/10' },
    ]
  },
  {
    title: "API 与第三方服务",
    items: [
      { id: 'rest', name: 'REST API', icon: Globe, color: 'text-blue-500', bgColor: 'bg-blue-500/10' },
      { id: 'graphql', name: 'GraphQL', icon: Hexagon, color: 'text-pink-500', bgColor: 'bg-pink-500/10' },
      { id: 'stripe', name: 'Stripe', icon: CreditCard, color: 'text-indigo-500', bgColor: 'bg-indigo-500/10' },
      { id: 'google-sheets', name: 'Google Sheets', icon: FileSpreadsheet, color: 'text-green-600', bgColor: 'bg-green-600/10' },
      { id: 'airtable', name: 'Airtable', icon: Hexagon, color: 'text-yellow-500', bgColor: 'bg-yellow-500/10' },
      { id: 'sendgrid', name: 'SendGrid', icon: Mail, color: 'text-blue-400', bgColor: 'bg-blue-400/10' },
    ]
  },
  {
    title: "AI 与向量数据库",
    items: [
      { id: 'openai', name: 'OpenAI', icon: Bot, color: 'text-teal-600', bgColor: 'bg-teal-600/10' },
      { id: 'gemini', name: 'Gemini', icon: Bot, color: 'text-blue-500', bgColor: 'bg-blue-500/10' },
      { id: 'anthropic', name: 'Anthropic', icon: Bot, color: 'text-purple-500', bgColor: 'bg-purple-500/10' },
      { id: 'pinecone', name: 'Pinecone', icon: Box, color: 'text-cyan-500', bgColor: 'bg-cyan-500/10' },
    ]
  },
  {
    title: "对象存储",
    items: [
      { id: 's3', name: 'AWS S3', icon: HardDrive, color: 'text-orange-600', bgColor: 'bg-orange-600/10' },
      { id: 'gcs', name: 'Google Cloud Storage', icon: HardDrive, color: 'text-blue-500', bgColor: 'bg-blue-500/10' },
      { id: 'minio', name: 'Minio', icon: HardDrive, color: 'text-red-500', bgColor: 'bg-red-500/10' },
    ]
  }
];

const DataSourcePage = () => {
  const navigate = useNavigate();
  const { activeProjectId } = useRouteContext();
  const [searchTerm, setSearchTerm] = useState('');

  const filteredCategories = CATEGORIES.map(cat => ({
    ...cat,
    items: cat.items.filter(item => 
      item.name.toLowerCase().includes(searchTerm.toLowerCase())
    )
  })).filter(cat => cat.items.length > 0);

  const handleSourceClick = (sourceId: string) => {
      if (sourceId === 'postgres') {
          navigate(`/projects/${activeProjectId}/datasources/postgresql`);
      } else {
          navigate(`/projects/${activeProjectId}`); 
      }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-background overflow-y-auto">
      <div className="container max-w-[1200px] mx-auto py-8 px-6">
        
        <div className="mb-8">
          <h1 className="text-xl font-bold tracking-tight text-foreground mb-1.5">添加数据源</h1>
          <p className="text-sm text-muted-foreground">连接数据库、API 接口或第三方云服务。</p>
        </div>

        {/* Search */}
        <div className="mb-10 relative">
             <div className="relative max-w-2xl">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input 
                    placeholder="搜索数据源（例如 PostgreSQL、MySQL、REST API）..." 
                    className="pl-10 h-11 bg-muted/20 border-muted-foreground/20 text-sm focus-visible:ring-primary"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    autoFocus
                />
             </div>
        </div>

        {/* Categories */}
        <div className="space-y-10">
            {filteredCategories.map((category) => (
                <div key={category.title}>
                    <h3 className="text-[14px] font-semibold text-foreground/85 mb-4">{category.title}</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                        {category.items.map((source, idx) => (
                            <div 
                                key={`${source.id}-${idx}`}
                                className="group relative flex flex-col items-center justify-center p-6 bg-card border border-border rounded-xl hover:border-primary/50 hover:shadow-sm transition-all cursor-pointer h-[140px]"
                                onClick={() => handleSourceClick(source.id)}
                            >
                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110 duration-200 ${source.bgColor || 'bg-muted'}`}>
                                    <source.icon size={28} className={source.color} strokeWidth={1.5} />
                                </div>
                                <span className="text-[14px] font-semibold text-foreground text-center">{source.name}</span>
                                
                                {/* Hover Overlay / Button */}
                                <div className="absolute inset-0 bg-card/90 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-xl backdrop-blur-[1px]">
                                    <Button variant="default" size="sm" className="shadow-sm">
                                        选择连接
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ))}

            {filteredCategories.length === 0 && (
                <div className="text-center py-20 text-[14px] text-muted-foreground">
                    未找到与 “{searchTerm}” 匹配的数据源
                </div>
            )}
        </div>

      </div>
    </div>
  );
};

export default DataSourcePage;

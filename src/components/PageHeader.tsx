import React from 'react';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  extra?: React.ReactNode;
}

// 统一页头：标题 + 副标题 + 右侧操作区，建立清晰的信息层级
const PageHeader: React.FC<PageHeaderProps> = ({ title, subtitle, extra }) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      gap: 16,
      flexWrap: 'wrap',
      marginBottom: 20,
    }}
  >
    <div style={{ minWidth: 0 }}>
      <h1 className="page-title">{title}</h1>
      {subtitle && <p className="page-subtitle">{subtitle}</p>}
    </div>
    {extra && <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>{extra}</div>}
  </div>
);

export default PageHeader;

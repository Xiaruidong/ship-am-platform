import React from 'react';
import { Button } from 'antd';
import { useNavigate } from 'react-router-dom';

// 展示态首页：嵌入去中心化增材制造态势大屏（静态演示目录 public/screen）
const ScreenHome: React.FC = () => {
  const navigate = useNavigate();
  return (
    <div style={{ position: 'fixed', inset: 0, background: '#01040B', overflow: 'hidden' }}>
      <iframe
        src="/screen/index.html"
        title="多中心化协同态势大屏"
        style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
        allow="autoplay; fullscreen"
      />
      {/* 浏览器层面兜底入口（大屏页面内顶栏已有主入口） */}
      <Button
        size="small"
        onClick={() => navigate('/workbench')}
        style={{
          position: 'fixed', left: 12, bottom: 12, zIndex: 60,
          background: 'rgba(0,120,220,.22)', borderColor: 'rgba(51,214,255,.5)',
          color: '#BFE9FF', fontSize: 12,
        }}
      >
        管理工作台 →
      </Button>
    </div>
  );
};

export default ScreenHome;

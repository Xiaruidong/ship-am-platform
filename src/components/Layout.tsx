import React, { useState } from 'react';
import { Layout as AntLayout, Menu, Input } from 'antd';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  DashboardOutlined,
  GoldOutlined,
  AppstoreOutlined,
  ToolOutlined,
  ExperimentOutlined,
  FileTextOutlined,
  ShoppingCartOutlined,
  RocketOutlined,
  DesktopOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import type { MenuProps } from 'antd';

const { Header, Sider, Content } = AntLayout;

type MenuItem = Required<MenuProps>['items'][number];

function getItem(
  label: React.ReactNode,
  key: React.Key,
  icon?: React.ReactNode,
  children?: MenuItem[],
): MenuItem {
  return { key, icon, children, label } as MenuItem;
}

const items: MenuItem[] = [
  getItem('数据仪表盘', '/workbench', <DashboardOutlined />),
  getItem('金属原材料', '/materials', <GoldOutlined />),
  getItem('零部件模型', '/parts', <AppstoreOutlined />),
  getItem('增材设备', '/equipment', <ToolOutlined />),
  getItem('检测数据', '/inspection', <ExperimentOutlined />),
  getItem('订单管理', '/orders', <ShoppingCartOutlined />),
  getItem('标准数据', '/standards', <FileTextOutlined />),
  getItem('订单派发应用', '/dispatch', <RocketOutlined />),
  getItem('指挥大屏', '/', <DesktopOutlined />),
];

const pathToKey: Record<string, string> = {
  '/workbench': '/workbench',
  '/materials': '/materials',
  '/parts': '/parts',
  '/equipment': '/equipment',
  '/inspection': '/inspection',
  '/orders': '/orders',
  '/standards': '/standards',
  '/dispatch': '/dispatch',
};

const LayoutComponent: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const [searchValue, setSearchValue] = useState('');

  const selectedKey = pathToKey[location.pathname] || '/';

  const handleMenuClick: MenuProps['onClick'] = (e) => {
    navigate(e.key);
  };

  const handleSearch = (value: string) => {
    if (value.trim()) {
      navigate(`/workbench?search=${encodeURIComponent(value.trim())}`);
    }
  };

  return (
    <AntLayout style={{ minHeight: '100vh' }}>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={(value) => setCollapsed(value)}
        theme="light"
        width={240}
        breakpoint="lg"
        style={{
          borderRight: '1px solid #E6E9EE',
          position: 'sticky',
          top: 0,
          height: '100vh',
          overflow: 'auto',
          zIndex: 10,
        }}
      >
        <div
          style={{
            height: 64,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            justifyContent: collapsed ? 'center' : 'flex-start',
            padding: collapsed ? '0 8px' : '0 20px',
            borderBottom: '1px solid #E6E9EE',
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              flexShrink: 0,
              borderRadius: 4,
              background: '#006DEA',
              color: '#fff',
              fontSize: 13,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              letterSpacing: '-0.02em',
            }}
          >
            AM
          </div>
          {!collapsed && (
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#1A1A1A', whiteSpace: 'nowrap' }}>
                增材制造数据平台
              </div>
              <div style={{ fontSize: 11, color: '#97A0AD', whiteSpace: 'nowrap' }}>
                Shipbuilding AM Database
              </div>
            </div>
          )}
        </div>
        <Menu
          mode="inline"
          selectedKeys={[selectedKey]}
          items={items}
          onClick={handleMenuClick}
          style={{ borderRight: 0, paddingTop: 8 }}
        />
      </Sider>
      <AntLayout>
        <Header
          style={{
            background: 'rgba(255, 255, 255, 0.9)',
            backdropFilter: 'saturate(180%) blur(8px)',
            padding: '0 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            borderBottom: '1px solid #E6E9EE',
            position: 'sticky',
            top: 0,
            zIndex: 9,
            height: 64,
          }}
        >
          <Input.Search
            placeholder="全局搜索：材料牌号、零部件名称、标准编号..."
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            onSearch={handleSearch}
            prefix={<SearchOutlined style={{ color: '#97A0AD' }} />}
            style={{ width: '100%', maxWidth: 380 }}
            allowClear
          />
        </Header>
        <Content style={{ overflowX: 'hidden' }}>
          <div className="page-container">
            <Outlet />
          </div>
        </Content>
      </AntLayout>
    </AntLayout>
  );
};

export default LayoutComponent;

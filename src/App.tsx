import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Materials from './pages/Materials';
import Parts from './pages/Parts';
import Equipment from './pages/Equipment';
import Inspection from './pages/Inspection';
import Orders from './pages/Orders';
import Standards from './pages/Standards';
import DispatchHome from './dispatch/DispatchHome';
import DispatchDecision from './dispatch/DispatchDecision';
import DataLibrary from './dispatch/DataLibrary';
import AiAssistant from './dispatch/AiAssistant';
import Settings from './dispatch/Settings';
import OrderDetail from './dispatch/OrderDetail';
import Demands from './dispatch/Demands';
import NodeWorkbench from './dispatch/NodeWorkbench';
import NodeAdmin from './dispatch/NodeAdmin';
import NodeClient from './dispatch/NodeClient';
import DispatchOrders from './dispatch/DispatchOrders';
import DemoTheater from './dispatch/DemoTheater';
import ScreenHome from './pages/ScreenHome';

const App: React.FC = () => {
  return (
    <Routes>
      {/* 默认首页：多中心化协同态势大屏（展示态） */}
      <Route path="/" element={<ScreenHome />} />
      <Route element={<Layout />}>
        <Route path="/workbench" element={<Dashboard />} />
        <Route path="/materials" element={<Materials />} />
        <Route path="/parts" element={<Parts />} />
        <Route path="/equipment" element={<Equipment />} />
        <Route path="/inspection" element={<Inspection />} />
        <Route path="/orders" element={<Orders />} />
        <Route path="/standards" element={<Standards />} />
      </Route>
      {/* 订单派发应用（独立外壳，数据来自 dispatch_app） */}
      <Route path="/dispatch" element={<DispatchHome />} />
      <Route path="/dispatch/decision" element={<DispatchDecision />} />
      <Route path="/dispatch/library" element={<DataLibrary />} />
      <Route path="/dispatch/ai" element={<AiAssistant />} />
      <Route path="/dispatch/settings" element={<Settings />} />
      <Route path="/dispatch/order/:id" element={<OrderDetail />} />
      <Route path="/dispatch/demands" element={<Demands />} />
      <Route path="/dispatch/nodes" element={<NodeWorkbench />} />
      <Route path="/dispatch/node-admin" element={<NodeAdmin />} />
      <Route path="/dispatch/node-client" element={<NodeClient />} />
      <Route path="/dispatch/orders" element={<DispatchOrders />} />
      <Route path="/dispatch/demo" element={<DemoTheater />} />
    </Routes>
  );
};

export default App;

import React, { useState } from 'react';
import { Card, Form, Input, Button, Select, Alert, Tag, App } from 'antd';
import DispatchShell from './DispatchShell';
import './dispatch.css';

interface LlmConfig { baseUrl: string; apiKey: string; model: string }

const DEFAULTS: LlmConfig = { baseUrl: 'https://api.deepseek.com/v1', apiKey: '', model: 'deepseek-chat' };
const STORE_KEY = 'dispatch_llm_config';

const load = (): LlmConfig => {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(STORE_KEY) || '{}') }; } catch { return { ...DEFAULTS }; }
};

const Settings: React.FC = () => {
  const { message } = App.useApp();
  const [form] = Form.useForm<LlmConfig>();
  const [saved, setSaved] = useState(!!load().apiKey);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string>('');

  const save = async () => {
    const v = await form.validateFields();
    localStorage.setItem(STORE_KEY, JSON.stringify(v));
    setSaved(!!v.apiKey);
    message.success('配置已保存到本浏览器（localStorage）');
  };

  const test = async () => {
    const v = await form.validateFields();
    setTesting(true); setTestResult('');
    try {
      const res = await fetch('/dapi/ai/recommend', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: '柴油机缸体裂纹，紧急维修 1 件', llm: v.apiKey ? v : undefined }),
      });
      const d = await res.json();
      setTestResult(`${d.intent?.source === 'llm' ? '✅ 大模型解析成功' : '⚠️ 未使用大模型（未配置或调用失败，已回退规则匹配）'} · 识别零部件：${d.chain?.part?.part_name || '未匹配'}`);
    } catch (e) {
      setTestResult(`❌ 测试失败：${e instanceof Error ? e.message : '未知错误'}`);
    } finally {
      setTesting(false);
    }
  };

  return (
    <DispatchShell>
      <div className="dp-modtitle" style={{ marginBottom: 4 }}>系统设置</div>
      <div style={{ fontSize: 12, color: '#6F7785', marginBottom: 14 }}>
        大模型配置用于 AI 智能匹配助手的意图解析；未配置时系统自动使用规则匹配（功能不受影响）
      </div>

      <Card title="大模型配置（OpenAI 兼容接口）" styles={{ body: { padding: 20 } }} style={{ maxWidth: 720 }}>
        <Alert
          type="info" showIcon style={{ marginBottom: 16 }}
          message="API Key 仅保存在当前浏览器本地（localStorage），不会上传到服务器；调用时随请求透传，密钥由你自己保管。"
        />
        <Form form={form} layout="vertical" initialValues={load()}>
          <Form.Item label="接口地址（Base URL）" name="baseUrl" rules={[{ required: true }]}>
            <Input placeholder="https://api.deepseek.com/v1" />
          </Form.Item>
          <Form.Item label="API Key" name="apiKey" extra="留空则仅使用规则匹配">
            <Input.Password placeholder="sk-..." autoComplete="off" />
          </Form.Item>
          <Form.Item label="模型名称" name="model">
            <Select
              showSearch
              options={[
                { value: 'deepseek-chat', label: 'deepseek-chat（DeepSeek）' },
                { value: 'deepseek-reasoner', label: 'deepseek-reasoner（DeepSeek）' },
                { value: 'qwen-plus', label: 'qwen-plus（通义千问）' },
                { value: 'qwen-max', label: 'qwen-max（通义千问）' },
                { value: 'glm-4-flash', label: 'glm-4-flash（智谱）' },
                { value: 'moonshot-v1-8k', label: 'moonshot-v1-8k（Kimi）' },
              ]}
            />
          </Form.Item>
          <Form.Item>
            <Button type="primary" onClick={save}>保存配置</Button>
          </Form.Item>
        </Form>
        <div style={{ borderTop: '1px solid #F1F3F5', paddingTop: 14 }}>
          <SpaceWrap>
            <Button onClick={test} loading={testing}>测试连通性</Button>
            <span style={{ fontSize: 12, color: '#6F7785' }}>当前状态：</span>
            {saved ? <Tag color="green">已配置 API Key</Tag> : <Tag>未配置（规则匹配模式）</Tag>}
          </SpaceWrap>
          {testResult && <div style={{ marginTop: 10, fontSize: 13 }}>{testResult}</div>}
        </div>
      </Card>

      <div style={{ fontSize: 12, color: '#6F7785', marginTop: 12 }}>
        常见配置：DeepSeek 为 <code>https://api.deepseek.com/v1</code>；通义千问兼容模式为 <code>https://dashscope.aliyuncs.com/compatible-mode/v1</code>；智谱为 <code>https://open.bigmodel.cn/api/paas/v4</code>。
      </div>
    </DispatchShell>
  );
};

const SpaceWrap: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>{children}</div>
);

export default Settings;

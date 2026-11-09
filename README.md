# 船舶增材制造数据共享平台 · 去中心化智能协同系统

船舶增材制造（3D 打印）数据共享与订单协同派发平台。
**在线演示（大屏静态版）**：见 GitHub Pages 页面 —— 指挥大屏可完整浏览（地图 / 节点库 / 任务库 / 模型库 / 任务详情三级下钻），数据接口未部署时自动降级为内置演示数据。

## 组成

| 目录 | 说明 |
|---|---|
| `public/screen/` | 指挥大屏（纯 HTML/CSS/JS，1920×1080），GitHub Pages 发布内容 |
| `src/` | React 管理工作台（订单派发、需求单、节点运维、节点端、打印机对接） |
| `server/` | 数据资源库 API（材料/零部件/设备/质检/标准，Express + MySQL `am_database`，端口 3011） |
| `server-dispatch/` | 派发调度 API + 节点运维 + 拓竹打印机对接（Express + MySQL `dispatch_app`，端口 3002） |
| `docs/` | 设计文档（总体设计、PRD、任务拆解） |

## 本地运行

```bash
# 1. 启动 MySQL（需建 am_database / dispatch_app 两库并导入数据）
# 2. 启动两个后端
cd server && npm i && node src/index.js        # 3011
cd server-dispatch && npm i && node src/index.js  # 3002
# 3. 启动前端
npm install && npm run dev                     # 3000
```

- 大屏：http://localhost:3000/screen/index.html
- 管理工作台：http://localhost:3000/dispatch
- 节点运维后台：http://localhost:3000/dispatch/node-admin

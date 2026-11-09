-- 订单派发应用（dispatch_app）数据库结构
-- 八张核心表，与《首页 PRD》第 6 章 / 《任务二拆解 V2.1》表 4-1 对应

CREATE DATABASE IF NOT EXISTS dispatch_app
  DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE dispatch_app;

-- 节点注册表
CREATE TABLE IF NOT EXISTS node_registry (
  node_id          VARCHAR(32)  PRIMARY KEY,
  did              VARCHAR(64)  NOT NULL UNIQUE,
  node_type        TINYINT      NOT NULL COMMENT '1调度中心 2制造节点 3检测机构',
  node_name        VARCHAR(128) NOT NULL,
  location         VARCHAR(64)  NOT NULL,
  scene            VARCHAR(8)   NOT NULL DEFAULT '岸',
  status           VARCHAR(8)   NOT NULL DEFAULT '在线',
  device_count     TINYINT      NOT NULL DEFAULT 0,
  device_online    TINYINT      NOT NULL DEFAULT 0,
  load_rate        TINYINT      NOT NULL DEFAULT 0,
  last_heartbeat   DATETIME     NULL,
  capacity_profile JSON         NULL
) ENGINE=InnoDB;

-- 设备台账（扩展协议/在线字段）
CREATE TABLE IF NOT EXISTS equipment (
  equip_id    VARCHAR(32)  PRIMARY KEY,
  node_id     VARCHAR(32)  NOT NULL,
  equip_name  VARCHAR(255) NOT NULL,
  equip_type  VARCHAR(32)  NOT NULL DEFAULT 'SLM' COMMENT 'SLM/LPBF/EBM/机加',
  build_size_x DOUBLE      NOT NULL DEFAULT 0,
  laser_max_power DOUBLE   NOT NULL DEFAULT 0,
  protocol    VARCHAR(16)  NOT NULL DEFAULT 'OPC_UA',
  online      TINYINT      NOT NULL DEFAULT 1,
  status      VARCHAR(16)  NOT NULL DEFAULT '待机',
  INDEX idx_equip_node (node_id)
) ENGINE=InnoDB;

-- 需求单
CREATE TABLE IF NOT EXISTS demand_order (
  demand_id        VARCHAR(32)  PRIMARY KEY,
  source_type      TINYINT      NOT NULL DEFAULT 2 COMMENT '1终端上报 2Web录入 3API',
  scene            VARCHAR(8)   NOT NULL DEFAULT '岸',
  part_desc        VARCHAR(255) NOT NULL,
  matched_part_id  VARCHAR(32)  NULL,
  material_code    VARCHAR(32)  NOT NULL,
  quantity         INT          NOT NULL DEFAULT 1,
  priority         VARCHAR(8)   NOT NULL DEFAULT '普通',
  deadline         DATETIME     NULL,
  status           VARCHAR(16)  NOT NULL DEFAULT '待评审',
  attachments      JSON         NULL,
  created_by       VARCHAR(64)  NOT NULL DEFAULT '',
  created_at       DATETIME     NOT NULL
) ENGINE=InnoDB;

-- 派发订单（七态状态机）
CREATE TABLE IF NOT EXISTS dispatch_order (
  order_id           VARCHAR(32)  PRIMARY KEY,
  demand_id          VARCHAR(32)  NOT NULL,
  contract_space_id  VARCHAR(32)  NULL,
  part_id            VARCHAR(32)  NOT NULL,
  material_id        VARCHAR(32)  NOT NULL,
  quantity           INT          NOT NULL DEFAULT 1,
  priority           VARCHAR(8)   NOT NULL DEFAULT '普通',
  status             VARCHAR(16)  NOT NULL DEFAULT '待派单' COMMENT '待派单/已派单/生产中/质检中/已交付/已归档',
  progress           TINYINT      NOT NULL DEFAULT 0,
  required_delivery  DATETIME     NULL,
  delivered_at       DATETIME     NULL,
  abnormal_flag      TINYINT      NOT NULL DEFAULT 0,
  latest_event_at    DATETIME     NULL,
  INDEX idx_order_status (status),
  INDEX idx_order_demand (demand_id)
) ENGINE=InnoDB;

-- 节点任务
CREATE TABLE IF NOT EXISTS production_task (
  task_id          VARCHAR(32)  PRIMARY KEY,
  order_id         VARCHAR(32)  NOT NULL,
  node_id          VARCHAR(32)  NOT NULL,
  equip_id         VARCHAR(32)  NOT NULL DEFAULT '',
  seq              TINYINT      NOT NULL DEFAULT 1,
  status           VARCHAR(16)  NOT NULL DEFAULT '待应答' COMMENT '待应答/已接受/已拒绝/协商中/执行中/已完成',
  respond_deadline DATETIME     NULL,
  planned_start    DATE         NULL,
  planned_end      DATE         NULL,
  progress_reported TINYINT     NOT NULL DEFAULT 0,
  process_params   JSON         NULL,
  INDEX idx_task_order (order_id),
  INDEX idx_task_node (node_id)
) ENGINE=InnoDB;

-- 派单候选
CREATE TABLE IF NOT EXISTS dispatch_candidate (
  candidate_id VARCHAR(32)  PRIMARY KEY,
  order_id     VARCHAR(32)  NOT NULL,
  node_id      VARCHAR(32)  NOT NULL,
  score        INT          NOT NULL DEFAULT 0,
  reason       JSON         NULL,
  rank_no      TINYINT      NOT NULL DEFAULT 1,
  created_at   DATETIME     NOT NULL,
  INDEX idx_cand_order (order_id)
) ENGINE=InnoDB;

-- 订单事件（含链上存证）
CREATE TABLE IF NOT EXISTS order_event (
  event_id    VARCHAR(40)  PRIMARY KEY,
  order_id    VARCHAR(32)  NOT NULL,
  event_type  VARCHAR(16)  NOT NULL COMMENT '创建/受理/派单/接单/开工/报工/质检/交付/归档/异常',
  payload     JSON         NULL,
  tx_hash     VARCHAR(70)  NULL,
  occurred_at DATETIME     NOT NULL,
  actor_did   VARCHAR(64)  NOT NULL DEFAULT '',
  INDEX idx_event_order (order_id)
) ENGINE=InnoDB;

-- 合约空间
CREATE TABLE IF NOT EXISTS contract_space (
  cs_id       VARCHAR(32)  PRIMARY KEY,
  order_id    VARCHAR(32)  NOT NULL UNIQUE,
  state       VARCHAR(16)  NOT NULL DEFAULT '履约中' COMMENT '已创建/履约中/已交付/已归档',
  members     JSON         NULL,
  policy_hash VARCHAR(70)  NULL,
  chain_addr  VARCHAR(80)  NULL,
  created_at  DATETIME     NOT NULL,
  archived_at DATETIME     NULL
) ENGINE=InnoDB;

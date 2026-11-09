-- 船舶增材制造数据共享平台 数据库结构
-- 数据库：am_database（UTF-8MB4）
-- 表结构严格对应前端 src/types.ts，嵌套对象/关联 id 数组用 JSON 列存储

CREATE DATABASE IF NOT EXISTS am_database
  DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE am_database;

-- 金属原材料
CREATE TABLE IF NOT EXISTS materials (
  id                       VARCHAR(64)  PRIMARY KEY,
  material_name            VARCHAR(255) NOT NULL,
  material_code            VARCHAR(64)  NOT NULL,
  material_category        VARCHAR(64)  NOT NULL,
  material_sub_category    VARCHAR(64)  NOT NULL DEFAULT '',
  application_description  TEXT,
  supplier                 VARCHAR(255) NOT NULL DEFAULT '',
  batch_number             VARCHAR(64)  NOT NULL DEFAULT '',
  chemical_composition     JSON         NOT NULL,  -- {C,Cr,Ni,Mo,Mn,Si,P,S,N,O,Fe}
  average_particle_size    DOUBLE       NOT NULL DEFAULT 0,
  hall_flow                DOUBLE       NOT NULL DEFAULT 0,
  related_parts            JSON         NOT NULL,  -- string[]
  related_inspections      JSON         NOT NULL,
  related_standards        JSON         NOT NULL,
  created_at               TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 零部件模型
CREATE TABLE IF NOT EXISTS parts (
  id                    VARCHAR(64)  PRIMARY KEY,
  part_name             VARCHAR(255) NOT NULL,
  category_name         VARCHAR(64)  NOT NULL DEFAULT '',
  oem_part_number       VARCHAR(64)  NOT NULL DEFAULT '',
  original_material_code VARCHAR(64) NOT NULL DEFAULT '',
  model_file_path       VARCHAR(512) NOT NULL DEFAULT '',
  related_materials     JSON         NOT NULL,
  related_inspections   JSON         NOT NULL,
  related_equipment     JSON         NOT NULL,
  created_at            TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 增材设备
CREATE TABLE IF NOT EXISTS equipment (
  id               VARCHAR(64)  PRIMARY KEY,
  equipment_name   VARCHAR(255) NOT NULL,
  manufacturer     VARCHAR(255) NOT NULL DEFAULT '',
  machine_type     VARCHAR(64)  NOT NULL DEFAULT '',
  build_size_x     DOUBLE       NOT NULL DEFAULT 0,
  laser_max_power  DOUBLE       NOT NULL DEFAULT 0,
  node_location    VARCHAR(255) NOT NULL DEFAULT '',
  equipment_status VARCHAR(32)  NOT NULL DEFAULT '待机',
  related_parts    JSON         NOT NULL,
  created_at       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 检测数据
CREATE TABLE IF NOT EXISTS inspections (
  id                VARCHAR(64)  PRIMARY KEY,
  sample_name       VARCHAR(255) NOT NULL,
  sample_description TEXT,
  sampling_position VARCHAR(255) NOT NULL DEFAULT '',
  tensile_strength  DOUBLE       NOT NULL DEFAULT 0,
  yield_strength    DOUBLE       NOT NULL DEFAULT 0,
  result_judgment   VARCHAR(32)  NOT NULL DEFAULT '',
  remark            TEXT,
  related_parts     JSON         NOT NULL,
  related_materials JSON         NOT NULL,
  created_at        TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 标准数据
CREATE TABLE IF NOT EXISTS standards (
  id                    VARCHAR(64)  PRIMARY KEY,
  standard_number       VARCHAR(128) NOT NULL,
  standard_name         VARCHAR(512) NOT NULL DEFAULT '',
  standard_english_name VARCHAR(512) NOT NULL DEFAULT '',
  standard_type         VARCHAR(64)  NOT NULL DEFAULT '',
  classification_society VARCHAR(64) NOT NULL DEFAULT '',
  standard_path         VARCHAR(512) NOT NULL DEFAULT '',
  related_materials     JSON         NOT NULL,
  related_processes     JSON         NOT NULL,
  related_inspections   JSON         NOT NULL,
  created_at            TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 订单
CREATE TABLE IF NOT EXISTS orders (
  id                    VARCHAR(64)  PRIMARY KEY,
  order_name            VARCHAR(255) NOT NULL,
  material_id           VARCHAR(64)  NOT NULL,
  part_id               VARCHAR(64)  NOT NULL,
  quantity              INT          NOT NULL DEFAULT 1,
  priority              VARCHAR(32)  NOT NULL DEFAULT '普通',
  required_delivery_date DATE        NULL,
  order_status          VARCHAR(32)  NOT NULL DEFAULT '待匹配',
  matched_equipment_id  VARCHAR(64)  NOT NULL DEFAULT '',
  process_parameters    JSON         NOT NULL,  -- {laserPower,scanSpeed,layerThickness,scanStrategy,preheatTemperature,shieldingGas}
  schedule_info         JSON         NOT NULL,  -- {scheduleStartTime,scheduleEndTime,queuePosition,equipmentName}
  quality_inspection_id VARCHAR(64)  NOT NULL DEFAULT '',
  remark                TEXT,
  created_at            DATE         NOT NULL,
  INDEX idx_orders_status (order_status),
  INDEX idx_orders_equipment (matched_equipment_id),
  CONSTRAINT fk_orders_material FOREIGN KEY (material_id) REFERENCES materials (id),
  CONSTRAINT fk_orders_part     FOREIGN KEY (part_id)     REFERENCES parts (id)
) ENGINE=InnoDB;

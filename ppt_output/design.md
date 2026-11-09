# Design Document

## 1. Profile Baseline Declaration

- **Profile selection**: `profiles/strategic.md`
- **Selection rationale**: 本项目为商业计划书路演，面向投资人/评委，需要展示战略高度、市场数据、商业模式、财务预测与融资规划，完全匹配 strategic profile 的"项目提案、商业计划、融资路演"场景。
- **Referenced dimensions**: 设计理念（宏观视野、清晰叙事线、要点突出）、中高信息密度、数据说服力、文字-视觉比例、字体层级、叙事风格（说服驱动）、内容表达技巧（市场数据、竞争矩阵、路线图、ROI分析）。
- **Deviation notes**: 
  - 用户要求红黑配色（主色红色 #FF112D），偏离 profile 默认的"深蓝/深绿+白色"推荐，以用户要求为准。
  - 用户要求 20 页以内，偏离 profile 默认的 12-18 页，但 15 分钟路演 20 页以内属于合理范围。
  - 封面、尾页、团队页参赛主体留白，由用户自行补充。

## 2. Style Baseline Declaration

- **Style anchor selection**: 
  - 参考品牌：Tesla / SpaceX 发布会风格（深色背景+红色强调+大数字冲击力，科技硬核感）
  - 参考出版：《Monocle》杂志（信息排版精致、留白克制、高端商业感）
  - 参考设计：Swiss International Style（网格对齐、清晰层级、字体对比强烈）
- **Referenced dimension explanation**: 
  - 从 Tesla/SpaceX 参考：深色背景+红色主色的视觉冲击力、大数字展示方式、科技硬核氛围。
  - 从 Monocle 参考：信息排版精致感、标题措辞精炼、网格对齐的严谨感。
  - 从 Swiss Style 参考：网格系统、字体层级对比、左对齐/居中对齐的交替节奏。

## 3. Style Details

### 3.1 Color Design Principles
- **整体色彩倾向**: Striking & bold（路演场景需要视觉记忆力和冲击力）
- **色温**: 偏冷（深色背景+白色文字）+ 红色暖调点缀，形成冷暖对比
- **主色**: #FF112D（用户指定红色，高饱和度，用于标题、强调、关键数据）
- **背景色**: #0A0A0A（近黑色，高端深邃，避免纯黑的死板）
- **文字色**: #FFFFFF（白色，深色背景上的最高可读性）
- **次要文字色**: #A0A0A0（灰色，用于注释、来源、辅助信息）
- **卡片/容器色**: #151515（略浅于背景，用于内容区分，不喧宾夺主）
- **辅助线/边框色**: #333333（深灰色，用于表格边框、分隔线）
- **强调色**: 无额外强调色（红色已足够醒目，保持克制）
- **渐变**: 封面/章节页使用从 #0A0A0A 到 #1A0000（微红暗角）的径向渐变，增强氛围感

### 3.2 Font Usage Principles
- **中文标题字体**: alimamashuheiti（几何无衬线，商业感强，现代科技感）
- **英文标题字体**: Liter（现代新怪诞风格，简洁理性，适合科技与商业场景）
- **中文正文字体**: MiSans（清晰现代，优秀的屏幕渲染，适合阅读）
- **英文正文字体**: Liter（与标题统一，保持风格一致性）
- **字体大小层级**:
  - 封面标题: 48px
  - 封面副标题: 24px
  - 章节标题: 44px
  - 章节副标题: 22px
  - 页面标题: 32px
  - 正文: 18-20px（信息密度高时用18px，一般情况20px）
  - 大数字/KPI: 56px
  - 大数字说明文字: 14px
  - 注释/来源: 12px
- **特殊处理**: 章节页数字（01/02/03/04）使用 Liter，字号 72px，加红色，形成视觉锚点。

### 3.3 Text Box and Container Styles
- **内容分隔**: 优先使用留白和字体大小差异建立层级；必要时使用1px #333333 直线分隔。
- **卡片样式**: 矩形直角（无圆角），背景填充 #151515，无边框，无阴影，保持扁平高端感。
- **装饰元素策略**:
  - 页面左上角或标题左侧使用 4px 宽、红色竖线作为标题装饰。
  - 关键数据下方使用红色细横线作为强调。
  - 章节页使用半透明红色大号数字（72px）作为背景装饰元素。
  - 禁止使用圆角矩形、渐变形状、彩色阴影等廉价装饰。

### 3.4 Image Style
- **图标**: 使用 solid 风格图标（fas:），红色填充，用于核心能力/优势列表的 bullet 替代，克制使用。
- **表格**: 极简风格，表头红色背景+白色文字，数据行交替 #151515/#0A0A0A，边框 #333333，无多余装饰。
- **图表**: 红色系列色（#FF112D, #FF4D5E, #FF8A95, #FFB8C0, #FFD9DD），深色背景，白色网格线，无3D效果。
- **插图**: 封面/章节页使用全屏高质量图片+深色渐变蒙版（从透明到 #0A0A0A），文字叠加其上。内容页尽量不使用纯装饰图片，以数据图表和结构化图形为主。

## 4. Layout System

### 4.1 Global Layout Characteristics
- **页面尺寸**: 1280 x 720 (16:9)
- **页面边距**: 上60px，下50px，左80px，右80px
- **统一页面元素**:
  - 每页底部右侧：页码（12px，白色，Liter 字体）
  - 每页底部：1px #333333 水平线，距底部 40px
  - 内容页左上角：红色竖线装饰（4px宽，高度与标题行高一致，位于标题左侧）
- **网格对齐**: 所有元素严格左对齐或居中对齐，保持 Swiss Style 的严谨性。

### 4.2 Special Page Layouts
- **封面页**: 全屏背景图+深色渐变蒙版（底部更暗），主标题居中偏上，副标题在下方，红色细横线分隔，底部留白区域放置参赛主体与日期。
- **目录页**: 左侧 40% 区域放置"CONTENTS"大字（红色，Liter，72px），右侧 60% 区域使用网格布局放置四个章节（编号+标题+简述），每个章节一个直角卡片（#151515）。
- **章节过渡页**: 全屏背景图+深色渐变蒙版，左侧放置超大号半透明红色数字（72px），右侧放置章节标题和副标题，形成视觉休息点。
- **尾页**: 全屏背景图+深色渐变蒙版，居中放置感谢语和核心 slogan，底部留白。

### 4.3 Content Page Layout Patterns
- **Pattern A - 数据页**: 顶部标题 → 3-4 个大数字横向排列（红色数字+白色说明）→ 下方图表或详细说明 → 底部来源注释。
- **Pattern B - 左右分栏**: 左侧 50% 文字+要点列表，右侧 50% 图表/表格/图片，严格对齐。
- **Pattern C - 三/四列卡片**: 三个或四个等宽卡片横向排列，每个卡片包含图标+标题+要点，用于对比、优势展示。
- **Pattern D - 时间线/流程**: 横向时间线或步骤箭头，下方对应内容，用于发展规划、业务流程。
- **Pattern E - 表格对比**: 全宽表格，用于竞争对比、技术指标对比。

## 5. Style Usage Rules

### textStyles 使用规则
- `title`: 封面主标题、章节页标题（alimamashuheiti, Liter, 48px, 白色）
- `subtitle`: 封面副标题、章节页副标题（MiSans, Liter, 24px, 灰色）
- `heading`: 内容页标题（alimamashuheiti, Liter, 32px, 白色）
- `body`: 正文内容（MiSans, Liter, 18-20px, 白色，行高1.6）
- `kpi`: 大数字展示（Liter, 56px, 红色 #FF112D）
- `kpiLabel`: 大数字说明（MiSans, Liter, 14px, 灰色）
- `caption`: 注释、来源（MiSans, Liter, 12px, 灰色）
- `chapterNum`: 章节编号（Liter, 72px, 红色）

### colors 使用规则
- `$primary` (#FF112D): 标题装饰线、大数字、图标、表头背景、关键强调文字、章节编号。
- `$background` (#0A0A0A): 所有页面背景。
- `$text` (#FFFFFF): 主要文字。
- `$secondary` (#A0A0A0): 副标题、注释、辅助说明。
- `$card` (#151515): 卡片背景、表格交替行。
- `$border` (#333333): 分隔线、表格边框。

### tableStyles 使用规则
- `default`: 表头红色背景+白色文字，数据行交替深色，边框细线，无额外装饰。

## 6. Risk Prohibitions

- [ ] **禁止圆角**：所有形状、卡片、图片裁剪必须使用直角，禁止使用任何圆角矩形（战略报告需严谨权威感）。
- [ ] **禁止渐变形状**：除封面/章节页图片蒙版外，禁止使用彩色渐变填充形状。
- [ ] **禁止高饱和多色**：除红色主色外，禁止使用蓝色、绿色、黄色等额外强调色，保持红黑单色调。
- [ ] **禁止阴影**：禁止使用形状阴影、文字阴影（保持扁平高端感）。
- [ ] **禁止正文字号低于18px**：正文最小字号18px，确保投影清晰可读。
- [ ] **禁止标题字号低于28px**：页面标题最小28px。
- [ ] **禁止一行超过7个要点**：信息过载，必须拆分为卡片或多列。
- [ ] **禁止左右布局高度不对齐**：左右分栏时，两侧内容底部必须对齐。
- [ ] **禁止装饰性图片**：内容页禁止放置与内容无关的纯装饰图片。
- [ ] **禁止未经数据支撑的结论**：所有商业结论必须配合数据或图表。

## 7. Theme Definition

```yaml
theme:
  colors:
    primary: "#FF112D"
    background: "#0A0A0A"
    text: "#FFFFFF"
    secondary: "#A0A0A0"
    card: "#151515"
    border: "#333333"
  textStyles:
    title:
      fontSize: 48
      color: "$text"
      fontFamily: "Liter, alimamashuheiti"
      lineHeight: 1.2
    subtitle:
      fontSize: 24
      color: "$secondary"
      fontFamily: "Liter, MiSans"
      lineHeight: 1.4
    heading:
      fontSize: 32
      color: "$text"
      fontFamily: "Liter, alimamashuheiti"
      lineHeight: 1.3
    body:
      fontSize: 18
      color: "$text"
      fontFamily: "Liter, MiSans"
      lineHeight: 1.6
    kpi:
      fontSize: 56
      color: "$primary"
      fontFamily: "Liter"
      lineHeight: 1.1
    kpiLabel:
      fontSize: 14
      color: "$secondary"
      fontFamily: "Liter, MiSans"
      lineHeight: 1.4
    caption:
      fontSize: 12
      color: "$secondary"
      fontFamily: "Liter, MiSans"
      lineHeight: 1.4
    chapterNum:
      fontSize: 72
      color: "$primary"
      fontFamily: "Liter"
      lineHeight: 1.0
  tableStyles:
    default:
      fontSize: 14
      fontFamily: "Liter, MiSans"
      headerFill: "$primary"
      headerColor: "$text"
      headerBold: true
      bodyFill: ["$card", "$background"]
      bodyColor: "$text"
      border:
        style: solid
        width: 1
        color: "$border"
```

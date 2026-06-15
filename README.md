# 八字排盘

基于 **React 19 + TypeScript 6 + Vite 8 + Tailwind CSS 4** 的八字四柱命理排盘 Web 应用，新中式深色风格，纯前端运行。

## 功能特性

| 模块 | 说明 |
|------|------|
| **四柱排盘** | 公历/农历输入，自动排出年柱、月柱、日柱、时柱 |
| **纳音** | 六十甲子纳音五行（如 甲子 → 海中金） |
| **藏干** | 地支藏干（如 丑 → 己、癸、辛） |
| **五行** | 天干地支五行分布与生克关系 |
| **十神** | 以日主为中心推导十神（正官、偏官、正印、偏印……） |
| **大运** | 阴阳顺逆排大运，十年一换 |
| **流年** | 当前流年太岁分析（值/冲/合/刑/破/害太岁） |
| **日主强弱** | 多维度评分模型（得令/得地/得生/得助） |
| **用神忌神** | 三种策略自动取用（扶抑/从强/调候） |
| **格局判断** | 正格（十格）与从格（从强/从弱）判定 |
| **专题批注** | 婚姻、事业、健康、财运、性格、人际六维分析 |
| **地支关系** | 刑/冲/合/害/破/三合/三会/空亡 全面检测 |
| **人生里程碑** | 自动标记关键年份（本命年、冲太岁、换大运等） |

## 技术栈

- **React 19** — UI 框架
- **TypeScript 6** — 类型安全
- **Vite 8** — 构建工具 + HMR 热更新
- **Tailwind CSS 4** — 原子化样式
- **lunar-typescript** — 农历与节气计算
- **Playwright** — E2E 浏览器测试

## 快速开始

```bash
# 安装依赖
npm install

# 启动开发服务器（默认 http://localhost:5173）
npm run dev

# 生产构建
npm run build

# 预览构建产物
npm run preview

# 运行 ESLint 检查
npm run lint
```

## 项目结构

```
src/
├── App.tsx                   # 主应用组件（串联所有子模块）
├── main.tsx                  # React 入口
├── index.css                 # Tailwind 全局样式（新中式配色）
│
├── assets/                   # 静态资源
│
├── components/               # UI 组件（9个）
│   ├── Header.tsx            # 页头
│   ├── BirthForm.tsx         # 出生信息输入表单
│   ├── BaziChart.tsx         # 八字四柱图表
│   ├── HiddenStems.tsx       # 地支藏干展示
│   ├── NaYin.tsx             # 纳音展示
│   ├── FiveElements.tsx      # 五行分布展示
│   ├── TenGods.tsx           # 十神展示
│   ├── LuckCycle.tsx         # 大运流年展示
│   └── AnnotationPanel.tsx   # 批注结果面板
│
├── hooks/
│   └── useBazi.ts            # 自定义 Hook（状态管理 + 计算触发）
│
└── engine/                   # ⭐ 八字计算引擎（纯逻辑，无 UI 依赖）
    ├── index.ts              # 统一导出入口
    ├── types.ts              # 核心类型 & 常量表（天干地支、五行、纳音、藏干）
    ├── calculator.ts         # 八字四柱排盘计算
    ├── relation.ts           # 地支关系常量库（冲/合/刑/破/害/三合/三会/空亡）
    │
    └── annotation/           # 批注子系统（10 个模块）
        ├── index.ts          # 导出入口
        ├── engine.ts         # 批注引擎主流水线
        ├── types.ts          # 批注相关类型定义
        ├── wuxing.ts         # 五行生克逻辑 + 十神计算
        ├── dayMasterStrength.ts  # 日主强弱评分
        ├── yongShen.ts       # 用神忌神取用
        ├── pattern.ts        # 格局判断
        ├── luckAnalysis.ts   # 大运流年批注
        ├── branchRelations.ts # 地支关系分析
        └── specialTopics.ts  # 专题批注（婚姻/事业/健康/财运/性格/人际）
```

## 引擎架构

计算与批注完全分离，无 UI 依赖，可直接用于 Node.js/CLI：

```
输入（年月日时 + 性别）
  │
  ▼
calculator.ts  ──→  BaZiResult（四柱 + 纳音 + 藏干 + 十神 + 大运）
  │
  ▼
annotation/engine.ts（批注流水线）
  ├── wuxing.ts          十神 & 五行生克
  ├── dayMasterStrength  日主强弱
  ├── yongShen.ts        用神忌神
  ├── pattern.ts         格局分析
  ├── luckAnalysis.ts    大运流年
  ├── branchRelations.ts 地支关系
  └── specialTopics.ts   专题批注
  │
  ▼
AnnotationResult（完整批注结果）
```

## 规则文档

完整的八字规则手册详见 [`docs/BaziSystemRules.md`](./docs/BaziSystemRules.md)，涵盖：

- 天干地支基础数据结构
- 五行生克 & 十神推导
- 地支关系大全（六冲/六合/刑/破/害/三合/三会/半合/空亡）
- 日主强弱评分模型（得令/得地/得生/得助）
- 用神忌神取用规则（扶抑/从强/调候）
- 格局判断流程（正格/从格/特殊格局）
- 大运流年分析（六种太岁 + 里程碑算法）
- 六大专题批注规则
- 批注引擎流水线 & 文件索引

## 设计风格

- **新中式深色主题**：背景 `#1a1410`（深棕黑），文字 `#e7d7c0`（暖米色）
- **字体**：Microsoft YaHei / PingFang SC / Noto Sans SC
- **响应式**：适配桌面端，移动端友好

## License

Private — 内部项目

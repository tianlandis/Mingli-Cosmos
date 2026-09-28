# seeds/knowledge — 知识资产种子（可迁移的软件本体数据）

> 配套：[ADR-012 数据域分层与多库演进策略](../../docs/adr/ADR-012-data-domain-strategy.md) ・
> 操作手册 [DATA-DOMAINS.md](../../docs/arch/DATA-DOMAINS.md)
> 数据域：**知识资产（可迁移）** → 落表 `knowledge_assets`

## 这是什么

把**知识类数据**（八字基础 / 神煞 / 星座 / 16 型人格 / 经典）从代码里搬到**文件**，
让它们：

- **可版本控制** —— 随代码提交，改动可 review diff；
- **可迁移** —— 带走本目录 + 跑一次导入，即在新环境重建全部知识；
- **可复现** —— 同一份种子，任何环境导入结果一致。

## 文件格式

每个 `*.json` 文件 = 一个 `category` 下的一批条目：

```json
{
  "category": "zodiac",
  "items": [
    {
      "key": "aries",
      "description": "白羊座 | 3.21–4.19 | 火象",
      "sortOrder": 10,
      "value": {
        "nameZh": "白羊座",
        "dateRange": "03-21 ~ 04-19",
        "element": "fire",
        "traits": ["热情", "果敢", "直率"]
      }
    }
  ]
}
```

| 字段 | 必填 | 说明 |
|:--|:--:|:--|
| `category` | ✅ | 资产分类，决定归类（见下表） |
| `items[].key` | ✅ | 该分类内唯一键名（`category + key` 唯一） |
| `items[].value` | ✅ | 任意 JSON（对象/数组/标量均可），会被 `JSON.stringify` 后存库 |
| `items[].description` | ➖ | 中文说明，建议写清 value 的结构 |
| `items[].sortOrder` | ➖ | 排序权重，默认 0 |

### 类别约定（沿用现有 `knowledge_assets.category`）

| category | 内容 | 状态 |
|:--|:--|:--|
| `bazi` | 八字基础（藏干、长生、地支关系…） | 现有（代码种子，见 `seed.ts::seedKnowledgeAssets`） |
| `shensha` | 神煞 | 现有（代码种子） |
| `personality` | 16 型人格 / 十神→MBTI 映射 | 现有（代码种子） |
| `pattern` | 格局规则 | 现有（代码种子） |
| `classics` | 经典文献 | 现有（代码种子） |
| `zodiac` | **星座（西方占星）** | ⧗ 新增，随爬虫落地 |
| `astro` | 星盘相关（上升/宫位等） | ⧗ 预留 |

> 新增类别无需改代码 —— 只要 `category` 字符串没用过，导入脚本自动创建。

## 导入

```bash
npm run db:seed          # 幂等：按 (category, key) upsert，可反复执行
```

- **幂等**：已存在则更新（`version` 自增），不存在则新建。重复执行安全。
- **不删除**：种子中移除的条目**不会**被自动删除（避免误删后台手工维护的数据）。需要下架请走后台或 `is_active=0`。

## 爬虫对接流程（重要）

**不要**让爬虫直接写生产库。标准姿势：

```
爬虫（离线，任意语言）
   ↓ 产出
seeds/knowledge/zodiac.json        ← 提交进仓库、可 review
   ↓ npm run db:seed
knowledge_assets（category='zodiac'）
```

好处：爬虫失败不污染生产库；产出可 diff、可回溯；换环境复制种子即可。

## 示例文件

`*.sample.json` 是**格式示范**，导入脚本会**跳过**它们。
真实数据请另建 `zodiac.json`（不带 `.sample`）。

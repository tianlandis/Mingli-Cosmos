# MBTI / 16人格 数据来源说明（供 Mingli-Cosmos 排盘表达层使用）

> 抓取日期：2026-09-29 ｜ 抓取人：球球(QQ) ｜ 用途：排盘后 16 人格表达内容素材库

## 目录结构

```
mbti-data/
├── en/   英文素材（以后做中文口语化精确翻译）
│   ├── en_energy_extraversion.json      E 维度行为语料（2050 条）
│   ├── en_energy_introversion.json      I 维度行为语料（2050 条）
│   ├── en_information_intuition.json    N 维度行为语料（23233 条）
│   ├── en_information_sensing.json      S 维度行为语料（23233 条）
│   ├── en_decision_thinking.json        T 维度行为语料（12159 条）
│   ├── en_decision_feeling.json         F 维度行为语料（12159 条）
│   ├── en_execution_judging.json        J 维度行为语料（7378 条）
│   └── en_execution_perceiving.json     P 维度行为语料（7378 条）
└── zh/   中文素材（可直接用于表达层）
    ├── zh_energy_*.json / zh_information_*.json / zh_decision_*.json / zh_execution_*.json
    │                                    同上 8 个维度（zh 前缀，共约 6 万条）
    ├── mbti-mini_questions.json         中文版 MBTI 测验题（10 题，含 A/B 选项）
    └── mbti-mini_question_results.json  中文 16 类型一句话描述（16 条）
```

## 数据来源与许可

| 来源 | 内容 | 许可 | 备注 |
|---|---|---|---|
| [PKU-YuanGroup/Machine-Mindset](https://github.com/PKU-YuanGroup/Machine-Mindset)（北大 Yuan Group） | datasets/behaviour 下 en/zh 各 8 个维度 JSON，Alpaca 格式（instruction/input/output） | **Apache 2.0** | 核心资产。每条为同一问题下某维度人格的口语化回答，且成对（如 extraversion vs introversion 同题对照），适合直接抽取做表达层 |
| [lilemy/mbti-mini](https://github.com/lilemy/mbti-mini) | 中文测验题 + 16 类型短描述 | 仓库未声明 License | 仅作内部参考素材，短描述属重写性质，使用前建议自写改写 |

## 数据形态说明（Machine-Mindset）

- 格式：`[{"instruction": "...", "input": "", "output": "..."}]`
- 关键特性：**同题成对**。例如 `information_intuition.json` 与 `information_sensing.json` 中 instruction 完全相同、output 呈现 N/S 两种截然不同的表达风格——可直接用来构建"维度光谱"表达。
- 每个 zh/en 文件一一对应（zh 1417↔en 2050 条略有差异，按 instruction 对齐即可）。

## ⚠️ 版权红线（务必遵守）

1. **16personalities.com 官网内容（各类型长文描述）是受版权保护的商业内容，禁止整段复制进 Mingli-Cosmos 产品。** 其非官方 API（K0reem0/16personalities-api，线上服务已失效）抓取路径已验证不可用，也不建议再尝试抓官网正文。
2. 可行路线：以 Apache 2.0 的 Machine-Mindset 语料为底 → 用 LLM 归纳提炼维度表达特征 → 结合八字十神/格局语境**自写原创文案**。本项目"结论可回溯"原则恰好要求表达层原创、可解释。
3. MBTI 四字母维度概念本身（荣格心理类型衍生）不受版权保护，类型缩写与维度含义可自由使用；"16Personalities"商标与站点文案不可使用。

## 后续加工建议

1. 按 instruction 对齐 zh/en 成对语料 → 抽样提炼每维度 20~30 条高频表达模式；
2. 与 `src/server/workflows` 的专题批注模板（性格域）对接，作为 Step1 LLM 的 few-shot 素材；
3. 结合 `bazi-mbti-mapping.md` 中的十神/格局映射，生成"八字维度 → MBTI 表达风格"的文案生成规则。

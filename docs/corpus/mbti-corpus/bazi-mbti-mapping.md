# 八字 × 16人格 表达层映射方案（v0.2 已对齐权威文档）

> **权威依据**：`D:\bz\bazipaipan\docs\八字格局与MBTI类型映射.md`（十神与MBTI整合版八字取格决策框架·三阶精修版）。
> v0.1 的自由推论映射已全部废弃，本文所有对照逐条取自该文档的十神功能速查表与格局组合表。
> 定位：表达层素材映射，不是排盘算法。排盘结论仍以落库规则字典为准。

## 一、十神 ↔ 认知功能 ↔ MBTI（文档权威速查表）

| 十神 | 认知功能 | 典型 MBTI |
|---|---|---|
| 正官 | Te（外倾思维） | ESTJ, INTJ |
| 七杀 | Ti（内倾思维） | INTP, ESTP |
| 正印 | Ne（外倾直觉） | ENFP, ENTP |
| 偏印 | Ni（内倾直觉） | INTJ, INFJ |
| 正财 | Se（外倾感觉） | ESTP, ESFP |
| 偏财 | Si（内倾感觉） | ESTJ, ISFJ |
| 食神 | Fi（内倾情感） | INFP, ISFP |
| 伤官 | Fe（外倾情感） | INFJ, ESFJ |

## 二、格局组合 ↔ MBTI（文档权威组合表）

| 格局组合 | 功能组合 | 典型 MBTI |
|---|---|---|
| 官印相生 | Te+Ne | ENTJ, ENTP |
| 煞印相生 | Ti+Ni | INTJ, INFJ |
| 财官相生 | Se+Te | ESTJ, ENTJ |
| 食神生财 | Fi+Se | ISFP, ESFP |
| 伤官生财 | Fe+Se | ESFJ, ESTP |
| 伤官佩印 | Fe+Ne | ENFJ, ENFP |
| 纯印格 | Ne/Ni+Fi | INFP, INFJ |
| 纯财格 | Se/Si+Te/Fe | ESTJ, ISFJ |
| 禄格 | Si+Ne | ISFJ, INFP |
| 羊刃格 | Se+Te | ESTP, ENTJ |

## 三、16 类型来源归集（逐型取自上两表）

| 类型 | 文档来源（十神 / 组合） |
|---|---|
| INTJ | 偏印·Ni / 正官·Te；煞印相生 |
| INTP | 七杀·Ti |
| ENTJ | 官印相生、财官相生、羊刃格 |
| ENTP | 正印·Ne；官印相生 |
| INFJ | 偏印·Ni / 伤官·Fe；煞印相生、纯印格 |
| INFP | 食神·Fi；禄格、纯印格 |
| ENFJ | 伤官佩印 |
| ENFP | 正印·Ne；伤官佩印 |
| ESTJ | 正官·Te / 偏财·Si；财官相生、纯财格 |
| ESFJ | 伤官·Fe；伤官生财、纯财格 |
| ISFJ | 偏财·Si；禄格、纯财格 |
| ESTP | 七杀·Ti / 正财·Se；伤官生财、羊刃格 |
| ISFP | 食神·Fi；食神生财 |
| ESFP | 正财·Se；食神生财 |
| ISTJ | 文档未直接映射（行业适配表仅见"七杀格（ISTJ/INTJ）"） |
| ISTP | **文档未覆盖**（三阶精修版映射表无 ISTP） |

## 四、运行时权威链路（引擎代码审查结论）

```
docs/八字格局与MBTI类型映射.md（三阶精修版）
  └─ seed/knowledge_assets: personality.shishen_mbti_function + pattern.combination_mbti_map
       └─ src/engine/pattern/mbtiMapping.ts（reloadMBTIMappings 动态接管，编译时兜底同源）
            └─ analyzeMBTI()：recommendedTypes = 组合表优先 → 主导十神表兜底
                 └─ annotation/pattern.ts:143 → patternAnalysis.mbti.typicalTypes
                      └─ server/workflows/mbti-expression.ts 取 typicalTypes 命中表达档案
```

**结论：运行时类型推导全程走文档权威映射，表达语料不参与类型判定。**

## 五、-A/-T 身份认同（表达层设计，文档未涉及）

- -A（自信）↔ 日主强弱强侧（极强/强/中和偏强）；-T（动荡）↔ 弱侧；中和按 score>=50 分界。
- 这是 16personalities 式身份维度的表达层设计，文档框架内无此轴，报告中不作为命理结论输出。

## 六、风险与边界（v0.2 修订）

- MBTI 与八字属两套体系，映射仅用于**表达润色**，报告标注"现代心理类型视角参考"；
- ISTP / ISTJ 在权威文档中未完整覆盖，如需补充应先修订权威文档，不得在语料层私自定锚；
- 16personalities.com 文案不可直接使用（见 SOURCES.md 版权红线）。

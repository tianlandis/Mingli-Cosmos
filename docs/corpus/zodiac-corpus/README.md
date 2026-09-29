# 星座语料与跨体系融合 · 研究总览

> 调研目的：星座语料怎么组织、同类产品怎么做星座×八字×MBTI 融合，为 `seeds/knowledge/zodiac.json` 与命书融合解读提供依据。
> 调研时间：2026-09-29 ｜ 方式：Web 检索 + 页面精读 + CDP 真浏览器抓取 + GitHub 评估

## 文件索引

| 文件 | 内容 |
|---|---|
| [SOURCES.md](./SOURCES.md) | 全部来源清单与可信度评估 |
| [METHODOLOGY-FUSION.md](./METHODOLOGY-FUSION.md) | 两套成熟融合方法论精读（指南星 / Mystic Universe） |
| [CORPUS-STRUCTURE.md](./CORPUS-STRUCTURE.md) | 星座语料结构模式与一手样例摘录 |
| [GITHUB-GEMS.md](./GITHUB-GEMS.md) | 开源仓库评估与可借鉴点 |

## 精华速览（五条结论）

1. **"矛盾"在成熟产品里不是 bug，是卖点。** 指南星与 Mystic Universe（getsaju）两家都把"系统间分歧"转译成"内心拉扯点/值得观察的场景"。我们的 `corpus-consistency` 检测守住"语料不打架"的底线，命书里则可以主动写"重叠主题 + 分歧信号"两段——焦虑变差异化。
2. **分层分工是通用框架**：八字=先天结构（原材料）、星座=表达风格（场景）、MBTI=当下习惯（日常语言）。三家独立来源收敛到同一分工，可直接作为我们融合解读的 prompt 骨架。
3. **星座语料的通用 schema 已有行业惯例**：关键词表（正/负对照）、四元素分组、核心特质/优点/缺点/感情里四段式、恋爱维度独立成库。这些全是"无条件人格断言"，**照抄必与 MBTI 语料打架**（已在我们的 384 组合矩阵中定量证实）——导入前必须过 `detectConflicts`，落库用"能量风格"措辞。
4. **国内头部产品的打法**：多体系工具并列免费（星盘/八字/紫微/星宿）→ 定制运势付费 → 合盘付费 → AI 大模型问答。定价锚点：准了 39 元/月、299 元/年（与我们 39/299 完全一致）。
5. **开源可借鉴**：`ziwei-doushu`（4191⭐）的古籍数据化+配置知识库、`astrology-api` 的运势文本 mood 情绪标注、`machinelearning-astrology-project` 的生成防重复（风格轮换+惩罚项）。

## 对项目的直接落点

| 落点 | 动作 | 对应批次 |
|---|---|---|
| `zodiac.json` schema | 增加 `positiveTraits/challengingTraits/energyStyle/loveLines` 字段，`traits` 过相容性检测 | 语料生产 |
| 命书 Step1 性格 | 新增"三透镜"段：八字=结构、星座=表达、MBTI=习惯；重叠/分歧各一段 | 批次 C |
| 关系合盘话术 | 结构互动（八字）/情感场景（星座）/沟通断点（MBTI）三层分工 | 批次 B |
| 断语库 500+ | 参考 ziwei-doushu 古籍数据化、china-testing/bazi 断语提炼 | 批次 D |
| 每日运势（若做） | mood 情绪标注 + 生成防重复 | 远期 |

# GitHub 开源宝藏评估（命理×AI 方向）

> 评估维度：star / 活跃度 / 对本项目的可借鉴点。检索时间 2026-09-29。

## 一线（直接对标）

| 仓库 | Star | 技术栈 | 对我们的价值 |
|---|---|---|---|
| [Renhuai123/ziwei-doushu](https://github.com/Renhuai123/ziwei-doushu) | 4191 | TypeScript/Next.js | 紫微排盘引擎 + **配置知识库 + 古籍原文数据化**（与 knowledge_assets 同路线）；断语库数据化的标杆做法 |
| [china-testing/bazi](https://github.com/china-testing/bazi) | 1512 | Python CLI | 刑冲合害/阴阳作用展示 + **"多年师傅经验提炼的断语"**——批次 D 断语库 500+ 的素材源 |
| [dzcmemory-web/bazi-ziwei-skill](https://github.com/dzcmemory-web/bazi-ziwei-skill) | 898 | TS / SKILL.md | "精确算法排盘、**不依赖 LLM 猜算**"+三种分析模式+水墨风 HTML 命盘海报——与我们"计算归引擎、解释归 AI"同哲学；海报功能对应 Phase 5 封存项 |
| [hhszzzz/taibu (MingAI)](https://github.com/hhszzzz/MingAI) | 581 | Next.js/TS/Supabase | 多体系全家桶（八字51神煞/紫微/六爻/塔罗/**MBTI 90题**/合盘）+ MCP Server + AI 个性化。注意：其融合=多体系并列+AI 对话，**没有**我们这种 bazi-anchored MBTI 深度；MCP 输出命理文本供 agent 调用的形态值得留意 |

## 二线（算法/数据源）

| 仓库 | Star | 价值 |
|---|---|---|
| [reed1898/bazi-tool](https://github.com/reed1898/bazi-tool) | — | Python，ephem 天文节气+真太阳时+五行力量（藏干权重 本气60/中气30/余气10）+known_charts 测试夹具——**测试夹具组织方式可对照我们的 8 命例 fixtures** |
| [tommitoan/bazica](https://github.com/tommitoan/bazica) | — | Go 排盘库，data 目录 **zodiac signs JSON** 结构参考；1900-2100 边界声明 |
| [vampireneo/BaZi-Calculator](https://github.com/vampireneo/BaZi-Calculator) | — | TS，tyme4ts 引擎+水墨风主题（米白 #fdfbf7 / 朱红 #b91c1c——与我们 --brand 朱砂红撞色，视觉方向互相印证） |

## 语料/数据类

| 仓库 | 价值 |
|---|---|
| [outrera/astrology_data](https://github.com/outrera/astrology_data) | **Astro-Databank 名人命例全量爬取 JSON**——外部命例验证源（可对照我们 fixtures 做交叉校验，或做"名人命例"运营内容） |
| [sbalsom/astrology-api](https://github.com/sbalsom/astrology-api) | 星座运势文本库 schema：sign/range(日周月)/author/publication/**mood 情绪标注**（Turbulent…Life-affirming）+ 版权处理方式（截断100字符+署名外链）——每日运势功能与语料合规的参考 |
| [syaffers/horoscopes-analysis](https://github.com/syaffers/horoscopes-analysis) | Scrapy 抓取 horoscope.com/astrology.com 运势文本 + 文本分析 notebook |
| [gholder513/machinelearning-astrology-project](https://github.com/gholder513/machinelearning-astrology-project) | 768 条星座运势文本：embedding 分类星座 + LLM 生成个性化运势；**防重复三板斧：风格轮换、焦点轮换、惩罚项**——我们运势/命书生成防模板味可直接借用 |

## 产品形态对标（非 GitHub）

- **准了**（莫小奇，34万+下载）：星盘/八字/紫微/二十八星宿四工具免费解锁 → 个人星盘定制日/月/年运 → 双人合盘+关系研究所付费 → 自有"玄学 AI 大模型"免费提问引流 + 1v1 咨询；**会员 39/月、299/年**（与我们定价完全一致）
- **测测 Cece**（泛心理社区，WISE 年度企业）：20 种星盘工具免费 → 社区语音问答付费（达人抢答）→ 八字/紫微/星宿/生命数字并列；主打"区别于 12 等分运势，按个人星图定制"——**定制化叙事是行业共识卖点**
- **指南星 guidingstar.ai**：五系统交叉分析（MBTI+八字+紫微+占星+灵数）喂给 AI 找重叠/分歧（详见 METHODOLOGY-FUSION.md）

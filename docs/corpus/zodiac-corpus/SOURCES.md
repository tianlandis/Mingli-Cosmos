# 来源清单与可信度评估

> 检索时间：2026-09-29 ｜ 检索方式：WebSearch + WebFetch 精读 + CDP 真浏览器抓取

## 深读（方法论级，可信度高）

1. **指南星 MBTI×命理** — https://guidingstar.ai/mbti-destiny
   中文 AI 命理产品官方方法论页。给出 MBTI↔十神/紫微/上升的映射与重叠/分歧框架。与本项目 engine 的十神↔认知功能映射互相印证。
2. **Mystic Universe（getsaju.com）三透镜指南** — https://getsaju.com/en/blog/saju-astrology-mbti
   韩国 Saju 应用知识博客（2026-06 发布/07 更新）。三透镜分工、四元素翻译桥、MBTI 四轴↔命理参照表、五步法、合盘应用。方法论最完整的一篇。
3. **星座百科网·星座性格关键词** — https://m.xingzuobaike.com/xingzuo/xingge/d168052.html
   CDP 真浏览器抓取的一手内容（2026-02 更新）。12 星座正负混合关键词表。

## 参考级

4. Astrogini Sun Signs（positive/challenging 两分）— https://www.astrogini.org/?p=4062/
5. 今日头条「星座、MBTI、九型、八字并不冲突！统一模型」（三层模型）— https://www.toutiao.com/a7675556931125150248
6. 今日头条「12 星座完整解析」（核心特质/优点/缺点/感情里四段式）— https://www.toutiao.com/a7662659272701936162
7. 今日头条「十二星座恋爱魅力」（恋爱语料具象句式）— https://www.toutiao.com/w/1845398772274308/
8. 新浪「十二星座恋爱性格」— https://www.sina.cn/news/detail/5328554150862685.html
9. 星座智慧屋「12 星座爱情文案短句」— https://www.dzyqhzs.cn/xingzuoaiqin/59082.html
10. Written by the Star「Iconic Traits」（Superlatives 榜单模式）— https://www.writtenbythestar.com/2020/02/what-your-magical-trait-base-on-your.html
11. 台湾命理「3 大分类法」融合话术 — https://mypaper.pchome.com.tw/readyou/post/1385180631

## 产品对标

12. 测测 Cece 官网 — https://cece.com ；产品功能页 — https://wanke.pcpop.com/game/13984.html 、https://www.ledanji.com/package/1013799.html
13. 准了 App Store 页 — https://apps.apple.com/cn/app/id1356471277 ；应用宝页 — https://sj.qq.com/appdetail/com.constellation.goddess
14. 太卜/MingAI 功能总览 — https://github.com/hhszzzz/MingAI ；MCP 工具清单 — https://onlybits.org/hhszzzz/MingAI
15. Git Stars bazi 话题榜 — https://git-stars.org/en/repositories/topic/bazi

## 抓取失败记录

- 第一星座网 d1xz.net：CDP 导航失败（站点疑似不可达）
- 测测 cece.com/astro：浏览器会话中断未完成抓取（产品信息已由搜索结果覆盖）

## 使用边界

- 所有第三方语料均为**结构与模式参考**，原文不可直接复制入库（版权 + 断言冲突双重原因）；
- 入库语料须原创改写（参考 mbti-corpus 的 Machine-Mindset 提炼+原创改写流程），并过 `src/server/lib/corpus-consistency.ts` 相容性检测。

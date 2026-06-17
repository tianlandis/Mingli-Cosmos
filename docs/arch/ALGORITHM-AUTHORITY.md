# 🔐 算法权威源声明（Algorithm Authority）

> **版本**: v1.0 | **用途**: AI 编写代码时必读，确定算法以哪个参考实现为准

---

## 一、权威层级

```
Python MCP (tengods.py + shensha.py)  ← 最高权威，唯一算法真相源
    ↓
docs/rules/  （规则文档，辅助说明，与 MCP 冲突时以 MCP 为准）
    ↓
TS engine/   （TypeScript 实现，必须与 Python MCP 行为完全一致）
```

---

## 二、权威参考文件

| 文件 | 绝对路径 | 职责 |
|------|---------|------|
| **tengods.py** | `d:\bz\八字排盘规则算法\src\tengods_bazi_mcp\tengods.py` | 格局取用 + 大运流年十神算法 |
| **shensha.py** | `d:\bz\八字排盘规则算法\src\tengods_bazi_mcp\shensha.py` | 神煞查表算法 |
| **MyLunar.py** | `d:\bz\八字排盘规则算法\src\tengods_bazi_mcp\MyLunar.py` | 农历/节气计算（TS 由 lunar-typescript 替代，不直接对标） |

---

## 三、关键算法对照表

### 3.1 格局取用（determine_pattern_geju）

| 步骤 | Python MCP 逻辑 | TS 文件 |
|------|----------------|---------|
| 第一步 | 四正月（子午卯酉）直接取本气和日干比对 | `patternRules.ts: resolveSiZheng()` |
| 第二步 | 月干→年干→时干检查透干，**透出比劫则跳过继续** | `patternRules.ts: resolveTouGan()` |
| 第三步 | 亥月特规（去戊，留甲壬）→ 分金定位 | `patternRules.ts: resolveFenJin()` |
| 第四步 | 比劫不成格→进退一位；越界+四墓库→反向；越界+非墓库→"比肩.X" | `patternRules.ts: resolveBiJieException()` |

### 3.2 藏干数据

| 地支 | Python MCP 顺序（余→中/墓→本） | TS HIDDEN_STEMS_DAYS |
|------|------------------------------|----------------------|
| 丑 | 癸9→辛6→己15 | **必须一致** |
| 辰 | 乙9→癸6→戊15 | **必须一致** |
| 未 | 丁9→乙6→己15 | **必须一致** |
| 戌 | 辛9→丁6→戊15 | **必须一致** |
| 寅/巳/申/亥 | 余→中→本 | **必须一致** |
| 子/午/卯/酉 | 单一本气 | **必须一致** |

### 3.3 分金逆排迭代

Python MCP 逆排使用**反方向迭代**（从30开始递减），TS 必须匹配此逻辑，不可简单使用正向迭代+调整值。

---

## 四、修改约束

1. **修改藏干数据** → 必须同时更新 `types.ts` 的 `HIDDEN_STEMS` 和 `HIDDEN_STEMS_DAYS`
2. **修改格局算法** → 必须先对照 `tengods.py` 的 `determine_pattern_geju` 确认行为一致
3. **新增神煞** → 必须在 `shensha.py` 中有对应表，TS 在 `shenShaRules.ts` 中实现
4. **MD 文档冲突** → 以 Python MCP 代码实际行为为准，并修正 MD 文档

---

## 五、AI 编码前检查清单

每次修改引擎代码前，依次确认：

- [ ] 是否对照了 Python MCP 对应函数的行为？
- [ ] 藏干顺序是否与 Python `get_tiangan()` 完全一致？
- [ ] 分金方向/迭代逻辑是否匹配 Python `find_tianganbutou()`？
- [ ] 修改后 `npx tsc --noEmit` 是否零错误？
- [ ] 是否只修改了 `engine/` 核心，未破坏 `annotation/` 流水线？

---

> 📎 **架构总约束**: `arch/ARCHITECTURE.md`
> 📎 **Python MCP 源码**: `d:\bz\八字排盘规则算法\src\tengods_bazi_mcp\`

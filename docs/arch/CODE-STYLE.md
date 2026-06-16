# 📝 代码规范（Code Style Guide）

> **版本**: v2.0 | **用途**: 统一代码风格，命名约定

---

## 一、文件命名

| 类型 | 规则 | 示例 |
|------|------|------|
| React 组件 | PascalCase | `BaziChart.tsx`, `BirthForm.tsx` |
| 工具/引擎模块 | camelCase | `calculator.ts`, `mbtiMapping.ts` |
| 类型定义 | camelCase | `types.ts` |
| Hook | `use` + PascalCase | `useBazi.ts` |
| 导出索引 | `index.ts` | `index.ts` |

---

## 二、函数命名

| 类型 | 规则 | 示例 |
|------|------|------|
| 主入口函数 | `generate` / `compute` / `analyze` 前缀 | `generateAnnotation()`, `determinePattern()` |
| 获取函数 | `get` 前缀 | `getShiShenName()`, `getKongWang()` |
| 检查函数 | `is` / `has` / `check` 前缀 | `isYangYear()` |
| 计算函数 | `calc` / `compute` 前缀 | `computeQiYunDays()` |

---

## 三、TypeScript 规范

- ✅ 所有参数、返回值必须有类型标注
- ✅ 使用 `interface` 定义数据结构
- ✅ 使用 `type` 定义别名（如 `DiZhi = string`）
- ❌ 禁止 `any`（除非有充分理由）
- ❌ 禁止裸 `string` 作为地支类型（使用 `DiZhi` 别名）

---

## 四、React 规范

- ✅ 函数组件 + Hooks
- ✅ Tailwind CSS 做样式，禁止行内 style 对象
- ✅ 组件 Props 使用 interface 定义
- ❌ 禁止 class 组件（历史负担）

---

## 五、导入顺序

```
1. React / 第三方库
2. engine/ 引擎模块
3. components/ 组件
4. hooks/ hooks
5. 类型定义
```

---

## 六、注释规范

- ✅ 关键算法处必须加注释说明逻辑
- ✅ 对应领域规则处加引用注释（如"// 参考 rules/05-geju-v2.md §三"）
- ❌ 不要写无意义的 `// 这是一行注释` 注释

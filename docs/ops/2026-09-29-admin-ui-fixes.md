# 2026-09-29 — 后台界面疏漏排查与修复（批次 VII）

commit `b3bd03c` ｜ 已部署内网 `192.168.2.10`

---

## 一、用户点名的缺陷：没有「选定应用」的按钮

**澄清后的问题**：不是命理体系，而是**模型用于哪个应用场景**（对话 / 命书）。
原先 role（fast/deep）只藏在**编辑弹窗的下拉**里，标签还是技术词「fast · 低延迟 / deep · 高质量」，列表页既看不到也点不到。

**修复**：LLM 供应商列表每张卡片新增按钮组 ——

```
应用  [对话] [命书]        未指定
```

- 点一下即生效（`PUT /api/v1/admin/llm/:id {role}`），再点一次取消
- 同一应用只保留一个供应商（后端自动顶掉旧的）
- 无需进编辑弹窗

---

## 二、排查出的其他疏漏（已修）

| # | 问题 | 严重度 | 处理 |
|:--:|---|:--:|---|
| 1 | `/admin/*` 无 SPA 兜底 —— 刷新 `/admin/llm` 必白屏（落到 C 端 `#root` 的 html，admin 挂载点是 `#admin-root`） | **阻断** | `app.ts` 补 `get('/admin/*')` |
| 2 | 后台**既无 API 也无 UI** 能感知体系（八字/星座/MBTI），管理员无法配置默认应用 | 高 | 新增 `GET/PUT /api/v1/admin/systems` + 配置页体系选择卡片 |
| 3 | ProviderForm 编辑态 API Key 无条件必填 —— 与「留空保留原 Key」矛盾，**不重填密钥永远保存不了** | 高 | 改为仅新建时必填 |
| 4 | 先「编辑」再「新增」，表单残留上一次的值 | 中 | useEffect 补 else 重置 |
| 5 | ConfigPanel 新增配置**不判响应**就提示「已保存」（假成功），空值静默 return | 高 | 判 `success` + error toast + saving 态 |
| 6 | 删除配置项无二次确认，可一键删掉 `jwt_secret` / `admin_password_hash` | 高 | 敏感键二次确认 |
| 7 | 无 404 兜底路由；面包屑缺 `guardrails` 键（显示英文） | 中 | 补 404 页 + 补键 |

### 体系能力落点（ADR-011）

- `src/server/systems/meta.ts` —— 体系中文名**服务端唯一真值**（此前 C 端 `src/lib/systems.ts` 与后台各写一份，会漂移）
- `moduleSettingsSchema` 新增 `systems.{ defaultSystem, enabledSystems }`
- PUT 校验：未注册体系 → 400；默认不在启用清单 → 400；全停用 → 400

---

## 三、验证

| 项 | 结果 |
|:--|:--|
| `tsc -b --noEmit` | 0 错 |
| vitest | **533/533**（32 文件） |
| build（含 `dist/admin`） | ✓ |
| 内网 smoke | **42/42** |
| `GET /api/v1/admin/systems` | 返回 bazi / astro / mbti + 中文名 + 版本 |
| 三类非法输入 | 全部正确 400 |
| `/admin`、`/admin/llm`、`/admin/users`、`/admin/nonexistent` | 全部返回 admin html（`admin-root=true`） |

---

## 四、顺手完成：deep 端点兜底（命书从必失败 → 可用）

GLM 网关上游无健康 provider，deep 角色此前无可用端点，**命书必然失败**。
已建 `api_keys #5 = deep（qwen2.5:7b @ http://192.168.2.197:11434/v1）`，ping 10ms ok。

实测 `/api/report`：**HTTP 200，33.4s，3053 字**（markdown 命书，含四柱表 + 性格格局卷）。

> 这是临时兜底。本机 7B 写命书质量有限，修好 GLM 渠道或换云端强模型后，在后台点「命书」按钮即可换。

---

## 五、待决策

1. **额度倒挂**：新用户 `quota_total` 默认 5（schema 硬编码），命书扣 5、合盘 20 → 新用户一次就用完 / 必 402。改默认值需 migration，后台只能逐个加。是否改？改成多少？
2. **deep 长期方案**：修 simple-one-api 的 GLM 渠道 / 继续用本机 ollama / 换云端？
3. **生产 VPS 后台密码**是否也改 `wwww0000`（公网弱口令有风险，未擅动）。
4. **未修的排查项**（工作量较大，未动）：7 个文件 17 处裸 `fetch` 绕过 401 拦截；后台缺改密码/会话管理页；知识字典 174 行硬编码中文映射；侧边栏与三栏布局响应式；触摸目标 <44px。

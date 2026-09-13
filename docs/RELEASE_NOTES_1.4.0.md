# ChatGPT NET 1.4.0 发布说明

**发布日期：** 2026-08-09  
**功能基线：** ChatGPT NET Functional Baseline 1.3（46 章、条款 1–500）  
**数据格式：** schema 1 / backup baseline 1.3（不变）

1.4.0 是在已冻结 1.3 功能语义上完成的修正版，不增加 AI、自动关系判断、Alt 快捷操作或旧 Chat Tree 数据迁移。

## 修正内容

- 项目自带 CommonJS 测试边界和统一 `npm test` 命令，不再受父目录 `package.json` 的 ESM 设置影响。
- 浏览器集成测试默认使用 Playwright Chromium，并支持 `CHATGPT_NET_CHROMIUM` 显式覆盖，不再硬编码 Linux 浏览器路径。
- 正文摘录、hash、prefix/suffix 和高亮锚点忽略按钮、菜单、输入控件、隐藏文本、可编辑控件及 NET 自身 UI，避免 ChatGPT 页面控件混入用户摘录。
- schema 对画布元数据、实体/关系时间、锚点字段、备忘录标题、折叠状态、视图边界、自动排列组和长文本最低高度进行完整验证。
- 已保存画布若 schema 无效或无法合法路由，界面停止写入并保留原始存储，不再把问题数据误当成空画布。
- conversation 切换前清理延迟保存任务并刷新旧画布视图，避免延迟任务写入新 conversation。
- 保存冲突会关闭连续摘录并禁用所有会修改当前画布的入口；失败或冲突不会静默继续。
- 工具栏关闭时保留已出现的保存错误提示，同时清理未完成手势、overlay、高亮和运行时监听。
- 仅在删除或“转入备忘录”实际保存成功后改变选择状态，避免保存失败后 UI 与数据不一致。
- Ctrl 框选不再选中被折叠分支隐藏的节点；NET 不再截获任何可编辑控件中的原生 Escape/Ctrl+Z。
- 画布/备忘录分隔比例同时保存为当前 conversation 视图和全局新画布默认值。
- 分支复制后清空旧画布选择，避免旧 entity id 泄漏到新分支的交互状态。

## 验证结果

- `npm test`：通过；包括 15 个 JavaScript 文件语法检查、静态基线审计、schema/DAG 核心测试、500 节点路由压力测试。
- `python tests/browser_integration.py`：通过；包括困难页面让位、正文原生选区、跨消息摘录、控件文本过滤、pointer/HTML5 DnD、层级、备忘录、三色高亮、无效数据保护和工具栏关闭清理。
- Baseline 1.3：46 章和条款 1–500 连续性通过；逐章复核见 `BASELINE_RECHECK_1.4.0.md`。

当前支持边界 Windows Firefox 152+、用户登录状态下的当前生产 ChatGPT、隐私窗口、多标签真实冲突、真实“在新聊天中分支”、约 10 分钟休眠及 500 节点体感仍属于 `MANUAL_ACCEPTANCE_1.3.md` 的目标实机验收边界，不能由 Chromium mock 结果替代。

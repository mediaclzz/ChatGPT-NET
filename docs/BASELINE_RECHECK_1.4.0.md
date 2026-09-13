# ChatGPT NET 1.4.0 — Baseline 1.3 重新校对记录

**校对日期：** 2026-08-09  
**校对范围：** 仓库内全部 Markdown 文档、Functional Baseline 1.3 的 46 章/条款 1–500、Baseline Audit 1.3 的逐条矩阵、Manual Acceptance 1.3 的 0 与 A–R 验收组。  
**版本关系：** 1.4.0 是 1.3 的实现修正版；功能基线、schema 和备份 baseline 均保持 1.3。

## 校对方法与结论

`tests/static_audit.js` 校验基线标题、版本、46 章和 1–500 连续条款，并检查关键禁用能力与运行时常量；`tests/core.test.js` 和 `tests/router_stress.test.js` 验证 schema、DAG、硬性几何及 500 节点路由；`tests/browser_integration.py` 在真实浏览器 DOM 中执行 Range、pointer、HTML5 DnD、布局让位和关闭清理路径。随后按 `BASELINE_AUDIT_1.3.md` 的 500 条矩阵重新回看实现映射。

结论：未发现 1.4.0 对 Baseline 1.3 的已知语义偏离；本轮发现的可复现缺陷已修正，自动测试全部通过。依赖 Firefox chrome、生产 ChatGPT DOM、真实多窗口/多标签或长时间体感的项目仍明确保留为目标实机验收，不能标记为已经实机通过。

## 46 章逐章复核

状态中的“目标实机待验收”表示实现和可执行 mock 已存在，但仍要按人工清单在当前支持边界 Windows Firefox 152+ 与当前生产 ChatGPT 上确认。

| 章 | 主题 | 1.4.0 复核结果 | 主要证据 |
|---:|---|---|---|
| 1 | 产品定位 | 自动/源码通过 | manifest 权限、网络/AI/旧命名空间静态审计 |
| 2 | 插件名称与 Firefox 工具栏状态 | 自动/源码通过；目标实机待验收 | background 按 tab 状态、toolbar close/reopen browser test |
| 3 | 插件侧栏的显示与关闭 | 自动/源码通过；目标实机待验收 | 无页面内开关；fullClose runtime/DOM 清理测试 |
| 4 | ChatGPT 页面与插件的空间关系 | 自动/源码通过；当前 ChatGPT 待验收 | fixed/100vw 正文与 composer 困难布局测试 |
| 5 | 侧栏总体布局 | 自动/源码通过；实机尺寸待验收 | 常量、CSS、初始世界中心断言 |
| 6 | 固定工具区 | 自动/源码通过；Firefox UI 待验收 | toolbar DOM、三槽、解除、zoom 测试 |
| 7 | 画布硬性无重叠规则 | 自动通过 | schema/geometry/router 单元与压力测试 |
| 8 | 手工层级网络 | 自动通过 | 多父 DAG、单条/批量关系浏览器测试 |
| 9 | 删除和解除层级关系 | 自动通过 | edge 删除、共享主干与解除实现/测试 |
| 10 | 节点删除规则 | 自动通过 | 单/批量删除、关系清理和 undo 测试 |
| 11 | 折叠与展开 | 自动/源码通过 | 多父折叠约束、隐藏节点框选排除 |
| 12 | 从 ChatGPT 正文创建节点 | 自动通过；当前 DOM 待验收 | 原生 Range/mouseup、跨消息、控件过滤测试 |
| 13 | 连续摘录 | 自动通过；当前 DOM 待验收 | continuous/Ctrl/Shift browser test；切换时复位 |
| 14 | 自由节点 | 自动通过 | 创建、编辑、拖动、删除和关系测试 |
| 15 | 新节点的自动排列 | 自动/源码通过 | 自动组布局、合法位置与组终止逻辑 |
| 16 | 新节点空间不足时的处理 | 自动通过 | 最近合法组位置与全成/全败测试 |
| 17 | 有限画布 | 自动通过 | 2880×3600、25%–300%、边界 schema 测试 |
| 18 | 节点显示、大小和编辑 | 自动通过；Firefox 字体待验收 | DOM 实测高度 + 平台无关最低高度校验 |
| 19 | 节点手动拖动后的冲突处理顺序 | 自动通过 | geometry/router 候选顺序与失败回滚 |
| 20 | 统一点击与选择规则 | 自动通过 | pointer click/drag、Ctrl/Shift、单选收敛测试 |
| 21 | 画布框选与平移 | 自动/源码通过 | 手势分流、隐藏节点排除、pan 边界 |
| 22 | 画布与备忘录选择区域互斥 | 自动通过 | 双向选择互斥 browser assertions |
| 23 | 画布多选批量操作 | 自动通过 | 批量移动/关系/删除/改色原子路径 |
| 24 | 正文锚点和双向定位 | 自动通过；当前 DOM 待验收 | sanitized anchor、highlight、精确/消息级回退逻辑 |
| 25 | 画布缩放与视图 | 自动/源码通过 | 初始中心、zoom 范围、视图保存/切换刷新 |
| 26 | 备忘录基本行为 | 自动通过 | 画布→memo ghost 与数据保留测试 |
| 27 | 备忘录条目拖回画布 | 自动通过 | 单条 HTML5 DnD、独立根、合法布局 |
| 28 | 多个备忘录条目一起拖回画布 | 自动通过 | 视觉顺序、全成/全败、单步 undo |
| 29 | 备忘录标题 | 自动/源码通过 | 新建/改名/折叠/排序/删除数据约束 |
| 30 | 备忘录选择与批量操作 | 自动/源码通过 | 互斥选择与批量原子 mutate |
| 31 | 删除备忘录条目 | 自动通过 | 真删除、批量与 undo 路径 |
| 32 | 颜色系统 | 自动通过 | 三槽、active、实体颜色与高亮 RGB 一致 |
| 33 | 搜索 | 自动/源码通过 | conversation-local substring 与定位展开 |
| 34 | 撤回与重做 | 自动通过 | 15 步上限、批量单步、非 history 状态保持 |
| 35 | 休眠 | 源码通过；10 分钟实机待验收 | timer/observer 暂停与 toolbar close 区分 |
| 36 | ChatGPT 分支 | 自动/源码通过；真实分支待验收 | fingerprint 校验、可定位实体复制、独立数据 |
| 37 | 导入、导出与备份 | 自动通过；Firefox 下载 UI 待验收 | 严格 bundle/schema/route、完整版本冲突选择 |
| 38 | 隐私窗口 | 源码通过；Firefox private 待验收 | manifest spanning、无首次隐私提示 |
| 39 | 数据恢复和多标签页 | 自动/源码通过；真实多标签待验收 | revision conflict、失败提示保留、切换前刷新 |
| 40 | ChatGPT 页面变化保护 | 自动/源码通过；当前 DOM 待验收 | URL/history 监听、锚点不误绑、无效数据只读保护 |
| 41 | 基本性能和稳定性 | 自动通过；体感待验收 | 500 节点 schema/router 压力测试 |
| 42 | 核心快捷操作总表 | 自动/源码通过 | Ctrl/Escape 规则、editable 原生快捷键保护 |
| 43 | 连续摘录快捷规则总表 | 自动通过 | ordinary/Ctrl/Shift/Alt 静态与浏览器检查 |
| 44 | 明确取消的旧需求 | 自动通过 | forbidden-token、网络 API、旧 namespace 静态审计 |
| 45 | 功能优先级 | 自动/源码通过 | mutate 回滚、schema/router 硬门槛、明确提示 |
| 46 | Baseline 1.3 冻结原则 | 自动通过 | 46 章、1–500 连续性与版本常量断言 |

## 人工验收文档逐组复核

| 组 | 对应内容 | 当前证据 | 目标实机边界 |
|---|---|---|---|
| 0 | 用户实测问题回归门槛 | 困难布局、工具栏关闭、节点 ghost/拖动/删除、三色全部自动通过 | Firefox 图标和生产页面最终确认 |
| A | 工具栏生命周期与后台停止 | close/reopen、手势取消、监听/高亮/宽度恢复自动通过 | per-tab 图标、刷新/重启 |
| B | 页面空间关系与尺寸 | fixed/100vw 双壳、中心、边界自动通过 | 生产 ChatGPT 与窄窗 overlay |
| C | 正文摘录与连续摘录 | Range、跨消息、控件过滤、Ctrl/Shift 自动通过 | 生产消息 DOM |
| D | 节点显示、选择、编辑与移动 | click/pointer/selection/height 自动通过 | Firefox 字体与长文本视觉 |
| E | 框选、平移、缩放 | 源码/常量/边界通过 | Firefox wheel/pointer 手感 |
| F | 多父层级与关系路由 | core/router/browser 自动通过 | 密集布局视觉抽检 |
| G | 删除、折叠与自动排列 | core/browser/源码通过 | 长序列交互抽检 |
| H | 备忘录与分隔标题 | 单/多 HTML5 DnD 自动通过 | Firefox DnD 与完整标题手势 |
| I | 三色与正文高亮 | 三槽和实体/highlight RGB 自动通过 | 生产正文 rect |
| J | 搜索与双向定位 | 源码与 browser anchor 通过 | 消息重新生成/生产 DOM |
| K | Undo/Redo | core/browser 通过 | 16 步完整手工序列 |
| L | 休眠 | 源码通过 | 约 10 分钟真实等待 |
| M | ChatGPT 分支 | fingerprint/clone 源码与 core 通过 | 真实 Branch in new chat |
| N | 导出、导入与数据安全 | schema/route/冲突保护自动通过 | Firefox 下载/文件选择 UI |
| O | 隐私窗口、多标签页、恢复 | revision/source 路径通过 | private window、真实 stale tab、重启 |
| P | ChatGPT 页面变化保护 | mock rerender/导航与只读保护通过 | 生产流式生成与 selector 变化 |
| Q | 500 节点性能 | 500 节点 validate/route 自动通过 | Firefox 拖动/pan/zoom 体感 |
| R | 发布前最后检查 | 静态禁用项、46/500、自动测试通过 | Firefox 控制台与上述实机项 |

## 最终判定

代码和自动化层面可以形成 ChatGPT NET 1.4.0 候选版本；没有已知的、当前环境可复现但尚未修正的 Baseline 1.3 冲突。只有在 `MANUAL_ACCEPTANCE_1.3.md` 中标明的目标实机项目完成后，才能进一步声明“Windows Firefox + 当前生产 ChatGPT 实机验收通过”。

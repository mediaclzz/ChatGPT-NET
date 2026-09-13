# ChatGPT NET 1.3 — Baseline 逐条实现审查报告

**审查日期：** 2026-08-08  
**冻结基线：** ChatGPT NET Functional Baseline 1.3，条款 1–500  
**实现目录：** `chatgpt-net-work`  
**目标环境：** Windows Firefox 152+ + 当前生产 ChatGPT

## 1. 审查结论

本轮不是只针对截图中的六项表面问题修改样式，而是重新沿 Baseline 1.3 的 46 个章节、500 条条款回查数据模型、浏览器生命周期、页面让位、选择/拖动状态机、关系路由、正文锚点、备忘录、历史、分支、备份和性能边界。

用户实测暴露的两个根因已经定位并修改：第一，旧实现只缩窄了一个不稳定的 ChatGPT 外层容器，无法约束内部 `position: fixed` / `100vw` 的正文壳和独立输入框壳，因此侧栏仍可能覆盖正文；现在 `UI.reservePage` 会定位实际 ChatGPT host，并继续检查正文与输入框的祖先壳层，把侵入右侧预留区的固定/全视口容器同步缩窄。第二，旧节点 `pointerdown` 会立即整棵重绘并预生成 ghost，导致当前 pointer target 在手势中被 DOM 替换，形成截图中的空白残影和“选中后不能拖动”；现在单击只同步 selection class，拖动超过阈值后才进入移动，ghost 仅在进入备忘录区域时创建，取消/释放/删除均清理残留。

本轮又在逐条审查中主动发现并修正了四类非截图问题：普通单击多选集合中的一个节点现在会在“没有发生拖动”时收敛为单选，同时仍允许从已选节点直接拖动整个组；Shift 正文定位路径也强制保持画布/备忘录选择区域互斥；从 Firefox 工具栏关闭时会先结算进行中的编辑、取消未完成 pointer 手势并卸载其临时监听，避免关闭后残留捕获器；导入 schema 进一步拒绝畸形 RGB、无有效正文锚点以及会造成“模型高度小于实际渲染高度”的非法节点尺寸。

自动化现已覆盖浏览器 DOM 与真实 pointer/HTML5 DnD 路径，而不只是 Node 单元测试：包括页面真实让位、左移重排、独立 composer 壳、普通/连续摘录、Ctrl 绕过、跨消息拆分、节点单击/拖动/删除、单条与批量建关系、`解除`、画布→备忘录 ghost、单条/多条备忘录拖回、颜色-高亮对应、选择区域互斥，以及“手势进行中点击工具栏关闭”的清理路径。

仍必须保留一个验收边界：当前执行环境没有 Windows Firefox 和用户登录状态下的生产 ChatGPT，因此下表中标记“实机待验收”的项目不能被宣称已经在目标环境通过。源码/算法/Chromium DOM 模拟通过证明实现路径存在并可执行，但 Firefox 工具栏、Firefox 原生选择/DnD差异、生产 ChatGPT 当前 DOM、隐私窗口、多标签页、真实分支和 500 节点体感帧率仍必须按 `MANUAL_ACCEPTANCE_1.3.md` 验收。

## 2. 用户本轮反馈的修正状态

| 用户反馈 | 根因 | 修正 | 自动回归 |
|---|---|---|---|
| 正文仍被右侧画布遮挡 | 只缩窄单一外层，内部 fixed/100vw 正文和 composer 仍占满视口 | 实际 host + 正文祖先 + composer 祖先同步预留；窄窗才允许 overlay | fixed/100vw 双壳 mock 的正文、输入区、host 右边界均不越过侧栏；正文中心实际左移 |
| 去掉 `>>`/`<<`，仅 Firefox 图标开关 | 1.2 仍保留双状态设计 | 删除页面收起状态；图标亮=运行显示，灰=完全关闭当前标签页 runtime | close/reopen mock；关闭后 sidebar/highlight/reserve/timer/storage-listener 全部消失 |
| “解除层级”改“解除” | 文案未同步 | 工具栏和基线统一为 `解除` | toolbar DOM assertion |
| 单击节点出现空白框、不能移动/删除残留 | pointerdown 时重绘 DOM + 过早创建 ghost | pointerdown 不重绘；3px 阈值；ghost 只在 memo 区；全路径清理 | click=1 node/0 ghost；真实 pointer drag 可移动；delete 后 0 node/0 ghost |
| 节点颜色与正文高亮一致 | 高亮未以 entity 实际颜色为唯一来源 | highlighter 直接接收 `entity.color`，半透明显示；多对象同位置可分段渐变 | `#C9D9C5` 节点与 highlight RGB 一致 |
| 只保留 3 个颜色 | 旧基线五色 | 常量、schema、工具栏、分支、备份全部改为三槽 | static + browser 3-slot assertion |

## 3. 本轮额外修正

- 新画布初始视图使用**实际 canvas viewport**计算，世界视图中心固定在 `x≈1440, y≈900`，避免浏览器高度变化造成“上 1/4”偏移。
- SVG 箭头 marker 的 tip 终止在子节点边框端点，避免箭头几何伸入节点。
- 共享主干双击删除从“路径距离近似”改为“真实共线重叠 + 共同父/共同子”判断，防止低缩放下邻近平行线被误判为共享主干。
- ChatGPT 导航监听不再对整页流式 DOM 做导航检测；使用 URL 低频检测 + history 事件，并在关闭时完整解绑。
- 分支复制加入来源 conversation fingerprint 前缀验证；无法可靠确认分支来源时宁可不复制，也不错误复制/绑定。
- 页面/侧栏改变导致 ChatGPT 重排时，正文高亮会重新计算 rect，避免高亮停在旧位置。
- 关闭时先 blur/结算 NET 内编辑、等待写队列、取消未完成 drag/pan/resize/split/sidebar-resize，再销毁 runtime；保存失败时错误提示不会被立即清掉。
- 导入验证增加严格 RGB、正文锚点和渲染尺寸约束，避免合法性检查与真实 DOM 尺寸不一致。

## 4. 自动化执行范围

```text
node --check background.js src/shared/*.js src/content/*.js tests/*.js
node tests/static_audit.js
node tests/core.test.js
node tests/router_stress.test.js
python tests/browser_integration.py
```

测试含义：Node 测试验证 schema/DAG/router/500 节点算法；浏览器集成测试使用 headless Chromium 构造带左侧 rail、嵌套 fixed/100vw conversation shell 和独立 fixed composer shell 的困难布局，并执行真实 pointer、Range/mouseup 和 HTML5 drag-and-drop。它比纯源码审查更接近页面运行，但不能替代目标 Windows Firefox + 生产 ChatGPT。

## 5. 状态标记

- **自动/源码通过**：至少有可执行断言覆盖核心不变量/行为，并完成源码映射。
- **源码通过**：实现路径已逐项检查，但当前自动测试没有直接覆盖完整用户手势。
- **…实机待验收**：实现存在且自动模拟通过或源码通过，但仍依赖 Firefox/当前 ChatGPT 的真实运行差异；发布前必须人工验收。

## 6. 条款 1–500 逐条矩阵

| 条款 | 章节 | 要求摘要 | 审查状态 | 实现/证据 |
|---:|---|---|---|---|
| 1 | §1 产品定位 | ChatGPT NET 是用于 ChatGPT 对话内容摘录和手工整理的本地画布工具。 | 自动/源码通过 | `manifest.json`; `tests/static_audit.js`; no AI/network/legacy-action source paths |
| 2 | §1 产品定位 | 每个 ChatGPT 对话拥有独立的画布和备忘录。 | 自动/源码通过 | `manifest.json`; `tests/static_audit.js`; no AI/network/legacy-action source paths |
| 3 | §1 产品定位 | 用户自行决定摘录哪些内容、如何放置节点以及如何建立层级关系。 | 自动/源码通过 | `manifest.json`; `tests/static_audit.js`; no AI/network/legacy-action source paths |
| 4 | §1 产品定位 | ChatGPT NET 本质上是一个手工层级网络整理工具，不是 AI 思维导图。 | 自动/源码通过 | `manifest.json`; `tests/static_audit.js`; no AI/network/legacy-action source paths |
| 5 | §1 产品定位 | 使用画布过程中不需要 GPT 参与。 | 自动/源码通过 | `manifest.json`; `tests/static_audit.js`; no AI/network/legacy-action source paths |
| 6 | §1 产品定位 | 不提供 AI 摘要。 | 自动/源码通过 | `manifest.json`; `tests/static_audit.js`; no AI/network/legacy-action source paths |
| 7 | §1 产品定位 | 不提供 AI 分类。 | 自动/源码通过 | `manifest.json`; `tests/static_audit.js`; no AI/network/legacy-action source paths |
| 8 | §1 产品定位 | 不提供 AI 自动建立层级关系。 | 自动/源码通过 | `manifest.json`; `tests/static_audit.js`; no AI/network/legacy-action source paths |
| 9 | §1 产品定位 | 不提供 AI 自动整理或自动布局。 | 自动/源码通过 | `manifest.json`; `tests/static_audit.js`; no AI/network/legacy-action source paths |
| 10 | §1 产品定位 | 不提供任务、截止日期、优先级、提醒或协作功能。 | 自动/源码通过 | `manifest.json`; `tests/static_audit.js`; no AI/network/legacy-action source paths |
| 11 | §1 产品定位 | 不自动合并不同对话的画布。 | 自动/源码通过 | `manifest.json`; `tests/static_audit.js`; no AI/network/legacy-action source paths |
| 12 | §1 产品定位 | 不提供跨所有 ChatGPT 对话的全局搜索。 | 自动/源码通过 | `manifest.json`; `tests/static_audit.js`; no AI/network/legacy-action source paths |
| 13 | §1 产品定位 | 不提供节点克隆或跨画布移动。 | 自动/源码通过 | `manifest.json`; `tests/static_audit.js`; no AI/network/legacy-action source paths |
| 14 | §1 产品定位 | 不调用 ChatGPT 非公开 API。 | 自动/源码通过 | `manifest.json`; `tests/static_audit.js`; no AI/network/legacy-action source paths |
| 15 | §1 产品定位 | 不自动发送 ChatGPT 消息。 | 自动/源码通过 | `manifest.json`; `tests/static_audit.js`; no AI/network/legacy-action source paths |
| 16 | §1 产品定位 | 不修改 ChatGPT 网络请求。 | 自动/源码通过 | `manifest.json`; `tests/static_audit.js`; no AI/network/legacy-action source paths |
| 17 | §2 插件名称与 Firefox 工具栏状态 | 插件名称统一为 ChatGPT NET。 | 自动/源码通过 | `background.js` per-tab action/session state; `main.js::fullClose`; browser integration close/reopen |
| 18 | §2 插件名称与 Firefox 工具栏状态 | Firefox 工具栏显示 ChatGPT NET 图标；图标的亮/灰状态按当前 ChatGPT 标签页独立维护。 | 自动/源码通过；Firefox 实机待验收 | `background.js` per-tab action/session state; `main.js::fullClose`; browser integration close/reopen |
| 19 | §2 插件名称与 Firefox 工具栏状态 | 当前标签页图标亮起表示 ChatGPT NET 在该标签页中正在运行；其他标签页的状态不受影响。 | 自动/源码通过；Firefox 实机待验收 | `background.js` per-tab action/session state; `main.js::fullClose`; browser integration close/reopen |
| 20 | §2 插件名称与 Firefox 工具栏状态 | 当前标签页图标灰色表示 ChatGPT NET 仅在该标签页中完全关闭；不得因此关闭其他 ChatGPT 标签页中的 ChatGPT NET。 | 自动/源码通过；Firefox 实机待验收 | `background.js` per-tab action/session state; `main.js::fullClose`; browser integration close/reopen |
| 21 | §2 插件名称与 Firefox 工具栏状态 | 当前标签页中插件界面正常展开时，图标为亮色。 | 自动/源码通过；Firefox 实机待验收 | `background.js` per-tab action/session state; `main.js::fullClose`; browser integration close/reopen |
| 22 | §2 插件名称与 Firefox 工具栏状态 | 当前标签页不设置页面内 `>>` / `<<` 收起状态。Firefox 工具栏图标是 ChatGPT NET 页面界面显示/关闭的唯一总开关：亮色表示该标签页中的 ChatGPT NET 正在显示并运行，灰色表示该标签页中的 ChatGPT NET 已关闭。 | 自动/源码通过；Firefox 实机待验收 | `background.js` per-tab action/session state; `main.js::fullClose`; browser integration close/reopen |
| 23 | §2 插件名称与 Firefox 工具栏状态 | 点击当前标签页的亮色 Firefox 工具栏图标，只在该标签页内关闭 ChatGPT NET： - 该标签页图标变灰； - 该标签页中的 ChatGPT NET 页面界面全部消失； - 该标签页中的画布停止计时器、DOM 监听、高亮刷新、路由/布局等持续后台活动，仅保留 Firefo… | 自动/源码通过；Firefox 实机待验收 | `background.js` per-tab action/session state; `main.js::fullClose`; browser integration close/reopen |
| 24 | §2 插件名称与 Firefox 工具栏状态 | 再次点击当前标签页的灰色 Firefox 工具栏图标： - 该标签页图标重新变亮； - ChatGPT NET 在该标签页中重新显示并恢复运行； - 如果该标签页仍处于关闭前的 conversation，恢复该 conversation 关闭前的画布位置、缩放等视图状态； - 如果关… | 自动/源码通过；Firefox 实机待验收 | `background.js` per-tab action/session state; `main.js::fullClose`; browser integration close/reopen |
| 25 | §3 插件侧栏的显示与关闭 | ChatGPT NET 不设置页面内 `>>` 收起按钮。 | 自动/源码通过；Firefox 实机待验收 | no page collapse source/CSS; toolbar-only close/reopen browser integration |
| 26 | §3 插件侧栏的显示与关闭 | ChatGPT NET 不设置页面内 `<<` 恢复按钮。 | 自动/源码通过；Firefox 实机待验收 | no page collapse source/CSS; toolbar-only close/reopen browser integration |
| 27 | §3 插件侧栏的显示与关闭 | ChatGPT NET 侧栏的显示与关闭仅由当前标签页的 Firefox 工具栏 ChatGPT NET 图标控制，不另设页面内第二套收起状态。 | 自动/源码通过；Firefox 实机待验收 | no page collapse source/CSS; toolbar-only close/reopen browser integration |
| 28 | §3 插件侧栏的显示与关闭 | 点击亮色 Firefox 工具栏图标关闭时，侧栏立即从页面中移除，ChatGPT 页面同时恢复原始可用宽度。 | 自动/源码通过；Firefox 实机待验收 | no page collapse source/CSS; toolbar-only close/reopen browser integration |
| 29 | §3 插件侧栏的显示与关闭 | 关闭后不得继续运行画布计时器、高频 DOM MutationObserver、正文高亮刷新、路由计算或其他可安全停止的画布后台处理。 | 自动/源码通过；Firefox 实机待验收 | no page collapse source/CSS; toolbar-only close/reopen browser integration |
| 30 | §3 插件侧栏的显示与关闭 | 点击灰色 Firefox 工具栏图标重新开启时，侧栏重新出现，ChatGPT 页面重新为其让出空间，并恢复当前 conversation 已保存的画布状态。 | 自动/源码通过；Firefox 实机待验收 | no page collapse source/CSS; toolbar-only close/reopen browser integration |
| 31 | §3 插件侧栏的显示与关闭 | 不存在“侧栏收起但插件仍运行”的中间状态；因此也不存在亮色图标但页面只保留 `<<` 按钮的状态。 | 自动/源码通过；Firefox 实机待验收 | no page collapse source/CSS; toolbar-only close/reopen browser integration |
| 32 | §3 插件侧栏的显示与关闭 | 当前标签页图标亮色与“侧栏显示并运行”一一对应；图标灰色与“侧栏关闭且画布后台活动停止”一一对应。 | 自动/源码通过；Firefox 实机待验收 | no page collapse source/CSS; toolbar-only close/reopen browser integration |
| 33 | §4 ChatGPT 页面与插件的空间关系 | 正常桌面状态下，ChatGPT NET 不得覆盖在 ChatGPT 主界面上方。 | 自动/源码通过；当前 ChatGPT 实机待验收 | `UI.reservePage`; fixed/100vw message + separate composer mock; leftward reflow assertion |
| 34 | §4 ChatGPT 页面与插件的空间关系 | 插件显示后，应当使 ChatGPT 可使用的页面宽度真正缩小；实现必须作用于实际承载 ChatGPT 主界面的布局容器，而不能只在视觉上覆盖右侧区域。 | 自动/源码通过；当前 ChatGPT 实机待验收 | `UI.reservePage`; fixed/100vw message + separate composer mock; leftward reflow assertion |
| 35 | §4 ChatGPT 页面与插件的空间关系 | 视觉和使用效果相当于整个 ChatGPT 页面窗口变窄：ChatGPT 根据新的可用宽度自行重新排版，正文、输入区及其主要布局不得继续延伸到侧栏下面。 | 自动/源码通过；当前 ChatGPT 实机待验收 | `UI.reservePage`; fixed/100vw message + separate composer mock; leftward reflow assertion |
| 36 | §4 ChatGPT 页面与插件的空间关系 | ChatGPT 主界面因此整体向左重新布局并利用左侧可用空间，为右侧 ChatGPT NET 腾出真实空间；不得因为 ChatGPT 内部存在固定宽度、`100vw` 或嵌套全屏容器而仍让正文落入侧栏覆盖区域。 | 自动/源码通过；当前 ChatGPT 实机待验收 | `UI.reservePage`; fixed/100vw message + separate composer mock; leftward reflow assertion |
| 37 | §4 ChatGPT 页面与插件的空间关系 | 插件关闭后，ChatGPT 页面向右恢复到没有插件时的位置和宽度。 | 自动/源码通过；当前 ChatGPT 实机待验收 | `UI.reservePage`; fixed/100vw message + separate composer mock; leftward reflow assertion |
| 38 | §4 ChatGPT 页面与插件的空间关系 | 改变 ChatGPT NET 侧栏宽度时，ChatGPT 页面同步获得相应的可用宽度。 | 自动/源码通过；当前 ChatGPT 实机待验收 | `UI.reservePage`; fixed/100vw message + separate composer mock; leftward reflow assertion |
| 39 | §4 ChatGPT 页面与插件的空间关系 | 插件不得通过简单覆盖 ChatGPT 正文来实现正常桌面模式。 | 自动/源码通过；当前 ChatGPT 实机待验收 | `UI.reservePage`; fixed/100vw message + separate composer mock; leftward reflow assertion |
| 40 | §4 ChatGPT 页面与插件的空间关系 | 如果浏览器窗口过窄，确实无法合理为插件腾出空间，则允许进入覆盖模式。 | 自动/源码通过；当前 ChatGPT 实机待验收 | `UI.reservePage`; fixed/100vw message + separate composer mock; leftward reflow assertion |
| 41 | §4 ChatGPT 页面与插件的空间关系 | 覆盖模式下不新增页面内收起按钮；用户仍可随时点击 Firefox 工具栏的亮色 ChatGPT NET 图标关闭侧栏并恢复 ChatGPT 页面。 | 自动/源码通过；当前 ChatGPT 实机待验收 | `UI.reservePage`; fixed/100vw message + separate composer mock; leftward reflow assertion |
| 42 | §4 ChatGPT 页面与插件的空间关系 | ChatGPT NET 不得破坏 ChatGPT 原有输入框、消息滚动、文字选择、复制及正常页面操作。 | 自动/源码通过；当前 ChatGPT 实机待验收 | `UI.reservePage`; fixed/100vw message + separate composer mock; leftward reflow assertion |
| 43 | §5 侧栏总体布局 | ChatGPT NET 侧栏从上到下依次包括： 1. 当前 ChatGPT 对话标题； 2. 固定工具区； 3. 画布； 4. 画布与备忘录分隔拖柄； 5. 备忘录标题栏； 6. 备忘录内容区。 | 自动/源码通过；实机尺寸待验收 | constants/CSS; browser initial world-center assertion; sidebar/split code |
| 44 | §5 侧栏总体布局 | 不设置独立画布标题，直接使用当前 ChatGPT 对话标题。 | 自动/源码通过；实机尺寸待验收 | constants/CSS; browser initial world-center assertion; sidebar/split code |
| 45 | §5 侧栏总体布局 | 侧栏默认宽度约为 420 CSS px；画布视口是侧栏内部的实际可交互画布区域，不等同于侧栏总宽度。浏览器可用空间允许时，新画布初始展开的画布视口设计尺寸为 360 × 900 CSS px。 | 自动/源码通过；实机尺寸待验收 | constants/CSS; browser initial world-center assertion; sidebar/split code |
| 46 | §5 侧栏总体布局 | 用户可以拖动调整侧栏宽度；画布视口的设计最大尺寸为 720 × 900 CSS px，不得因侧栏继续扩大而改变既有画布的世界边界。 | 自动/源码通过；实机尺寸待验收 | constants/CSS; browser initial world-center assertion; sidebar/split code |
| 47 | §5 侧栏总体布局 | 在未受到浏览器可用高度及 900 CSS px 画布视口上限约束时，画布默认占侧栏可分配垂直空间约 75%；如果浏览器可用空间不足，则画布视口按实际可用空间缩小。 | 自动/源码通过；实机尺寸待验收 | constants/CSS; browser initial world-center assertion; sidebar/split code |
| 48 | §5 侧栏总体布局 | 备忘录默认占约 25%；当画布视口受到 900 CSS px 高度上限约束时，剩余可用垂直空间可由备忘录使用。 | 自动/源码通过；实机尺寸待验收 | constants/CSS; browser initial world-center assertion; sidebar/split code |
| 49 | §5 侧栏总体布局 | 用户可以拖动画布和备忘录之间的分隔线调整比例。 | 自动/源码通过；实机尺寸待验收 | constants/CSS; browser initial world-center assertion; sidebar/split code |
| 50 | §5 侧栏总体布局 | 用户设置的侧栏宽度和画布/备忘录比例应被保存。 | 自动/源码通过；实机尺寸待验收 | constants/CSS; browser initial world-center assertion; sidebar/split code |
| 51 | §5 侧栏总体布局 | 调整侧栏宽度或画布/备忘录比例不得自动改变画布缩放比例。 | 自动/源码通过；实机尺寸待验收 | constants/CSS; browser initial world-center assertion; sidebar/split code |
| 52 | §5 侧栏总体布局 | 不保留独立“适合内容”按钮。 | 自动/源码通过；实机尺寸待验收 | constants/CSS; browser initial world-center assertion; sidebar/split code |
| 53 | §5 侧栏总体布局 | 不保留“适合内容”功能。 | 自动/源码通过；实机尺寸待验收 | constants/CSS; browser initial world-center assertion; sidebar/split code |
| 54 | §6 固定工具区 | 固定工具区从左到右依次包括： - 撤回； - 重做； - 连续摘录； - 自由节点； - 删除； - 解除； - 搜索； - 三个颜色块； - 一个共用颜色设置齿轮； - 当前缩放百分比； - 设置。 | 自动/源码通过 | `buildToolbar`; 3-color/解除/no->> browser assertions; selection popup implementation |
| 55 | §6 固定工具区 | “自由节点”按钮文字固定使用“自由节点”。 | 自动/源码通过；实机交互待验收 | `buildToolbar`; 3-color/解除/no->> browser assertions; selection popup implementation |
| 56 | §6 固定工具区 | 不设置独立的批量模式。 | 自动/源码通过；实机交互待验收 | `buildToolbar`; 3-color/解除/no->> browser assertions; selection popup implementation |
| 57 | §6 固定工具区 | 多选节点或备忘录条目后直接执行对应批量操作。 | 自动/源码通过；实机交互待验收 | `buildToolbar`; 3-color/解除/no->> browser assertions; selection popup implementation |
| 58 | §6 固定工具区 | 普通正文摘录的“创建节点”入口仅在文字选区附近出现。 | 自动/源码通过；实机交互待验收 | `buildToolbar`; 3-color/解除/no->> browser assertions; selection popup implementation |
| 59 | §6 固定工具区 | “创建节点”不长期占用固定工具区。 | 自动/源码通过；实机交互待验收 | `buildToolbar`; 3-color/解除/no->> browser assertions; selection popup implementation |
| 60 | §6 固定工具区 | 连续摘录开启时必须有持续可见的状态标识。 | 自动/源码通过；实机交互待验收 | `buildToolbar`; 3-color/解除/no->> browser assertions; selection popup implementation |
| 61 | §6 固定工具区 | 用户可以通过该状态标识或对应工具按钮关闭连续摘录。 | 自动/源码通过；实机交互待验收 | `buildToolbar`; 3-color/解除/no->> browser assertions; selection popup implementation |
| 62 | §7 画布硬性无重叠规则 | 除用户正在把一个节点拖到另一个节点上、准备建立层级关系的临时状态外，任何两个节点的边框不得重合。 | 自动/源码通过；实机视觉/手势待验收 | `Schema.validateCanvas`; `Router.routeAll/exactValid`; core + router stress tests |
| 63 | §7 画布硬性无重叠规则 | 最终状态下，节点之间必须存在有效间隔。 | 自动/源码通过；实机视觉/手势待验收 | `Schema.validateCanvas`; `Router.routeAll/exactValid`; core + router stress tests |
| 64 | §7 画布硬性无重叠规则 | 层级关系箭头不得穿过、覆盖或接触任何无关节点。 | 自动/源码通过；实机视觉/手势待验收 | `Schema.validateCanvas`; `Router.routeAll/exactValid`; core + router stress tests |
| 65 | §7 画布硬性无重叠规则 | 一条关系线只允许在自己的起点与父节点边框接触。 | 自动/源码通过；实机视觉/手势待验收 | `Schema.validateCanvas`; `Router.routeAll/exactValid`; core + router stress tests |
| 66 | §7 画布硬性无重叠规则 | 一条关系线只允许在自己的终点与子节点边框接触。 | 自动/源码通过；实机视觉/手势待验收 | `Schema.validateCanvas`; `Router.routeAll/exactValid`; core + router stress tests |
| 67 | §7 画布硬性无重叠规则 | 除上述合法起点和终点外，关系线不得接触任何节点。 | 自动/源码通过；实机视觉/手势待验收 | `Schema.validateCanvas`; `Router.routeAll/exactValid`; core + router stress tests |
| 68 | §7 画布硬性无重叠规则 | 不同关系线不得相互交叉。 | 自动/源码通过；实机视觉/手势待验收 | `Schema.validateCanvas`; `Router.routeAll/exactValid`; core + router stress tests |
| 69 | §7 画布硬性无重叠规则 | 不同关系线不得相互重叠。 | 自动/源码通过；实机视觉/手势待验收 | `Schema.validateCanvas`; `Router.routeAll/exactValid`; core + router stress tests |
| 70 | §7 画布硬性无重叠规则 | 不同关系线不得形成无法区分所属关系的覆盖。 | 自动/源码通过；实机视觉/手势待验收 | `Schema.validateCanvas`; `Router.routeAll/exactValid`; core + router stress tests |
| 71 | §7 画布硬性无重叠规则 | 唯一允许共享线段的情况是： - 多条关系具有相同起点；或 - 多条关系具有相同终点。 | 自动/源码通过；实机视觉/手势待验收 | `Schema.validateCanvas`; `Router.routeAll/exactValid`; core + router stress tests |
| 72 | §7 画布硬性无重叠规则 | 在具有共同起点或共同终点时，可以在共同端附近共享一段主干线。 | 自动/源码通过；实机视觉/手势待验收 | `Router.simpleCandidates/sharedTrunkAt/exactValid`; shared-prefix core/browser assertions |
| 73 | §7 画布硬性无重叠规则 | 离开共同主干后，各条关系线必须能够明确区分。 | 自动/源码通过；实机视觉/手势待验收 | `Router.simpleCandidates/sharedTrunkAt/exactValid`; branch-distinction core/browser assertions |
| 74 | §7 画布硬性无重叠规则 | 没有共同起点、也没有共同终点的关系线不得共享主干。 | 自动/源码通过；实机视觉/手势待验收 | `Schema.validateCanvas`; `Router.routeAll/exactValid`; core + router stress tests |
| 75 | §7 画布硬性无重叠规则 | 所有新建、移动、拖回、建立关系和重新布局行为都必须遵守上述规则。 | 自动/源码通过；实机视觉/手势待验收 | `Schema.validateCanvas`; `Router.routeAll/exactValid`; core + router stress tests |
| 76 | §7 画布硬性无重叠规则 | 系统不得为了保留用户指定位置而接受永久非法重叠。 | 自动/源码通过；实机视觉/手势待验收 | `Schema.validateCanvas`; `Router.routeAll/exactValid`; core + router stress tests |
| 77 | §8 手工层级网络 | ChatGPT NET 使用手工层级网络，不使用单父节点树模型。 | 自动/源码通过；实机视觉/手势待验收 | `graph.js`; multi-parent DAG layout; actual single/batch pointer hierarchy browser tests |
| 78 | §8 手工层级网络 | 一个节点可以有多个父节点。 | 自动/源码通过；实机视觉/手势待验收 | `graph.js`; relation-drop solver; actual single/batch pointer hierarchy browser tests |
| 79 | §8 手工层级网络 | 一个节点也可以有多个子节点。 | 自动/源码通过；实机视觉/手势待验收 | `graph.js`; relation-drop solver; actual single/batch pointer hierarchy browser tests |
| 80 | §8 手工层级网络 | 所有层级关系均由用户手工建立。 | 自动/源码通过；实机拖放待验收 | `graph.js`; relation-drop solver; actual single/batch pointer hierarchy browser tests |
| 81 | §8 手工层级网络 | 系统不得根据文字内容自动判断层级。 | 自动/源码通过；实机拖放待验收 | `graph.js`; relation-drop solver; actual single/batch pointer hierarchy browser tests |
| 82 | §8 手工层级网络 | 用户将一个节点拖到另一个未被选中的节点主体上并释放，可以建立父子关系；被拖动节点为子节点，落点节点为父节点。当前选择多个画布节点时，拖到另一个未选节点主体上释放采用以下批量关系规则： - 如果全部被选节点当前都没有任何父级关系，则尝试让落点节点成为这些被选节点的共同父节点；这些被选节… | 自动/源码通过；实机拖放待验收 | `graph.js`; relation-drop solver; actual single/batch pointer hierarchy browser tests |
| 83 | §8 手工层级网络 | 单节点可增加第二父节点，但同一子节点的任意两个父节点之间不得存在直接或间接的上游/下游关系；拟新增关系会产生该冲突时必须拒绝整个操作并明确提示。 | 自动/源码通过；实机拖放待验收 | `schema.js`; `graph.js` parent-set independence; relation-drop conflict toast; single/multi-parent browser tests |
| 84 | §8 手工层级网络 | 同一对节点之间不能重复建立相同方向的关系。 | 自动/源码通过；实机视觉/手势待验收 | `graph.js`; relation-drop solver; actual single/batch pointer hierarchy browser tests |
| 85 | §8 手工层级网络 | 不允许节点指向自己。 | 自动/源码通过；实机视觉/手势待验收 | `graph.js`; relation-drop solver; actual single/batch pointer hierarchy browser tests |
| 86 | §8 手工层级网络 | 不允许形成循环关系。 | 自动/源码通过；实机视觉/手势待验收 | `graph.js`; relation-drop solver; actual single/batch pointer hierarchy browser tests |
| 87 | §8 手工层级网络 | 每一条关系使用方向明确的箭头表示。 | 自动/源码通过；实机视觉/手势待验收 | `graph.js`; relation-drop solver; actual single/batch pointer hierarchy browser tests |
| 88 | §8 手工层级网络 | 箭头方向为父节点指向子节点。 | 自动/源码通过；实机视觉/手势待验收 | `graph.js`; relation-drop solver; actual single/batch pointer hierarchy browser tests |
| 89 | §8 手工层级网络 | 建立单条或批量关系时，应优先通过重新规划关系线找到合法路径；具有共同父节点的批量关系可以依照第 71～73 条在共同父节点附近共享主干。 | 自动/源码通过；实机视觉/手势待验收 | structured hierarchy router; shared vertical trunk/horizontal bus; complex DAG browser test |
| 90 | §8 手工层级网络 | 必要时可以有限移动直接相关的局部节点；多选节点作为一个整体移动时必须保持组内相对位置。 | 自动/源码通过；实机拖放待验收 | whole affected hierarchy translation candidates; unrelated nodes remain fixed |
| 91 | §8 手工层级网络 | 不得为了建立新关系而大范围重新排列用户已经整理好的画布。 | 自动/源码通过；实机拖放待验收 | relation-connected component only; ordinary drag and unrelated components/routes remain fixed |
| 92 | §8 手工层级网络 | 如果有限画布内找不到满足全部无冲突规则的合法路径，则不能强行建立关系；批量建立关系时任何一条候选关系无解，都视为整次批量操作失败，不允许部分成功。 | 自动/源码通过；实机视觉/手势待验收 | no A* fallback for new hierarchy; structured placement failure rejects the atomic operation |
| 93 | §8 手工层级网络 | 此时提示： “无法建立该层级：当前没有无冲突路径。” | 自动/源码通过；实机拖放待验收 | `graph.js`; relation-drop solver; actual single/batch pointer hierarchy browser tests |
| 94 | §9 删除和解除层级关系 | 双击某条关系独有的线段，只删除该条关系。 | 自动/源码通过；实机双击待验收 | `Router.sharedTrunkAt` core tests; `onEdgeDoubleClick`; `unlinkSelected` |
| 95 | §9 删除和解除层级关系 | 如果双击的是多条关系共享的主干线，不删除任何关系。 | 自动/源码通过；实机双击待验收 | `Router.sharedTrunkAt` core tests; `onEdgeDoubleClick`; `unlinkSelected` |
| 96 | §9 删除和解除层级关系 | 此时提示： “无法删除” | 自动/源码通过；实机双击待验收 | `Router.sharedTrunkAt` core tests; `onEdgeDoubleClick`; `unlinkSelected` |
| 97 | §9 删除和解除层级关系 | 工具栏“解除”作用于当前选中的画布节点。 | 自动/源码通过 | `Router.sharedTrunkAt` core tests; `onEdgeDoubleClick`; `unlinkSelected` |
| 98 | §9 删除和解除层级关系 | 使用“解除”时，删除所选节点的全部父级关系。 | 自动/源码通过；实机双击待验收 | `Router.sharedTrunkAt` core tests; `onEdgeDoubleClick`; `unlinkSelected` |
| 99 | §9 删除和解除层级关系 | 所选节点作为父节点指向下游节点的关系保持不变。 | 自动/源码通过；实机双击待验收 | `Router.sharedTrunkAt` core tests; `onEdgeDoubleClick`; `unlinkSelected` |
| 100 | §9 删除和解除层级关系 | 如果因此某节点没有任何父级，则该节点成为根节点。 | 自动/源码通过；实机双击待验收 | `Router.sharedTrunkAt` core tests; `onEdgeDoubleClick`; `unlinkSelected` |
| 101 | §9 删除和解除层级关系 | 解除关系不得删除节点本身。 | 自动/源码通过；实机双击待验收 | `Router.sharedTrunkAt` core tests; `onEdgeDoubleClick`; `unlinkSelected` |
| 102 | §9 删除和解除层级关系 | 解除关系不应移动无关节点。 | 自动/源码通过；实机双击待验收 | `Router.sharedTrunkAt` core tests; `onEdgeDoubleClick`; `unlinkSelected` |
| 103 | §10 节点删除规则 | 删除单个节点时，删除该节点。 | 自动/源码通过 | `deleteSelected`; graph edge cleanup; browser delete/no-orphan regression |
| 104 | §10 节点删除规则 | 同时删除所有以该节点为起点或终点的关系。 | 自动/源码通过 | `deleteSelected`; graph edge cleanup; browser delete/no-orphan regression |
| 105 | §10 节点删除规则 | 该节点的子节点本身不删除。 | 自动/源码通过 | `deleteSelected`; graph edge cleanup; browser delete/no-orphan regression |
| 106 | §10 节点删除规则 | 子节点与其他父节点之间的关系继续保留。 | 自动/源码通过 | `deleteSelected`; graph edge cleanup; browser delete/no-orphan regression |
| 107 | §10 节点删除规则 | 如果某个幸存子节点因此失去全部父节点，则成为根节点。 | 自动/源码通过 | `deleteSelected`; graph edge cleanup; browser delete/no-orphan regression |
| 108 | §10 节点删除规则 | 更下游节点之间原有关系保持不变。 ### 批量删除 | 自动/源码通过 | `deleteSelected`; graph edge cleanup; browser delete/no-orphan regression |
| 109 | §10 节点删除规则 | 批量删除时，一次性删除全部选中节点。 | 自动/源码通过 | `deleteSelected`; graph edge cleanup; browser delete/no-orphan regression |
| 110 | §10 节点删除规则 | 同时删除所有以这些节点为起点或终点的关系。 | 自动/源码通过 | `deleteSelected`; graph edge cleanup; browser delete/no-orphan regression |
| 111 | §10 节点删除规则 | 未删除节点之间原本存在的关系完全保留。 | 自动/源码通过 | `deleteSelected`; graph edge cleanup; browser delete/no-orphan regression |
| 112 | §10 节点删除规则 | 某个幸存节点如果因此失去全部父节点，则成为根节点。 | 自动/源码通过 | `deleteSelected`; graph edge cleanup; browser delete/no-orphan regression |
| 113 | §10 节点删除规则 | 批量删除作为一个完整操作执行。 | 自动/源码通过 | `deleteSelected`; graph edge cleanup; browser delete/no-orphan regression |
| 114 | §10 节点删除规则 | 批量删除只占一步撤回记录。 | 自动/源码通过 | `deleteSelected`; graph edge cleanup; browser delete/no-orphan regression |
| 115 | §11 折叠与展开 | 折叠功能只允许用于能够明确隐藏独立下游分支的情况。 | 自动/源码通过；实机控件待验收 | `Graph.canCollapse/hiddenByCollapse`; schema collapse guard; render hide/show |
| 116 | §11 折叠与展开 | 只有当一次折叠将隐藏的全部下游节点都不存在多父关系时，才允许折叠。 | 自动/源码通过；实机控件待验收 | `Graph.canCollapse/hiddenByCollapse`; schema collapse guard; render hide/show |
| 117 | §11 折叠与展开 | 如果待隐藏的任一下游节点拥有多个父节点，则该折叠操作不可执行。 | 自动/源码通过；实机控件待验收 | `Graph.canCollapse/hiddenByCollapse`; schema collapse guard; render hide/show |
| 118 | §11 折叠与展开 | 折叠不可用时，鼠标悬停提示： “包含多父节点，无法折叠” | 自动/源码通过；实机控件待验收 | `Graph.canCollapse/hiddenByCollapse`; schema collapse guard; render hide/show |
| 119 | §11 折叠与展开 | 折叠成功后，隐藏对应下游节点和与这些隐藏节点相关的层级线。 | 自动/源码通过；实机控件待验收 | `Graph.canCollapse/hiddenByCollapse`; schema collapse guard; render hide/show |
| 120 | §11 折叠与展开 | 再次展开后恢复这些节点和关系。 | 自动/源码通过；实机控件待验收 | `Graph.canCollapse/hiddenByCollapse`; schema collapse guard; render hide/show |
| 121 | §11 折叠与展开 | 折叠不得破坏原有节点、正文锚点或网络关系。 | 自动/源码通过；实机控件待验收 | `Graph.canCollapse/hiddenByCollapse`; schema collapse guard; render hide/show |
| 122 | §11 折叠与展开 | 折叠和展开不进入撤回历史。 | 自动/源码通过；实机控件待验收 | `Graph.canCollapse/hiddenByCollapse`; schema collapse guard; render hide/show |
| 123 | §12 从 ChatGPT 正文创建节点 | 用户可以在自己的 ChatGPT 消息或助手消息正文中划选文字。 | 自动/源码通过；当前 ChatGPT DOM 待验收 | mock native Range/mouseup/create-node test; cross-message split atomic test; `chatgpt.js` |
| 124 | §12 从 ChatGPT 正文创建节点 | 普通摘录模式下，完成有效选区后，在选区附近显示“创建节点”入口。 | 自动/源码通过；当前 ChatGPT DOM 待验收 | mock native Range/mouseup/create-node test; cross-message split atomic test; `chatgpt.js` |
| 125 | §12 从 ChatGPT 正文创建节点 | 点击后建立与正文关联的节点。 | 自动/源码通过；当前 ChatGPT DOM 待验收 | mock native Range/mouseup/create-node test; cross-message split atomic test; `chatgpt.js` |
| 126 | §12 从 ChatGPT 正文创建节点 | 创建节点后尽量保留浏览器原生文字选区，方便继续复制。 | 自动/源码通过；当前 ChatGPT DOM 待验收 | mock native Range/mouseup/create-node test; cross-message split atomic test; `chatgpt.js` |
| 127 | §12 从 ChatGPT 正文创建节点 | 同一段正文允许创建多个节点，不自动去重。 | 自动/源码通过；当前 ChatGPT DOM 待验收 | mock native Range/mouseup/create-node test; cross-message split atomic test; `chatgpt.js` |
| 128 | §12 从 ChatGPT 正文创建节点 | 输入框、导航、菜单、反馈按钮、复制控件和插件自身 UI 等非消息正文区域不得被误识别为摘录正文。 | 自动/源码通过；当前 ChatGPT DOM 待验收 | mock native Range/mouseup/create-node test; cross-message split atomic test; `chatgpt.js` |
| 129 | §12 从 ChatGPT 正文创建节点 | 一次选择跨越多条消息时，按照消息边界拆成多个节点。 | 自动/源码通过；当前 ChatGPT DOM 待验收 | mock native Range/mouseup/create-node test; cross-message split atomic test; `chatgpt.js` |
| 130 | §12 从 ChatGPT 正文创建节点 | 跨消息产生的多个节点彼此独立，不自动建立层级。 | 自动/源码通过；当前 ChatGPT DOM 待验收 | mock native Range/mouseup/create-node test; cross-message split atomic test; `chatgpt.js` |
| 131 | §12 从 ChatGPT 正文创建节点 | 一次跨消息摘录在撤回时只占一步。 | 自动/源码通过；当前 ChatGPT DOM 待验收 | mock native Range/mouseup/create-node test; cross-message split atomic test; `chatgpt.js` |
| 132 | §13 连续摘录 | 功能名称固定为“连续摘录”。 | 自动/源码通过；当前 ChatGPT DOM 待验收 | mock continuous capture + Ctrl bypass; source Shift bypass/reset on navigation |
| 133 | §13 连续摘录 | 连续摘录开启后，每次完成有效正文划选都立即创建节点。 | 自动/源码通过；当前 ChatGPT DOM 待验收 | mock continuous capture + Ctrl bypass; source Shift bypass/reset on navigation |
| 134 | §13 连续摘录 | 此时不再显示“创建节点”按钮。 | 自动/源码通过；当前 ChatGPT DOM 待验收 | mock continuous capture + Ctrl bypass; source Shift bypass/reset on navigation |
| 135 | §13 连续摘录 | 每次连续摘录产生的节点仍然彼此独立。 | 自动/源码通过；当前 ChatGPT DOM 待验收 | mock continuous capture + Ctrl bypass; source Shift bypass/reset on navigation |
| 136 | §13 连续摘录 | 连续摘录不会自动建立层级关系。 | 自动/源码通过；当前 ChatGPT DOM 待验收 | mock continuous capture + Ctrl bypass; source Shift bypass/reset on navigation |
| 137 | §13 连续摘录 | 连续摘录开启时： - 普通划选正文 → 自动创建节点； - 按住 Ctrl 划选正文 → 只进行正常文字选择，不创建节点； - 按住 Shift 划选正文 → 只进行正常文字选择，不创建节点。 | 自动/源码通过；当前 ChatGPT DOM 待验收 | mock continuous capture + Ctrl bypass; source Shift bypass/reset on navigation |
| 138 | §13 连续摘录 | Ctrl/Shift 的上述绕过规则只适用于 ChatGPT 正文划选手势。 | 自动/源码通过；当前 ChatGPT DOM 待验收 | mock continuous capture + Ctrl bypass; source Shift bypass/reset on navigation |
| 139 | §13 连续摘录 | 不设置 Alt 相关的连续摘录操作。 | 自动/源码通过；当前 ChatGPT DOM 待验收 | mock continuous capture + Ctrl bypass; source Shift bypass/reset on navigation |
| 140 | §13 连续摘录 | 离开当前对话、切换 conversation 或刷新页面后，连续摘录自动关闭。 | 自动/源码通过；当前 ChatGPT DOM 待验收 | mock continuous capture + Ctrl bypass; source Shift bypass/reset on navigation |
| 141 | §14 自由节点 | 用户点击工具栏“自由节点”可以创建不关联 ChatGPT 正文的节点。 | 自动/源码通过；实机编辑手感待验收 | free-node browser create/click/drag/delete; source feature paths |
| 142 | §14 自由节点 | 自由节点使用虚线边框或其他明显的无正文标识。 | 自动/源码通过；实机编辑手感待验收 | free-node browser create/click/drag/delete; source feature paths |
| 143 | §14 自由节点 | 自由节点可以： - 编辑文字； - 移动； - 调整宽度； - 改色； - 建立层级； - 拥有多个父级； - 拥有多个子级； - 解除层级； - 删除； - 搜索； - 转入备忘录。 | 自动/源码通过；实机编辑手感待验收 | free-node browser create/click/drag/delete; source feature paths |
| 144 | §14 自由节点 | 自由节点不具有正文锚点。 | 自动/源码通过；实机编辑手感待验收 | free-node browser create/click/drag/delete; source feature paths |
| 145 | §14 自由节点 | 自由节点不能后来直接绑定现有正文。 | 自动/源码通过；实机编辑手感待验收 | free-node browser create/click/drag/delete; source feature paths |
| 146 | §14 自由节点 | 如果需要正文锚点，应重新从正文创建节点。 | 自动/源码通过；实机编辑手感待验收 | free-node browser create/click/drag/delete; source feature paths |
| 147 | §15 新节点的自动排列 | 新节点应优先出现在用户当前正在查看的画布区域。 | 自动/源码通过；实机布局待验收 | `placeAutoGroup`; finite geometry/router validation; auto-group state logic |
| 148 | §15 新节点的自动排列 | 一组连续自动创建节点的第一个节点放在当前可视区域的中下部。 | 自动/源码通过；实机布局待验收 | `placeAutoGroup`; finite geometry/router validation; auto-group state logic |
| 149 | §15 新节点的自动排列 | 第一个节点横向中心位于当前可视画布宽度约 1/2 的位置。 | 自动/源码通过；实机布局待验收 | `placeAutoGroup`; finite geometry/router validation; auto-group state logic |
| 150 | §15 新节点的自动排列 | 创建第二个节点时，如果当前横向空间能够合法放置两个节点： - 第一个节点向左移动； - 第二个节点放在右侧； - 两个节点构成的整体横向范围居中于当前可视区域。 | 自动/源码通过；实机布局待验收 | `placeAutoGroup`; finite geometry/router validation; auto-group state logic |
| 151 | §15 新节点的自动排列 | 创建第三个节点时，如果当前行仍有足够空间： - 前两个节点继续向左调整； - 第三个节点加入右侧； - 三个节点组成的整行继续保持水平居中。 | 自动/源码通过；实机布局待验收 | `placeAutoGroup`; finite geometry/router validation; auto-group state logic |
| 152 | §15 新节点的自动排列 | 后续节点按照相同方式从左向右继续增加。 | 自动/源码通过；实机布局待验收 | `placeAutoGroup`; finite geometry/router validation; auto-group state logic |
| 153 | §15 新节点的自动排列 | 新节点排列采用横向优先。 | 自动/源码通过；实机布局待验收 | `placeAutoGroup`; finite geometry/router validation; auto-group state logic |
| 154 | §15 新节点的自动排列 | 当前行无法合法放入下一个节点时，换到下一行。 | 自动/源码通过；实机布局待验收 | `placeAutoGroup`; finite geometry/router validation; auto-group state logic |
| 155 | §15 新节点的自动排列 | 下一行重新从“第一个节点居中”开始。 | 自动/源码通过；实机布局待验收 | `placeAutoGroup`; finite geometry/router validation; auto-group state logic |
| 156 | §15 新节点的自动排列 | 下一行中的第二、第三及后续节点继续按照整行水平居中的方式扩展。 | 自动/源码通过；实机布局待验收 | `placeAutoGroup`; finite geometry/router validation; auto-group state logic |
| 157 | §15 新节点的自动排列 | 自动排列过程中必须始终满足节点和关系线无冲突规则。 ### 自动排列组 | 自动/源码通过；实机布局待验收 | `placeAutoGroup`; finite geometry/router validation; auto-group state logic |
| 158 | §15 新节点的自动排列 | 连续自动创建且仍可自动调整位置的节点构成当前自动排列组。 | 源码/算法通过；实机布局待验收 | `placeAutoGroup`; finite geometry/router validation; auto-group state logic |
| 159 | §15 新节点的自动排列 | 只要组内节点没有被用户手动操作——包括手动移动或者建立层级关系——后续新节点仍可以让这一组重新居中。 | 源码/算法通过；实机布局待验收 | `placeAutoGroup`; finite geometry/router validation; auto-group state logic |
| 160 | §15 新节点的自动排列 | 一旦组内任一节点被用户手动移动，当前自动排列组立即结束。 | 源码/算法通过；实机布局待验收 | `placeAutoGroup`; finite geometry/router validation; auto-group state logic |
| 161 | §15 新节点的自动排列 | 一旦组内任一节点被用户用于建立层级关系，当前自动排列组立即结束。 | 源码/算法通过；实机布局待验收 | `placeAutoGroup`; finite geometry/router validation; auto-group state logic |
| 162 | §15 新节点的自动排列 | 自动排列组结束后，系统不得再因为新创建节点而重新移动该组。 | 源码/算法通过；实机布局待验收 | `placeAutoGroup`; finite geometry/router validation; auto-group state logic |
| 163 | §15 新节点的自动排列 | 下一次新建节点从一个新的自动排列组开始。 | 源码/算法通过；实机布局待验收 | `placeAutoGroup`; finite geometry/router validation; auto-group state logic |
| 164 | §15 新节点的自动排列 | 单纯修改文字或改色不视为上述手动操作。 | 源码/算法通过；实机布局待验收 | `placeAutoGroup`; finite geometry/router validation; auto-group state logic |
| 165 | §16 新节点空间不足时的处理 | 新节点不得因为自动排列跑到当前可见区域之外。 | 自动/源码通过；实机极限布局待验收 | upward-space recovery in `placeAutoGroup`; world/route validation |
| 166 | §16 新节点空间不足时的处理 | 如果已有内容导致新节点无法按要求放入当前区域，可将现有节点整体向上平移，为新节点腾出空间。 | 自动/源码通过；实机极限布局待验收 | upward-space recovery in `placeAutoGroup`; world/route validation |
| 167 | §16 新节点空间不足时的处理 | 如果新的一行将超出当前可视区域下方，也可将已有节点整体向上平移。 | 自动/源码通过；实机极限布局待验收 | upward-space recovery in `placeAutoGroup`; world/route validation |
| 168 | §16 新节点空间不足时的处理 | 整体向上平移后，仍必须满足全部节点和层级线无冲突规则。 | 自动/源码通过；实机极限布局待验收 | upward-space recovery in `placeAutoGroup`; world/route validation |
| 169 | §16 新节点空间不足时的处理 | 系统不得为了放入新节点而产生节点重叠、关系线交叉或穿过节点。 | 自动/源码通过；实机极限布局待验收 | upward-space recovery in `placeAutoGroup`; world/route validation |
| 170 | §16 新节点空间不足时的处理 | 系统不得把节点偷偷创建在有限画布边界外。 | 自动/源码通过；实机极限布局待验收 | upward-space recovery in `placeAutoGroup`; world/route validation |
| 171 | §17 有限画布 | ChatGPT NET 使用有明确边界的有限画布，不使用无限画布。 | 自动/源码通过 | 360×900 / 720×900 / 2880×3600 constants; schema bounds; initial-center browser assertion |
| 172 | §17 有限画布 | 新画布的尺寸设计基准固定为：初始展开画布视口 360 × 900 CSS px；设计最大画布视口 720 × 900 CSS px；固定世界边界 2880 × 3600 CSS px。如果浏览器实际可用空间不足以容纳初始设计视口，只缩小当次可见视口，不改变世界边界。 | 自动/源码通过 | 360×900 / 720×900 / 2880×3600 constants; schema bounds; initial-center browser assertion |
| 173 | §17 有限画布 | 画布总宽度固定为 2880 CSS px，等于设计最大画布视口宽度 720 CSS px 的 4 倍。 | 自动/源码通过 | 360×900 / 720×900 / 2880×3600 constants; schema bounds; initial-center browser assertion |
| 174 | §17 有限画布 | 画布总高度固定为 3600 CSS px，等于设计最大画布视口高度 900 CSS px 的 4 倍。 | 自动/源码通过 | 360×900 / 720×900 / 2880×3600 constants; schema bounds; initial-center browser assertion |
| 175 | §17 有限画布 | 当： - ChatGPT NET 画布视口达到设计最大尺寸 720 × 900 CSS px； - 缩放比例为 25%； 应能够看到完整的 2880 × 3600 CSS px 画布全部边界。 | 自动/源码通过 | 360×900 / 720×900 / 2880×3600 constants; schema bounds; initial-center browser assertion |
| 176 | §17 有限画布 | 新画布建立后，其总世界边界固定。 | 自动/源码通过 | 360×900 / 720×900 / 2880×3600 constants; schema bounds; initial-center browser assertion |
| 177 | §17 有限画布 | 后续改变浏览器窗口大小，不重新计算已建立画布的总边界。 | 自动/源码通过 | 360×900 / 720×900 / 2880×3600 constants; schema bounds; initial-center browser assertion |
| 178 | §17 有限画布 | 浏览器窗口变化只改变当前一次能够看到多少画布区域。 | 自动/源码通过 | 360×900 / 720×900 / 2880×3600 constants; schema bounds; initial-center browser assertion |
| 179 | §17 有限画布 | 用户拖动侧栏宽度，也不得导致现有画布世界边界随之改变。 ### 初始视图 | 自动/源码通过 | 360×900 / 720×900 / 2880×3600 constants; schema bounds; initial-center browser assertion |
| 180 | §17 有限画布 | 新画布初始查看位置横向位于总画布宽度约 1/2。 | 自动/源码通过 | 360×900 / 720×900 / 2880×3600 constants; schema bounds; initial-center browser assertion |
| 181 | §17 有限画布 | 新画布初始查看位置纵向位于总画布高度约上 1/4。 ### 画布满载 | 自动/源码通过 | 360×900 / 720×900 / 2880×3600 constants; schema bounds; initial-center browser assertion |
| 182 | §17 有限画布 | 如果画布下方空间不足以容纳新增节点，优先将已有节点整体向上平移。 | 自动/源码通过 | 360×900 / 720×900 / 2880×3600 constants; schema bounds; initial-center browser assertion |
| 183 | §17 有限画布 | 平移后重新检查节点和关系线是否合法。 | 自动/源码通过 | 360×900 / 720×900 / 2880×3600 constants; schema bounds; initial-center browser assertion |
| 184 | §17 有限画布 | 如果仍然找不到合法位置，并且所有节点继续向上平移也不能解决，则停止创建。 | 自动/源码通过 | 360×900 / 720×900 / 2880×3600 constants; schema bounds; initial-center browser assertion |
| 185 | §17 有限画布 | 此时提示： “画布已满” | 自动/源码通过 | 360×900 / 720×900 / 2880×3600 constants; schema bounds; initial-center browser assertion |
| 186 | §17 有限画布 | “画布已满”时，本次节点不得被创建在非法位置。 | 自动/源码通过 | 360×900 / 720×900 / 2880×3600 constants; schema bounds; initial-center browser assertion |
| 187 | §17 有限画布 | 不得通过扩大既有固定画布边界规避“画布已满”。 | 自动/源码通过 | 360×900 / 720×900 / 2880×3600 constants; schema bounds; initial-center browser assertion |
| 188 | §18 节点显示、大小和编辑 | 节点默认尺寸应相对紧凑，提高有限画布利用率。 | 自动/源码通过；Firefox 手感待验收 | no-orphan click/drag regression; resize/edit/cancel source paths |
| 189 | §18 节点显示、大小和编辑 | 节点宽度可以通过左右边缘拖动调整。 | 自动/源码通过；Firefox 手感待验收 | no-orphan click/drag regression; resize/edit/cancel source paths |
| 190 | §18 节点显示、大小和编辑 | 调整节点宽度与移动节点必须是不同手势，避免误触。 | 自动/源码通过；Firefox 手感待验收 | no-orphan click/drag regression; resize/edit/cancel source paths |
| 191 | §18 节点显示、大小和编辑 | 节点高度根据文字内容和节点宽度自动适应。 | 自动/源码通过；Firefox 手感待验收 | no-orphan click/drag regression; resize/edit/cancel source paths |
| 192 | §18 节点显示、大小和编辑 | 节点文字允许编辑。 | 自动/源码通过；Firefox 手感待验收 | no-orphan click/drag regression; resize/edit/cancel source paths |
| 193 | §18 节点显示、大小和编辑 | 双击节点进入文字编辑。 | 自动/源码通过；Firefox 手感待验收 | no-orphan click/drag regression; resize/edit/cancel source paths |
| 194 | §18 节点显示、大小和编辑 | 修改节点显示文字不修改 ChatGPT 原文。 | 自动/源码通过；Firefox 手感待验收 | no-orphan click/drag regression; resize/edit/cancel source paths |
| 195 | §18 节点显示、大小和编辑 | 修改节点显示文字不改变原始摘录。 | 自动/源码通过；Firefox 手感待验收 | no-orphan click/drag regression; resize/edit/cancel source paths |
| 196 | §18 节点显示、大小和编辑 | 修改节点显示文字不改变正文锚点。 | 自动/源码通过；Firefox 手感待验收 | no-orphan click/drag regression; resize/edit/cancel source paths |
| 197 | §18 节点显示、大小和编辑 | 普通单击节点不得造成轻微位置移动。 | 自动/源码通过；Firefox 手感待验收 | no-orphan click/drag regression; resize/edit/cancel source paths |
| 198 | §18 节点显示、大小和编辑 | 拖动节点应平滑，不出现明显闪烁。 | 自动/源码通过；Firefox 手感待验收 | no-orphan click/drag regression; resize/edit/cancel source paths |
| 199 | §18 节点显示、大小和编辑 | 拖动被取消、Esc 或页面失焦时，未完成移动恢复到操作开始前的位置。 | 自动/源码通过；Firefox 手感待验收 | no-orphan click/drag regression; resize/edit/cancel source paths |
| 200 | §19 节点手动拖动后的冲突处理顺序 | 用户拖动单个节点或多选节点组到新位置释放时，优先尊重用户释放位置；多选节点组始终保持组内相对位置。拖到另一未选节点上用于建立层级时，同时遵守第 82～93 条。 | 自动/源码通过；Firefox 拖动待验收 | staged placement solver; actual pointer move/relation browser tests |
| 201 | §19 节点手动拖动后的冲突处理顺序 | 如果释放位置产生关系线、节点或布局冲突，处理顺序固定如下： ### 第一步 | 自动/源码通过；Firefox 拖动待验收 | staged placement solver; actual pointer move/relation browser tests |
| 202 | §19 节点手动拖动后的冲突处理顺序 | 首先只尝试改变相关关系线的走法。 | 自动/源码通过；Firefox 拖动待验收 | staged placement solver; actual pointer move/relation browser tests |
| 203 | §19 节点手动拖动后的冲突处理顺序 | 如果仅重新规划关系线即可满足全部硬性无冲突要求，节点保留在用户释放位置。 ### 第二步 | 自动/源码通过；Firefox 拖动待验收 | staged placement solver; actual pointer move/relation browser tests |
| 204 | §19 节点手动拖动后的冲突处理顺序 | 如果仅改变关系线仍不合法，将刚刚拖动的对象移动到距离用户释放点最近的合法位置；单节点移动单节点，多选移动则把整个选中组作为刚性整体移动，并保持组内相对位置。 ### 第三步 | 自动/源码通过；Firefox 拖动待验收 | staged placement solver; actual pointer move/relation browser tests |
| 205 | §19 节点手动拖动后的冲突处理顺序 | 如果仍然无解，以最终层级图清晰、短线、无交叉且无重叠为优先，允许对被拖动节点所在的受影响连通层级执行结构化重排；应先采用局部调整，局部不足时才扩大到该连通层级。 | 自动/源码通过；Firefox 拖动待验收 | bounded local candidates, then affected-component hierarchy fallback; browser connected-move assertions |
| 206 | §19 节点手动拖动后的冲突处理顺序 | 结构化重排不得波及无关自由节点、其他连通层级或其合法线路；在能够获得同等合理效果时，应选择移动范围更小的方案。 ### 第四步 | 自动/源码通过；Firefox 拖动待验收 | affected component only; unrelated-note/component routes stay fixed in browser regressions |
| 207 | §19 节点手动拖动后的冲突处理顺序 | 如果上述方法仍然无法满足所有无冲突规则，取消此次移动；若本次拖动同时尝试建立单条或批量层级关系，则同时取消本次尚未提交的关系变化。 | 自动/源码通过；Firefox 拖动待验收 | staged placement solver; actual pointer move/relation browser tests |
| 208 | §19 节点手动拖动后的冲突处理顺序 | 被拖动的单节点或多选节点组全部恢复到本次操作开始前的位置。 | 自动/源码通过；Firefox 拖动待验收 | staged placement solver; actual pointer move/relation browser tests |
| 209 | §19 节点手动拖动后的冲突处理顺序 | 提示： “无法放置：当前位置没有无冲突空间。” | 自动/源码通过；Firefox 拖动待验收 | staged placement solver; actual pointer move/relation browser tests |
| 210 | §20 统一点击与选择规则 | 普通单击对象：选中。 | 自动/源码通过；Firefox 手势待验收 | ordinary/Ctrl/Shift selection state machine; multi-click collapse browser regression |
| 211 | §20 统一点击与选择规则 | 普通单击一个新对象时，清除当前区域原有选择，只选中该对象。 ### 双击 | 自动/源码通过；Firefox 手势待验收 | ordinary/Ctrl/Shift selection state machine; multi-click collapse browser regression |
| 212 | §20 统一点击与选择规则 | 双击节点或备忘录条目：编辑显示文字。 ### Ctrl＋单击 | 自动/源码通过；Firefox 手势待验收 | ordinary/Ctrl/Shift selection state machine; multi-click collapse browser regression |
| 213 | §20 统一点击与选择规则 | Ctrl＋单击：追加或取消多选。 | 自动/源码通过；Firefox 手势待验收 | ordinary/Ctrl/Shift selection state machine; multi-click collapse browser regression |
| 214 | §20 统一点击与选择规则 | Ctrl＋单击未选对象，将其加入当前多选。 | 自动/源码通过；Firefox 手势待验收 | ordinary/Ctrl/Shift selection state machine; multi-click collapse browser regression |
| 215 | §20 统一点击与选择规则 | Ctrl＋单击已选对象，将其从当前多选中移除。 ### Shift＋单击 | 自动/源码通过；Firefox 手势待验收 | ordinary/Ctrl/Shift selection state machine; multi-click collapse browser regression |
| 216 | §20 统一点击与选择规则 | Shift＋单击有正文锚点的对象：跳转对应 ChatGPT 正文。 | 自动/源码通过；Firefox 手势待验收 | ordinary/Ctrl/Shift selection state machine; multi-click collapse browser regression |
| 217 | §20 统一点击与选择规则 | Shift＋单击没有正文锚点的对象：等同普通单击，只执行选中。 ### Alt | 自动/源码通过；Firefox 手势待验收 | ordinary/Ctrl/Shift selection state machine; multi-click collapse browser regression |
| 218 | §20 统一点击与选择规则 | 不设置任何 Alt＋单击操作。 | 自动/源码通过；Firefox 手势待验收 | ordinary/Ctrl/Shift selection state machine; multi-click collapse browser regression |
| 219 | §20 统一点击与选择规则 | 不设置 Alt＋框选。 | 自动/源码通过；Firefox 手势待验收 | ordinary/Ctrl/Shift selection state machine; multi-click collapse browser regression |
| 220 | §20 统一点击与选择规则 | 不设置 Alt＋滚轮。 | 自动/源码通过；Firefox 手势待验收 | ordinary/Ctrl/Shift selection state machine; multi-click collapse browser regression |
| 221 | §20 统一点击与选择规则 | 不设置其他 Alt 相关画布操作。 | 自动/源码通过；Firefox 手势待验收 | ordinary/Ctrl/Shift selection state machine; multi-click collapse browser regression |
| 222 | §21 画布框选与平移 | Ctrl＋在画布空白处拖动：框选。 | 自动/源码通过；Firefox 手势待验收 | box/pan/group-drag source; close-during-pan browser regression |
| 223 | §21 画布框选与平移 | 框选只改变当前选择，不平移画布。 | 自动/源码通过；Firefox 手势待验收 | box/pan/group-drag source; close-during-pan browser regression |
| 224 | §21 画布框选与平移 | 普通在画布空白处拖动：平移画布。 | 自动/源码通过；Firefox 手势待验收 | box/pan/group-drag source; close-during-pan browser regression |
| 225 | §21 画布框选与平移 | 普通点击画布空白处：清除画布节点选择。 | 自动/源码通过；Firefox 手势待验收 | box/pan/group-drag source; close-during-pan browser regression |
| 226 | §21 画布框选与平移 | 拖动任意已选画布节点时，所有已选画布节点作为一个整体移动；如果最终释放在另一个未选画布节点主体上，则不再按普通整体移动结束，而是进入第 82 条规定的多选批量关系判定。 | 自动/源码通过；Firefox 手势待验收 | box/pan/group-drag source; close-during-pan browser regression |
| 227 | §21 画布框选与平移 | 整体移动始终保持组内节点相对位置；批量关系成功后为满足硬性无冲突规则而进行的最终位置调整也必须保持该相对位置。 | 自动/源码通过；Firefox 手势待验收 | box/pan/group-drag source; close-during-pan browser regression |
| 228 | §21 画布框选与平移 | 整体移动或批量关系操作完成后仍必须满足全部无冲突规则；如果操作失败，整个选中组恢复到操作开始前的位置。 | 自动/源码通过；Firefox 手势待验收 | box/pan/group-drag source; close-during-pan browser regression |
| 229 | §22 画布与备忘录选择区域互斥 | 画布和备忘录不共享一个混合选择集合。 | 自动/源码通过 | selection-area mutual exclusion; Shift-anchor cross-area browser regression |
| 230 | §22 画布与备忘录选择区域互斥 | 已经在画布中选择一个或多个节点后，如果用户在备忘录中进行普通单击或 Ctrl＋单击： - 清除原有画布选择； - 切换到备忘录选择。 | 自动/源码通过 | selection-area mutual exclusion; Shift-anchor cross-area browser regression |
| 231 | §22 画布与备忘录选择区域互斥 | 已经在备忘录中选择一个或多个条目后，如果用户在画布中进行普通单击或 Ctrl＋单击： - 清除原有备忘录选择； - 切换到画布选择。 | 自动/源码通过 | selection-area mutual exclusion; Shift-anchor cross-area browser regression |
| 232 | §22 画布与备忘录选择区域互斥 | 不允许同时存在“部分画布节点＋部分备忘录条目”的混合批量选择状态。 | 自动/源码通过 | selection-area mutual exclusion; Shift-anchor cross-area browser regression |
| 233 | §23 画布多选批量操作 | 画布通过 Ctrl＋单击逐个多选。 | 源码/部分自动通过；Firefox 批量手势待验收 | batch relation/move/delete/color/memo code; batch relation browser test |
| 234 | §23 画布多选批量操作 | 画布通过 Ctrl＋空白拖动框选多个节点。 | 源码/部分自动通过；Firefox 批量手势待验收 | batch relation/move/delete/color/memo code; batch relation browser test |
| 235 | §23 画布多选批量操作 | 不需要进入额外批量模式。 | 源码/部分自动通过；Firefox 批量手势待验收 | batch relation/move/delete/color/memo code; batch relation browser test |
| 236 | §23 画布多选批量操作 | 画布多选支持： - 批量删除； - 批量改色； - 整体移动； - 批量转入备忘录； - 工具栏“解除”删除所有选中节点的全部父级关系； - 在第 82 条条件全部满足时，把多个当前无上游节点一次性连接到同一个共同上游节点。 | 源码/部分自动通过；Firefox 批量手势待验收 | batch relation/move/delete/color/memo code; batch relation browser test |
| 237 | §23 画布多选批量操作 | 批量操作整体只占一步撤回记录；第 82 条的一次批量建立共同上游关系无论产生多少条关系，也只占一步撤回记录。 | 源码/部分自动通过；Firefox 批量手势待验收 | batch relation/move/delete/color/memo code; batch relation browser test |
| 238 | §24 正文锚点和双向定位 | 从正文创建的节点保存原始摘录和对应正文位置。 | 自动/源码通过；当前 ChatGPT 锚点待验收 | conservative locator; mock color highlight/reverse-location path; live regenerate pending |
| 239 | §24 正文锚点和双向定位 | 修改节点显示文字不影响正文关联。 | 自动/源码通过；当前 ChatGPT 锚点待验收 | conservative locator; mock color highlight/reverse-location path; live regenerate pending |
| 240 | §24 正文锚点和双向定位 | Shift＋单击具有正文锚点的节点或备忘录条目时： - ChatGPT 页面滚动到对应正文； - 对应原始摘录临时强化高亮。 | 自动/源码通过；当前 ChatGPT 锚点待验收 | conservative locator; mock color highlight/reverse-location path; live regenerate pending |
| 241 | §24 正文锚点和双向定位 | 自由节点没有正文锚点，因此 Shift＋单击只执行普通选中。 | 自动/源码通过；当前 ChatGPT 锚点待验收 | conservative locator; mock color highlight/reverse-location path; live regenerate pending |
| 242 | §24 正文锚点和双向定位 | 如果 ChatGPT 原消息后来被编辑或重新生成，系统应尽可能重新找到对应内容。 | 自动/源码通过；当前 ChatGPT 锚点待验收 | conservative locator; mock color highlight/reverse-location path; live regenerate pending |
| 243 | §24 正文锚点和双向定位 | 如果只能可靠找到整条消息，而无法确定精确摘录位置，可定位到整条消息并提示用户。 | 自动/源码通过；当前 ChatGPT 锚点待验收 | conservative locator; mock color highlight/reverse-location path; live regenerate pending |
| 244 | §24 正文锚点和双向定位 | 如果无法可靠找到正确正文： - 保留节点； - 标记无法定位； - 不跳转到可能错误的消息。 | 自动/源码通过；当前 ChatGPT 锚点待验收 | conservative locator; mock color highlight/reverse-location path; live regenerate pending |
| 245 | §24 正文锚点和双向定位 | 点击 ChatGPT 正文中的摘录高亮，可以反向定位对应 ChatGPT NET 内容。 | 自动/源码通过；当前 ChatGPT 锚点待验收 | conservative locator; mock color highlight/reverse-location path; live regenerate pending |
| 246 | §24 正文锚点和双向定位 | 如果同一段正文对应多个节点或备忘录条目，显示小型选择列表。 | 自动/源码通过；当前 ChatGPT 锚点待验收 | conservative locator; mock color highlight/reverse-location path; live regenerate pending |
| 247 | §24 正文锚点和双向定位 | 正文定位不得改变画布缩放。 | 自动/源码通过；当前 ChatGPT 锚点待验收 | conservative locator; mock color highlight/reverse-location path; live regenerate pending |
| 248 | §24 正文锚点和双向定位 | 正文定位不得自动重排整个画布。 | 自动/源码通过；当前 ChatGPT 锚点待验收 | conservative locator; mock color highlight/reverse-location path; live regenerate pending |
| 249 | §25 画布缩放与视图 | 初始缩放比例为 75%。 | 自动/源码通过 | zoom constants; pointer-centered wheel; reset-center implementation |
| 250 | §25 画布缩放与视图 | 最小缩放比例为 25%。 | 自动/源码通过 | zoom constants; pointer-centered wheel; reset-center implementation |
| 251 | §25 画布缩放与视图 | 最大缩放比例为 300%。 | 自动/源码通过 | zoom constants; pointer-centered wheel; reset-center implementation |
| 252 | §25 画布缩放与视图 | Ctrl＋鼠标滚轮：以鼠标指针所在位置为中心缩放画布。 | 自动/源码通过；Firefox Ctrl+wheel/视图待验收 | zoom constants; pointer-centered wheel; reset-center implementation |
| 253 | §25 画布缩放与视图 | 不使用 Alt＋滚轮缩放。 | 源码通过；Firefox Ctrl+wheel/视图待验收 | zoom constants; pointer-centered wheel; reset-center implementation |
| 254 | §25 画布缩放与视图 | 普通空白拖动用于平移画布。 | 源码通过；Firefox Ctrl+wheel/视图待验收 | zoom constants; pointer-centered wheel; reset-center implementation |
| 255 | §25 画布缩放与视图 | 节点拖到当前画布视口边缘附近时，可以自动平移视图。 | 源码通过；Firefox Ctrl+wheel/视图待验收 | zoom constants; pointer-centered wheel; reset-center implementation |
| 256 | §25 画布缩放与视图 | 界面显示当前缩放百分比。 | 自动/源码通过；Firefox Ctrl+wheel/视图待验收 | zoom constants; pointer-centered wheel; reset-center implementation |
| 257 | §25 画布缩放与视图 | 双击缩放百分比： - 恢复到 75%； - 将当前画布内容居中； - 不改变节点实际坐标； - 不改变层级关系； - 不改变侧栏宽度； - 不改变画布/备忘录比例。 | 自动/源码通过；Firefox Ctrl+wheel/视图待验收 | zoom constants; pointer-centered wheel; reset-center implementation |
| 258 | §25 画布缩放与视图 | 不保留独立“适合内容”按钮及功能。 | 源码通过；Firefox Ctrl+wheel/视图待验收 | zoom constants; pointer-centered wheel; reset-center implementation |
| 259 | §26 备忘录基本行为 | 画布节点可以拖入备忘录。 | 自动/源码通过；Firefox 拖放待验收 | actual canvas→memo expanded-target pointer test and conversion |
| 260 | §26 备忘录基本行为 | 拖动过程中节点 ghost 必须显示在备忘录界面上方。 | 自动/源码通过；Firefox 拖放待验收 | active memo-zone feedback + high-layer ghost browser assertions |
| 261 | §26 备忘录基本行为 | 节点不得在拖动途中被备忘录遮挡。 | 自动/源码通过；Firefox 拖放待验收 | actual canvas→memo pointer test including memo ghost and conversion |
| 262 | §26 备忘录基本行为 | 只有实际释放到备忘录后，节点才转成备忘录条目。 | 自动/源码通过；Firefox 拖放待验收 | actual canvas→memo pointer test including memo ghost and conversion |
| 263 | §26 备忘录基本行为 | 转入备忘录后保留： - 显示文字； - 原始正文摘录； - 正文锚点； - 实际颜色。 | 自动/源码通过；Firefox 拖放待验收 | actual canvas→memo pointer test including memo ghost and conversion |
| 264 | §26 备忘录基本行为 | 转入备忘录后，不在画布中留下隐藏副本。 | 自动/源码通过；Firefox 拖放待验收 | actual canvas→memo pointer test including memo ghost and conversion |
| 265 | §26 备忘录基本行为 | 原画布层级关系不在备忘录中隐藏保存。 | 自动/源码通过；Firefox 拖放待验收 | actual canvas→memo pointer test including memo ghost and conversion |
| 266 | §27 备忘录条目拖回画布 | 单个备忘录条目可以拖回画布。 | 自动/源码通过；Firefox HTML5 DnD 待验收 | actual memo→canvas HTML5 drag browser test; route/legal placement solver |
| 267 | §27 备忘录条目拖回画布 | 拖回后成为独立根节点。 | 自动/源码通过；Firefox HTML5 DnD 待验收 | actual memo→canvas HTML5 drag browser test; route/legal placement solver |
| 268 | §27 备忘录条目拖回画布 | 不恢复进入备忘录前的旧位置。 | 自动/源码通过；Firefox HTML5 DnD 待验收 | actual memo→canvas HTML5 drag browser test; route/legal placement solver |
| 269 | §27 备忘录条目拖回画布 | 不恢复进入备忘录前的层级关系。 | 自动/源码通过；Firefox HTML5 DnD 待验收 | actual memo→canvas HTML5 drag browser test; route/legal placement solver |
| 270 | §27 备忘录条目拖回画布 | 用户释放位置为首选位置。 | 自动/源码通过；Firefox HTML5 DnD 待验收 | actual memo→canvas HTML5 drag browser test; route/legal placement solver |
| 271 | §27 备忘录条目拖回画布 | 如果释放位置与现有节点或层级线冲突： - 不直接放置； - 自动寻找当前可视区域附近距离释放点较近的合法空白位置。 | 自动/源码通过；Firefox HTML5 DnD 待验收 | actual memo→canvas HTML5 drag browser test; route/legal placement solver |
| 272 | §27 备忘录条目拖回画布 | 如果附近没有合法位置，则按照有限画布的空间处理规则继续尝试。 | 自动/源码通过；Firefox HTML5 DnD 待验收 | actual memo→canvas HTML5 drag browser test; route/legal placement solver |
| 273 | §27 备忘录条目拖回画布 | 如果最终仍无法合法放置，则取消拖回操作，不制造重叠。 | 自动/源码通过；Firefox HTML5 DnD 待验收 | actual memo→canvas HTML5 drag browser test; route/legal placement solver |
| 274 | §28 多个备忘录条目一起拖回画布 | 备忘录支持 Ctrl＋单击选择多个条目。 | 自动/源码通过；Firefox HTML5 DnD 待验收 | actual multi-memo→canvas HTML5 drag + one-undo browser test |
| 275 | §28 多个备忘录条目一起拖回画布 | 多个选中条目可以作为一组拖回画布。 | 自动/源码通过；Firefox HTML5 DnD 待验收 | actual multi-memo→canvas HTML5 drag + one-undo browser test |
| 276 | §28 多个备忘录条目一起拖回画布 | 多条目拖回时按照备忘录当前视觉顺序处理。 | 自动/源码通过；Firefox HTML5 DnD 待验收 | actual multi-memo→canvas HTML5 drag + one-undo browser test |
| 277 | §28 多个备忘录条目一起拖回画布 | 用户释放位置作为整组节点的首选中心区域。 | 自动/源码通过；Firefox HTML5 DnD 待验收 | actual multi-memo→canvas HTML5 drag + one-undo browser test |
| 278 | §28 多个备忘录条目一起拖回画布 | 组内节点采用横向优先排列。 | 自动/源码通过；Firefox HTML5 DnD 待验收 | actual multi-memo→canvas HTML5 drag + one-undo browser test |
| 279 | §28 多个备忘录条目一起拖回画布 | 当前行空间不足时换到下一行。 | 自动/源码通过；Firefox HTML5 DnD 待验收 | actual multi-memo→canvas HTML5 drag + one-undo browser test |
| 280 | §28 多个备忘录条目一起拖回画布 | 整组仍必须满足所有节点和层级线无冲突规则。 | 自动/源码通过；Firefox HTML5 DnD 待验收 | actual multi-memo→canvas HTML5 drag + one-undo browser test |
| 281 | §28 多个备忘录条目一起拖回画布 | 可以寻找释放点附近的合法区域进行整体放置。 | 自动/源码通过；Firefox HTML5 DnD 待验收 | actual multi-memo→canvas HTML5 drag + one-undo browser test |
| 282 | §28 多个备忘录条目一起拖回画布 | 多条目拖回采用全部成功或全部失败原则。 | 自动/源码通过；Firefox HTML5 DnD 待验收 | actual multi-memo→canvas HTML5 drag + one-undo browser test |
| 283 | §28 多个备忘录条目一起拖回画布 | 如果整组无法全部合法放入画布： - 整次操作取消； - 所有条目继续留在备忘录； - 不允许只成功一部分。 | 自动/源码通过；Firefox HTML5 DnD 待验收 | actual multi-memo→canvas HTML5 drag + one-undo browser test |
| 284 | §28 多个备忘录条目一起拖回画布 | 多条目拖回画布只占一步撤回记录。 | 自动/源码通过；Firefox HTML5 DnD 待验收 | actual multi-memo→canvas HTML5 drag + one-undo browser test |
| 285 | §29 备忘录标题 | 备忘录标题行显示“备忘录”。 | 源码通过；Firefox HTML5 DnD/编辑待验收 | memo section create/rename/reorder/delete/collapse implementation |
| 286 | §29 备忘录标题 | `＋` 位于“备忘录”标题行最右侧。 | 源码通过；Firefox HTML5 DnD/编辑待验收 | memo section create/rename/reorder/delete/collapse implementation |
| 287 | §29 备忘录标题 | 点击 `＋` 后，直接在下方创建新的分隔标题输入行。 | 源码通过；Firefox HTML5 DnD/编辑待验收 | memo section create/rename/reorder/delete/collapse implementation |
| 288 | §29 备忘录标题 | 新输入行自动获得焦点。 | 源码通过；Firefox HTML5 DnD/编辑待验收 | memo section create/rename/reorder/delete/collapse implementation |
| 289 | §29 备忘录标题 | 新建分隔标题不弹出居中的模态框。 | 源码通过；Firefox HTML5 DnD/编辑待验收 | memo section create/rename/reorder/delete/collapse implementation |
| 290 | §29 备忘录标题 | 双击分隔标题可以改名。 | 源码通过；Firefox HTML5 DnD/编辑待验收 | memo section create/rename/reorder/delete/collapse implementation |
| 291 | §29 备忘录标题 | 分隔标题可以拖动排序。 | 源码通过；Firefox HTML5 DnD/编辑待验收 | memo section create/rename/reorder/delete/collapse implementation |
| 292 | §29 备忘录标题 | 拖动标题时，标题和标题内全部条目作为整体移动。 | 源码通过；Firefox HTML5 DnD/编辑待验收 | memo section create/rename/reorder/delete/collapse implementation |
| 293 | §29 备忘录标题 | 未分组条目可以拖入某个标题。 | 源码通过；Firefox HTML5 DnD/编辑待验收 | memo section create/rename/reorder/delete/collapse implementation |
| 294 | §29 备忘录标题 | 条目也可以拖出标题区域重新成为未分组条目。 | 源码通过；Firefox HTML5 DnD/编辑待验收 | memo section create/rename/reorder/delete/collapse implementation |
| 295 | §29 备忘录标题 | 未分组条目允许位于不同分隔标题之间。 | 源码通过；Firefox HTML5 DnD/编辑待验收 | memo section create/rename/reorder/delete/collapse implementation |
| 296 | §29 备忘录标题 | 删除分隔标题时不删除其中条目。 | 源码通过；Firefox HTML5 DnD/编辑待验收 | memo section create/rename/reorder/delete/collapse implementation |
| 297 | §29 备忘录标题 | 删除标题后，内部条目按照原有顺序成为未分组条目。 | 源码通过；Firefox HTML5 DnD/编辑待验收 | memo section create/rename/reorder/delete/collapse implementation |
| 298 | §29 备忘录标题 | 分隔标题可以折叠。 | 源码通过；Firefox HTML5 DnD/编辑待验收 | memo section create/rename/reorder/delete/collapse implementation |
| 299 | §29 备忘录标题 | 折叠标题显示其中条目数量。 | 源码通过；Firefox HTML5 DnD/编辑待验收 | memo section create/rename/reorder/delete/collapse implementation |
| 300 | §29 备忘录标题 | 搜索或正文定位需要访问其中条目时，可以自动展开标题。 | 源码通过；Firefox HTML5 DnD/编辑待验收 | memo section create/rename/reorder/delete/collapse implementation |
| 301 | §30 备忘录选择与批量操作 | 备忘录普通单击：单选。 | 源码通过；Firefox HTML5 DnD 待验收 | memo click/multiselect/batch reorder/section-drop implementation |
| 302 | §30 备忘录选择与批量操作 | 备忘录双击：编辑。 | 源码通过；Firefox HTML5 DnD 待验收 | memo click/multiselect/batch reorder/section-drop implementation |
| 303 | §30 备忘录选择与批量操作 | Ctrl＋单击备忘录条目：追加或取消多选。 | 源码通过；Firefox HTML5 DnD 待验收 | memo click/multiselect/batch reorder/section-drop implementation |
| 304 | §30 备忘录选择与批量操作 | Shift＋单击具有正文锚点的条目：定位正文。 | 源码通过；Firefox HTML5 DnD 待验收 | memo click/multiselect/batch reorder/section-drop implementation |
| 305 | §30 备忘录选择与批量操作 | Shift＋单击无正文锚点条目：等同普通单击。 备忘录多选支持： | 源码通过；Firefox HTML5 DnD 待验收 | memo click/multiselect/batch reorder/section-drop implementation |
| 306 | §30 备忘录选择与批量操作 | 批量删除。 | 源码通过；Firefox HTML5 DnD 待验收 | memo click/multiselect/batch reorder/section-drop implementation |
| 307 | §30 备忘录选择与批量操作 | 批量改色。 | 源码通过；Firefox HTML5 DnD 待验收 | memo click/multiselect/batch reorder/section-drop implementation |
| 308 | §30 备忘录选择与批量操作 | 多个条目作为一组拖动排序。 | 源码通过；Firefox HTML5 DnD 待验收 | memo click/multiselect/batch reorder/section-drop implementation |
| 309 | §30 备忘录选择与批量操作 | 多个条目一起拖回画布。 | 源码通过；Firefox HTML5 DnD 待验收 | memo click/multiselect/batch reorder/section-drop implementation |
| 310 | §30 备忘录选择与批量操作 | 多个条目一起拖入同一个分隔标题。 ### 批量拖入标题 | 源码通过；Firefox HTML5 DnD 待验收 | memo click/multiselect/batch reorder/section-drop implementation |
| 311 | §30 备忘录选择与批量操作 | 多个选中备忘录条目可以一次拖入同一个标题区域。 | 源码通过；Firefox HTML5 DnD 待验收 | memo click/multiselect/batch reorder/section-drop implementation |
| 312 | §30 备忘录选择与批量操作 | 多条目拖入标题应作为整体操作处理。 | 源码通过；Firefox HTML5 DnD 待验收 | memo click/multiselect/batch reorder/section-drop implementation |
| 313 | §30 备忘录选择与批量操作 | 不允许一次拖动只让部分条目进入标题而其他部分失败。 | 源码通过；Firefox HTML5 DnD 待验收 | memo click/multiselect/batch reorder/section-drop implementation |
| 314 | §30 备忘录选择与批量操作 | 操作成功后保持这些条目原有相对顺序。 | 源码通过；Firefox HTML5 DnD 待验收 | memo click/multiselect/batch reorder/section-drop implementation |
| 315 | §31 删除备忘录条目 | 删除备忘录条目表示彻底删除该内容。 | 源码/部分自动通过 | memo deletion via atomic mutate/history; browser cleanup sequences |
| 316 | §31 删除备忘录条目 | 删除后不会自动送回画布。 | 源码/部分自动通过 | memo deletion via atomic mutate/history; browser cleanup sequences |
| 317 | §31 删除备忘录条目 | 单个删除可以撤回。 | 源码/部分自动通过 | memo deletion via atomic mutate/history; browser cleanup sequences |
| 318 | §31 删除备忘录条目 | 批量删除可以撤回。 | 源码/部分自动通过 | memo deletion via atomic mutate/history; browser cleanup sequences |
| 319 | §31 删除备忘录条目 | 一次批量删除只占一步撤回记录。 | 源码/部分自动通过 | memo deletion via atomic mutate/history; browser cleanup sequences |
| 320 | §32 颜色系统 | 固定显示三个颜色块，并且始终有一个“当前活动颜色槽”；当前活动颜色槽按 conversation 独立持久保存。新 conversation 默认第 1 槽；刷新、当前标签页关闭后重新打开，以及以后再次进入该 conversation 时，恢复该 conversation 最后保存的… | 自动/源码通过 | 3-slot constants/UI; strict color schema; mock entity/highlight RGB match |
| 321 | §32 颜色系统 | 默认三色为： - 低饱和雾蓝； - 鼠尾草绿； - 浅沙黄。 | 自动/源码通过 | 3-slot constants/UI; strict color schema; mock entity/highlight RGB match |
| 322 | §32 颜色系统 | 三个颜色块旁只设置一个共用齿轮；齿轮始终编辑当前活动颜色槽。 | 自动/源码通过 | 3-slot constants/UI; strict color schema; mock entity/highlight RGB match |
| 323 | §32 颜色系统 | 单击某个颜色块时： - 如果当前没有画布节点或备忘录条目被选中，只把该颜色槽设为当前活动槽； - 如果当前存在画布节点或备忘录条目选择，则同时把该槽设为当前活动槽，并把当前选择集合中的对象统一改为该槽当前实际颜色； - 因选择区域互斥，不允许一次颜色操作同时作用于画布节点和备忘录条目。 | 自动/源码通过；Firefox 色盘待验收 | 3-slot constants/UI; strict color schema; mock entity/highlight RGB match |
| 324 | §32 颜色系统 | 点击共用齿轮后，用户可以通过色盘或填写 RGB 修改当前活动颜色槽，并明确选择修改范围为“当前对话”或“全局默认”。 | 自动/源码通过；Firefox 色盘待验收 | 3-slot constants/UI; strict color schema; mock entity/highlight RGB match |
| 325 | §32 颜色系统 | 选择“当前对话”时，如果该 conversation 原本没有独立颜色覆盖，则先以其当时实际使用的三个颜色槽建立完整独立副本，再修改当前活动槽；选择“全局默认”时修改全局三色默认定义。 | 自动/源码通过；Firefox 色盘待验收 | 3-slot constants/UI; strict color schema; mock entity/highlight RGB match |
| 326 | §32 颜色系统 | 修改任何颜色槽定义后，已经存在且使用旧颜色值的画布节点和备忘录条目保持原实际颜色不变。 | 自动/源码通过；Firefox 色盘待验收 | 3-slot constants/UI; strict color schema; mock entity/highlight RGB match |
| 327 | §32 颜色系统 | 新创建节点使用当前活动颜色槽的当前实际颜色；以后通过颜色块重新改色的对象使用操作当时该颜色槽的实际颜色值。对于具有正文锚点的节点或备忘录条目，ChatGPT 正文中的对应摘录高亮必须使用该对象实际颜色的半透明表现，使节点/条目颜色与正文高亮在视觉上保持对应；同一正文位置对应多个不同颜… | 自动/源码通过 | 3-slot constants/UI; strict color schema; mock entity/highlight RGB match |
| 328 | §32 颜色系统 | 三个颜色槽存在一套全局默认设置。 | 自动/源码通过；Firefox 色盘待验收 | 3-slot constants/UI; strict color schema; mock entity/highlight RGB match |
| 329 | §32 颜色系统 | 每个 ChatGPT 对话可以建立自己的完整三色独立覆盖；一旦建立，之后全局默认变化不再改变该对话的三个槽定义。 | 自动/源码通过；Firefox 色盘待验收 | 3-slot constants/UI; strict color schema; mock entity/highlight RGB match |
| 330 | §32 颜色系统 | 对话没有独立覆盖时直接使用全局默认；全局默认被修改后，这些未覆盖对话以后新建或重新改色时使用新的实际颜色，但其既有对象颜色仍按第 326 条保持不变。 | 自动/源码通过；Firefox 色盘待验收 | 3-slot constants/UI; strict color schema; mock entity/highlight RGB match |
| 331 | §32 颜色系统 | 创建 ChatGPT 分支时，新分支继承来源对话在分支发生时实际使用的三个颜色槽，并立即形成新分支自己的完整独立三色副本；新分支的当前活动颜色槽固定从第 1 槽开始，不继承来源 conversation 当时的活动槽。 | 自动/源码通过；Firefox 色盘待验收 | 3-slot constants/UI; strict color schema; mock entity/highlight RGB match |
| 332 | §32 颜色系统 | 分支创建后，新旧对话分别修改颜色槽定义和各自的当前活动槽，互不影响。 | 自动/源码通过；Firefox 色盘待验收 | 3-slot constants/UI; strict color schema; mock entity/highlight RGB match |
| 333 | §32 颜色系统 | 单个对象改色占一步撤回记录；一次对多个选中对象执行的批量改色只占一步撤回记录。切换当前活动颜色槽本身不属于对象改色。 | 自动/源码通过；Firefox 色盘待验收 | 3-slot constants/UI; strict color schema; mock entity/highlight RGB match |
| 334 | §32 颜色系统 | 节点和备忘录条目的选中状态必须使用明显高对比轮廓或等效高对比标识，不能只依靠填充颜色表示。 | 自动/源码通过；Firefox 色盘待验收 | 3-slot constants/UI; strict color schema; mock entity/highlight RGB match |
| 335 | §33 搜索 | 搜索范围只限当前 ChatGPT 对话的 ChatGPT NET 内容。 | 源码通过；当前 ChatGPT 定位待验收 | plain substring search and locate/expand implementation |
| 336 | §33 搜索 | 搜索包括： - 画布节点显示文字； - 原始正文摘录； - 自由节点文字； - 备忘录条目； - 备忘录分隔标题。 | 源码通过；当前 ChatGPT 定位待验收 | plain substring search and locate/expand implementation |
| 337 | §33 搜索 | 搜索使用普通文字包含匹配。 | 源码通过；当前 ChatGPT 定位待验收 | plain substring search and locate/expand implementation |
| 338 | §33 搜索 | 不把查询解释为正则表达式。 | 源码通过；当前 ChatGPT 定位待验收 | plain substring search and locate/expand implementation |
| 339 | §33 搜索 | ChatGPT NET 搜索不接管 Firefox 或 ChatGPT 原有 Ctrl＋F。 | 源码通过；当前 ChatGPT 定位待验收 | plain substring search and locate/expand implementation |
| 340 | §33 搜索 | 点击搜索结果后定位到对应节点或备忘录条目。 | 源码通过；当前 ChatGPT 定位待验收 | plain substring search and locate/expand implementation |
| 341 | §33 搜索 | 搜索定位不改变画布缩放。 | 源码通过；当前 ChatGPT 定位待验收 | plain substring search and locate/expand implementation |
| 342 | §33 搜索 | 搜索定位不重新整理整个画布。 | 源码通过；当前 ChatGPT 定位待验收 | plain substring search and locate/expand implementation |
| 343 | §33 搜索 | 搜索目标位于折叠备忘录标题内时，可以自动展开对应标题。 | 源码通过；当前 ChatGPT 定位待验收 | plain substring search and locate/expand implementation |
| 344 | §33 搜索 | 搜索目标位于允许折叠的隐藏层级中时，可以展开必要内容。 | 源码通过；当前 ChatGPT 定位待验收 | plain substring search and locate/expand implementation |
| 345 | §34 撤回与重做 | 最多保留最近 15 个可撤回操作。 | 自动/源码通过 | 15-step snapshot history; batch relation/memo return one-undo browser tests |
| 346 | §34 撤回与重做 | 超过 15 步后逐步删除最早记录。 | 自动/源码通过 | 15-step snapshot history; batch relation/memo return one-undo browser tests |
| 347 | §34 撤回与重做 | 新的可撤回用户操作发生后，原有重做链清空。 ### 进入撤回历史 | 自动/源码通过；完整实机序列待验收 | 15-step snapshot history; batch relation/memo return one-undo browser tests |
| 348 | §34 撤回与重做 | 创建一个节点。 | 源码/部分自动通过；完整实机序列待验收 | 15-step snapshot history; batch relation/memo return one-undo browser tests |
| 349 | §34 撤回与重做 | 一次创建多个节点。 | 源码/部分自动通过；完整实机序列待验收 | 15-step snapshot history; batch relation/memo return one-undo browser tests |
| 350 | §34 撤回与重做 | 创建自由节点。 | 源码/部分自动通过；完整实机序列待验收 | 15-step snapshot history; batch relation/memo return one-undo browser tests |
| 351 | §34 撤回与重做 | 编辑节点文字。 | 源码/部分自动通过；完整实机序列待验收 | 15-step snapshot history; batch relation/memo return one-undo browser tests |
| 352 | §34 撤回与重做 | 编辑备忘录条目文字。 | 源码/部分自动通过；完整实机序列待验收 | 15-step snapshot history; batch relation/memo return one-undo browser tests |
| 353 | §34 撤回与重做 | 手动移动节点。 | 源码/部分自动通过；完整实机序列待验收 | 15-step snapshot history; batch relation/memo return one-undo browser tests |
| 354 | §34 撤回与重做 | 多选节点整体移动。 | 源码/部分自动通过；完整实机序列待验收 | 15-step snapshot history; batch relation/memo return one-undo browser tests |
| 355 | §34 撤回与重做 | 建立单条层级关系，或按第 82 条一次批量建立多条共同上游关系。 | 自动/源码通过；完整实机序列待验收 | 15-step snapshot history; batch relation/memo return one-undo browser tests |
| 356 | §34 撤回与重做 | 双击独有关系线解除关系。 | 源码/部分自动通过；完整实机序列待验收 | 15-step snapshot history; batch relation/memo return one-undo browser tests |
| 357 | §34 撤回与重做 | 工具栏“解除”删除所选节点的全部父级关系。 | 源码/部分自动通过；完整实机序列待验收 | 15-step snapshot history; batch relation/memo return one-undo browser tests |
| 358 | §34 撤回与重做 | 删除节点。 | 源码/部分自动通过；完整实机序列待验收 | 15-step snapshot history; batch relation/memo return one-undo browser tests |
| 359 | §34 撤回与重做 | 批量删除节点。 | 源码/部分自动通过；完整实机序列待验收 | 15-step snapshot history; batch relation/memo return one-undo browser tests |
| 360 | §34 撤回与重做 | 调整节点宽度。 | 源码/部分自动通过；完整实机序列待验收 | 15-step snapshot history; batch relation/memo return one-undo browser tests |
| 361 | §34 撤回与重做 | 节点改色。 | 源码/部分自动通过；完整实机序列待验收 | 15-step snapshot history; batch relation/memo return one-undo browser tests |
| 362 | §34 撤回与重做 | 批量改色。 | 源码/部分自动通过；完整实机序列待验收 | 15-step snapshot history; batch relation/memo return one-undo browser tests |
| 363 | §34 撤回与重做 | 节点转入备忘录。 | 源码/部分自动通过；完整实机序列待验收 | 15-step snapshot history; batch relation/memo return one-undo browser tests |
| 364 | §34 撤回与重做 | 备忘录条目拖回画布。 | 源码/部分自动通过；完整实机序列待验收 | 15-step snapshot history; batch relation/memo return one-undo browser tests |
| 365 | §34 撤回与重做 | 多个备忘录条目一起拖回画布。 | 源码/部分自动通过；完整实机序列待验收 | 15-step snapshot history; batch relation/memo return one-undo browser tests |
| 366 | §34 撤回与重做 | 备忘录条目排序。 | 源码/部分自动通过；完整实机序列待验收 | 15-step snapshot history; batch relation/memo return one-undo browser tests |
| 367 | §34 撤回与重做 | 备忘录批量排序。 | 源码/部分自动通过；完整实机序列待验收 | 15-step snapshot history; batch relation/memo return one-undo browser tests |
| 368 | §34 撤回与重做 | 删除备忘录条目。 | 源码/部分自动通过；完整实机序列待验收 | 15-step snapshot history; batch relation/memo return one-undo browser tests |
| 369 | §34 撤回与重做 | 批量删除备忘录条目。 | 源码/部分自动通过；完整实机序列待验收 | 15-step snapshot history; batch relation/memo return one-undo browser tests |
| 370 | §34 撤回与重做 | 创建备忘录分隔标题。 | 源码/部分自动通过；完整实机序列待验收 | 15-step snapshot history; batch relation/memo return one-undo browser tests |
| 371 | §34 撤回与重做 | 修改标题。 | 源码/部分自动通过；完整实机序列待验收 | 15-step snapshot history; batch relation/memo return one-undo browser tests |
| 372 | §34 撤回与重做 | 移动标题。 | 源码/部分自动通过；完整实机序列待验收 | 15-step snapshot history; batch relation/memo return one-undo browser tests |
| 373 | §34 撤回与重做 | 删除标题。 | 源码/部分自动通过；完整实机序列待验收 | 15-step snapshot history; batch relation/memo return one-undo browser tests |
| 374 | §34 撤回与重做 | 多个条目一起拖入标题。 | 源码/部分自动通过；完整实机序列待验收 | 15-step snapshot history; batch relation/memo return one-undo browser tests |
| 375 | §34 撤回与重做 | 用户主动执行的结构整理操作。 ### 不进入撤回历史 | 源码/部分自动通过；完整实机序列待验收 | 15-step snapshot history; batch relation/memo return one-undo browser tests |
| 376 | §34 撤回与重做 | 节点或层级折叠。 | 源码/部分自动通过；完整实机序列待验收 | 15-step snapshot history; batch relation/memo return one-undo browser tests |
| 377 | §34 撤回与重做 | 节点或层级展开。 | 源码/部分自动通过；完整实机序列待验收 | 15-step snapshot history; batch relation/memo return one-undo browser tests |
| 378 | §34 撤回与重做 | 备忘录标题折叠或展开。 | 源码/部分自动通过；完整实机序列待验收 | 15-step snapshot history; batch relation/memo return one-undo browser tests |
| 379 | §34 撤回与重做 | 画布平移。 | 源码/部分自动通过；完整实机序列待验收 | 15-step snapshot history; batch relation/memo return one-undo browser tests |
| 380 | §34 撤回与重做 | 调整画布当前查看位置。 | 源码/部分自动通过；完整实机序列待验收 | 15-step snapshot history; batch relation/memo return one-undo browser tests |
| 381 | §34 撤回与重做 | 画布缩放。 | 源码/部分自动通过；完整实机序列待验收 | 15-step snapshot history; batch relation/memo return one-undo browser tests |
| 382 | §34 撤回与重做 | 调整画布显示区域大小。 | 源码/部分自动通过；完整实机序列待验收 | 15-step snapshot history; batch relation/memo return one-undo browser tests |
| 383 | §34 撤回与重做 | 调整侧栏宽度。 | 源码/部分自动通过；完整实机序列待验收 | 15-step snapshot history; batch relation/memo return one-undo browser tests |
| 384 | §34 撤回与重做 | 调整画布/备忘录高度比例。 | 源码/部分自动通过；完整实机序列待验收 | 15-step snapshot history; batch relation/memo return one-undo browser tests |
| 385 | §34 撤回与重做 | 当前选择状态。 | 源码/部分自动通过；完整实机序列待验收 | 15-step snapshot history; batch relation/memo return one-undo browser tests |
| 386 | §34 撤回与重做 | 当前搜索词。 | 源码/部分自动通过；完整实机序列待验收 | 15-step snapshot history; batch relation/memo return one-undo browser tests |
| 387 | §34 撤回与重做 | 休眠和唤醒。 | 源码/部分自动通过；完整实机序列待验收 | 15-step snapshot history; batch relation/memo return one-undo browser tests |
| 388 | §34 撤回与重做 | 修改三个颜色槽定义本身，以及单纯切换当前活动颜色槽；如果切换颜色槽同时导致选中对象改色，则对象改色部分仍按第 361～362 条进入撤回历史。 | 源码/部分自动通过；完整实机序列待验收 | 15-step snapshot history; batch relation/memo return one-undo browser tests |
| 389 | §34 撤回与重做 | 通过 Firefox 工具栏关闭或重新显示 ChatGPT NET 页面界面本身。 | 源码/部分自动通过；完整实机序列待验收 | 15-step snapshot history; batch relation/memo return one-undo browser tests |
| 390 | §34 撤回与重做 | 因 Firefox 工具栏关闭/重新显示 ChatGPT NET 而发生的 ChatGPT 页面宽度恢复或重新预留。 | 源码/部分自动通过；完整实机序列待验收 | 15-step snapshot history; batch relation/memo return one-undo browser tests |
| 391 | §34 撤回与重做 | Ctrl＋Z：撤回。 | 自动/源码通过；完整实机序列待验收 | 15-step snapshot history; batch relation/memo return one-undo browser tests |
| 392 | §34 撤回与重做 | Ctrl＋Shift＋Z：重做。 | 自动/源码通过；完整实机序列待验收 | 15-step snapshot history; batch relation/memo return one-undo browser tests |
| 393 | §35 休眠 | 休眠功能保留。 | 源码/部分自动通过；10分钟实机待验收 | sleep timer/message-watch suspension; full-close teardown browser test |
| 394 | §35 休眠 | 休眠主要目的为降低未使用画布时的 CPU 和内存负担。 | 源码/部分自动通过；10分钟实机待验收 | sleep timer/message-watch suspension; full-close teardown browser test |
| 395 | §35 休眠 | 画布连续约 10 分钟没有有效操作时进入休眠。 | 源码/部分自动通过；10分钟实机待验收 | sleep timer/message-watch suspension; full-close teardown browser test |
| 396 | §35 休眠 | 点击亮色 Firefox 工具栏图标关闭 ChatGPT NET 时，立即停止该标签页中的画布后台活动。 | 自动/源码通过；10分钟实机待验收 | sleep timer/message-watch suspension; full-close teardown browser test |
| 397 | §35 休眠 | 关闭 ChatGPT NET 时应移除侧栏、正文高亮和可安全移除的运行时监听/计时器；只允许保留再次接收 Firefox 工具栏开启命令所必需的最小消息入口，不继续执行画布处理。 | 自动/源码通过；10分钟实机待验收 | sleep timer/message-watch suspension; full-close teardown browser test |
| 398 | §35 休眠 | 超时休眠状态下显示明显遮罩。 | 源码/部分自动通过；10分钟实机待验收 | sleep timer/message-watch suspension; full-close teardown browser test |
| 399 | §35 休眠 | 休眠期间暂停可以安全暂停的画布活动和后台处理。 | 源码/部分自动通过；10分钟实机待验收 | sleep timer/message-watch suspension; full-close teardown browser test |
| 400 | §35 休眠 | 休眠不得改变： - 节点； - 层级关系； - 备忘录； - 当前画布位置； - 缩放； - 画布/备忘录比例。 | 源码/部分自动通过；10分钟实机待验收 | sleep timer/message-watch suspension; full-close teardown browser test |
| 401 | §35 休眠 | 通过 Firefox 工具栏重新开启 ChatGPT NET 时，恢复运行并按已保存状态显示当前 conversation；这一“关闭/重新开启”不是独立的页面内收起状态。 | 自动/源码通过；10分钟实机待验收 | sleep timer/message-watch suspension; full-close teardown browser test |
| 402 | §35 休眠 | 插件保持开启但因约 10 分钟超时进入休眠时，点击休眠遮罩即可重新激活。 | 源码/部分自动通过；10分钟实机待验收 | sleep timer/message-watch suspension; full-close teardown browser test |
| 403 | §35 休眠 | 休眠和唤醒不进入撤回历史。 | 源码/部分自动通过；10分钟实机待验收 | sleep timer/message-watch suspension; full-close teardown browser test |
| 404 | §36 ChatGPT 分支 | 只有满足以下条件时，才把来源对话的 ChatGPT NET 内容复制到新的 ChatGPT 分支： - 来源对话中 ChatGPT NET 已经打开； - 用户现场触发 ChatGPT 分支操作； - 同一标签页随后进入新的 conversation； - 能够可靠确认该新 conv… | 自动/源码通过；ChatGPT 真实分支待验收 | branch clone core test; fingerprint verification + exact-anchor filter source |
| 405 | §36 ChatGPT 分支 | 不扫描以前已经存在的历史分支。 | 自动/源码通过；ChatGPT 真实分支待验收 | branch clone core test; fingerprint verification + exact-anchor filter source |
| 406 | §36 ChatGPT 分支 | 直接打开旧分支时不自动复制来源画布。 | 自动/源码通过；ChatGPT 真实分支待验收 | branch clone core test; fingerprint verification + exact-anchor filter source |
| 407 | §36 ChatGPT 分支 | 新分支创建后拥有完全独立的 ChatGPT NET 画布。 | 自动/源码通过；ChatGPT 真实分支待验收 | branch clone core test; fingerprint verification + exact-anchor filter source |
| 408 | §36 ChatGPT 分支 | 新分支后续修改不影响来源对话。 | 自动/源码通过；ChatGPT 真实分支待验收 | branch clone core test; fingerprint verification + exact-anchor filter source |
| 409 | §36 ChatGPT 分支 | 来源对话后续修改也不影响已创建的新分支。 | 自动/源码通过；ChatGPT 真实分支待验收 | branch clone core test; fingerprint verification + exact-anchor filter source |
| 410 | §36 ChatGPT 分支 | 自由节点复制到新分支。 | 自动/源码通过；ChatGPT 真实分支待验收 | branch clone core test; fingerprint verification + exact-anchor filter source |
| 411 | §36 ChatGPT 分支 | 只有能够在新分支正文中可靠定位的正文摘录节点才复制。 | 自动/源码通过；ChatGPT 真实分支待验收 | branch clone core test; fingerprint verification + exact-anchor filter source |
| 412 | §36 ChatGPT 分支 | 无法可靠定位的正文内容不得错误绑定。 | 自动/源码通过；ChatGPT 真实分支待验收 | branch clone core test; fingerprint verification + exact-anchor filter source |
| 413 | §36 ChatGPT 分支 | 多父层级网络中，如果某个节点未复制，与该节点直接相关的关系不复制。 | 自动/源码通过；ChatGPT 真实分支待验收 | branch clone core test; fingerprint verification + exact-anchor filter source |
| 414 | §36 ChatGPT 分支 | 其余仍然合法的关系继续保留。 | 自动/源码通过；ChatGPT 真实分支待验收 | branch clone core test; fingerprint verification + exact-anchor filter source |
| 415 | §36 ChatGPT 分支 | 新分支不继承来源画布的撤回历史。 | 自动/源码通过；ChatGPT 真实分支待验收 | branch clone core test; fingerprint verification + exact-anchor filter source |
| 416 | §36 ChatGPT 分支 | 新分支继承来源对话分支发生时实际使用的三个颜色槽。 | 自动/源码通过；ChatGPT 真实分支待验收 | branch clone core test; fingerprint verification + exact-anchor filter source |
| 417 | §36 ChatGPT 分支 | 分支完成后，新旧对话颜色槽相互独立。 | 自动/源码通过；ChatGPT 真实分支待验收 | branch clone core test; fingerprint verification + exact-anchor filter source |
| 418 | §37 导入、导出与备份 | 设置中可以导出当前 ChatGPT 对话画布。 | 自动/源码通过；Firefox 文件 UI 待验收 | schema/router import validation; whole-version decisions; export/import source |
| 419 | §37 导入、导出与备份 | 可以导出全部 ChatGPT NET 画布。 | 自动/源码通过；Firefox 文件 UI 待验收 | schema/router import validation; whole-version decisions; export/import source |
| 420 | §37 导入、导出与备份 | 导出数据应包含恢复画布所需的： - 节点； - 原始摘录； - 正文锚点； - 节点位置； - 层级网络； - 备忘录； - 颜色； - 相关设置； - 分支来源信息。 | 自动/源码通过；Firefox 文件 UI 待验收 | schema/router import validation; whole-version decisions; export/import source |
| 421 | §37 导入、导出与备份 | 不要求导出撤回历史。 | 自动/源码通过；Firefox 文件 UI 待验收 | schema/router import validation; whole-version decisions; export/import source |
| 422 | §37 导入、导出与备份 | 导出前提示备份文件包含 ChatGPT 对话摘录和正文定位信息。 | 自动/源码通过；Firefox 文件 UI 待验收 | schema/router import validation; whole-version decisions; export/import source |
| 423 | §37 导入、导出与备份 | 可以导入本版本支持格式的合法 ChatGPT NET 备份。ChatGPT NET 1.3 继续作为独立的新项目实现，不扫描、不读取、不迁移、不升级，也不要求兼容 Chat Tree 0.4.3、旧 Chat Tree schema 或其他旧项目画布数据；旧格式文件不属于合法导入格式。 | 自动/源码通过；Firefox 文件 UI 待验收 | schema/router import validation; whole-version decisions; export/import source |
| 424 | §37 导入、导出与备份 | 导入错误、损坏或不受支持版本的文件不能破坏现有数据。 | 自动/源码通过；Firefox 文件 UI 待验收 | schema/router import validation; whole-version decisions; export/import source |
| 425 | §37 导入、导出与备份 | 导入与当前画布冲突时，不自动混合两个版本。 | 自动/源码通过；Firefox 文件 UI 待验收 | schema/router import validation; whole-version decisions; export/import source |
| 426 | §37 导入、导出与备份 | 不静默覆盖现有画布。 | 自动/源码通过；Firefox 文件 UI 待验收 | schema/router import validation; whole-version decisions; export/import source |
| 427 | §37 导入、导出与备份 | 应让用户选择保留哪个完整版本。 | 自动/源码通过；Firefox 文件 UI 待验收 | schema/router import validation; whole-version decisions; export/import source |
| 428 | §37 导入、导出与备份 | 导入失败时，现有数据保持不变。 | 自动/源码通过；Firefox 文件 UI 待验收 | schema/router import validation; whole-version decisions; export/import source |
| 429 | §37 导入、导出与备份 | 不向用户宣称可以把 Firefox 内部数据库移动到任意用户指定目录。 | 自动/源码通过；Firefox 文件 UI 待验收 | schema/router import validation; whole-version decisions; export/import source |
| 430 | §37 导入、导出与备份 | 设置中提供导入、导出和必要的备份位置说明。 | 自动/源码通过；Firefox 文件 UI 待验收 | schema/router import validation; whole-version decisions; export/import source |
| 431 | §38 隐私窗口 | 用户在 Firefox 中允许扩展用于隐私窗口后，可以正常使用 ChatGPT NET。 | manifest/源码通过；Firefox 隐私窗口待验收 | `incognito: spanning`; local storage; no first-use warning source |
| 432 | §38 隐私窗口 | 普通窗口和隐私窗口使用同一套本地 ChatGPT NET 数据。 | manifest/源码通过；Firefox 隐私窗口待验收 | `incognito: spanning`; local storage; no first-use warning source |
| 433 | §38 隐私窗口 | 不显示“隐私窗口中的摘录仍会永久保存在本机”的首次使用提醒。 | manifest/源码通过；Firefox 隐私窗口待验收 | `incognito: spanning`; local storage; no first-use warning source |
| 434 | §38 隐私窗口 | 关闭隐私窗口不会自动删除其中对应的 ChatGPT NET 数据。 | manifest/源码通过；Firefox 隐私窗口待验收 | `incognito: spanning`; local storage; no first-use warning source |
| 435 | §39 数据恢复和多标签页 | 刷新 ChatGPT 页面后，已有 ChatGPT NET 画布应恢复。 | 源码通过；Firefox 多标签/重启待验收 | revision-checked background writes and explicit conflict messages |
| 436 | §39 数据恢复和多标签页 | 关闭并重新打开 Firefox 后，已有画布应恢复。 | 源码通过；Firefox 多标签/重启待验收 | revision-checked background writes and explicit conflict messages |
| 437 | §39 数据恢复和多标签页 | 同一个 ChatGPT conversation 在多个标签页同时打开时，不得相互静默覆盖数据。 | 源码通过；Firefox 多标签/重启待验收 | revision-checked background writes and explicit conflict messages |
| 438 | §39 数据恢复和多标签页 | 如果出现写入冲突，应明确提示，而不是默默丢失某一标签页操作。 | 源码通过；Firefox 多标签/重启待验收 | revision-checked background writes and explicit conflict messages |
| 439 | §39 数据恢复和多标签页 | 保存失败时必须提供可理解的错误提示。 | 源码通过；Firefox 多标签/重启待验收 | revision-checked background writes and explicit conflict messages |
| 440 | §39 数据恢复和多标签页 | 保存失败不得静默造成用户内容消失。 | 源码通过；Firefox 多标签/重启待验收 | revision-checked background writes and explicit conflict messages |
| 441 | §40 ChatGPT 页面变化保护 | ChatGPT 流式生成消息期间，不得重复创建多个 ChatGPT NET 侧栏。 | 源码通过；当前 ChatGPT 重渲染待验收 | single mount; message watcher; conservative anchor failure behavior |
| 442 | §40 ChatGPT 页面变化保护 | ChatGPT 页面内部重新渲染时，不得造成画布节点丢失。 | 源码通过；当前 ChatGPT 重渲染待验收 | single mount; message watcher; conservative anchor failure behavior |
| 443 | §40 ChatGPT 页面变化保护 | ChatGPT 页面结构发生变化，导致正文锚点无法可靠识别时： - 保留已有画布； - 保留备忘录； - 自由节点继续可用； - 暂停可能创建错误正文锚点的功能； - 暂停不可靠的正文定位； - 不将摘录错误绑定到其他消息。 | 源码通过；当前 ChatGPT 重渲染待验收 | single mount; message watcher; conservative anchor failure behavior |
| 444 | §40 ChatGPT 页面变化保护 | 页面结构恢复可识别后，可重新恢复正文相关功能。 | 源码通过；当前 ChatGPT 重渲染待验收 | single mount; message watcher; conservative anchor failure behavior |
| 445 | §41 基本性能和稳定性 | ChatGPT NET 应至少在约 500 个节点及对应层级关系的规模下保持实际可用。 | 自动算法通过；Firefox 体感性能待验收 | 500-node core and 500/360 router stress; no-conflict validators |
| 446 | §41 基本性能和稳定性 | 正常拖动节点不应出现持续明显卡顿。 | 自动算法通过；Firefox 体感性能待验收 | 500-node core and 500/360 router stress; no-conflict validators |
| 447 | §41 基本性能和稳定性 | 正常画布平移不应出现持续明显卡顿。 | 自动算法通过；Firefox 体感性能待验收 | 500-node core and 500/360 router stress; no-conflict validators |
| 448 | §41 基本性能和稳定性 | 正常画布缩放不应出现持续明显卡顿。 | 自动算法通过；Firefox 体感性能待验收 | 500-node core and 500/360 router stress; no-conflict validators |
| 449 | §41 基本性能和稳定性 | 节点拖动过程中不应明显闪烁。 | 自动算法通过；Firefox 体感性能待验收 | preferred routes; incremental SVG reuse; 20-render browser timing; 500-node stress |
| 450 | §41 基本性能和稳定性 | 插件休眠、关闭、重新打开和刷新不得造成用户内容丢失。 | 自动算法通过；Firefox 体感性能待验收 | 500-node core and 500/360 router stress; no-conflict validators |
| 451 | §41 基本性能和稳定性 | 性能优化不能以违反节点和关系线硬性无冲突规则为代价。 | 自动算法通过；Firefox 体感性能待验收 | 500-node core and 500/360 router stress; no-conflict validators |
| 452 | §41 基本性能和稳定性 | 如果无法同时满足操作要求与硬性无冲突规则，应拒绝本次操作并给出明确提示，而不是接受错误布局。 | 自动算法通过；Firefox 体感性能待验收 | 500-node core and 500/360 router stress; no-conflict validators |
| 453 | §42 核心快捷操作总表 | 普通单击节点/备忘录条目：单选。 | 自动/源码通过；Firefox 键鼠待验收 | browser pointer-selection regression + keyboard handlers |
| 454 | §42 核心快捷操作总表 | Ctrl＋单击节点/备忘录条目：追加或取消多选。画布中已经多选后，整体拖到另一个未选节点主体上释放时，按第 82 条判断是否批量建立共同上游关系；不满足条件时不得部分建立。 | 自动/源码通过；Firefox 键鼠待验收 | browser pointer-selection regression + keyboard handlers |
| 455 | §42 核心快捷操作总表 | 双击节点/备忘录条目：编辑文字。 | 自动/源码通过；Firefox 键鼠待验收 | browser pointer-selection regression + keyboard handlers |
| 456 | §42 核心快捷操作总表 | Shift＋单击具有正文锚点的对象：跳转正文。 | 自动/源码通过；Firefox 键鼠待验收 | browser pointer-selection regression + keyboard handlers |
| 457 | §42 核心快捷操作总表 | Shift＋单击没有正文锚点的对象：普通单选。 | 自动/源码通过；Firefox 键鼠待验收 | browser pointer-selection regression + keyboard handlers |
| 458 | §42 核心快捷操作总表 | Ctrl＋画布空白拖动：框选画布节点。 | 自动/源码通过；Firefox 键鼠待验收 | browser pointer-selection regression + keyboard handlers |
| 459 | §42 核心快捷操作总表 | 普通画布空白拖动：平移画布。 | 自动/源码通过；Firefox 键鼠待验收 | browser pointer-selection regression + keyboard handlers |
| 460 | §42 核心快捷操作总表 | Ctrl＋鼠标滚轮：以鼠标位置为中心缩放画布。 | 自动/源码通过；Firefox 键鼠待验收 | browser pointer-selection regression + keyboard handlers |
| 461 | §42 核心快捷操作总表 | Ctrl＋Z：撤回。 | 自动/源码通过；Firefox 键鼠待验收 | browser pointer-selection regression + keyboard handlers |
| 462 | §42 核心快捷操作总表 | Ctrl＋Shift＋Z：重做。 | 自动/源码通过；Firefox 键鼠待验收 | browser pointer-selection regression + keyboard handlers |
| 463 | §42 核心快捷操作总表 | Esc：取消当前未完成操作、退出编辑或清除当前临时状态。 | 自动/源码通过；Firefox 键鼠待验收 | browser pointer-selection regression + keyboard handlers |
| 464 | §42 核心快捷操作总表 | 不使用 Alt 作为 ChatGPT NET 操作快捷键。 | 自动/源码通过；Firefox 键鼠待验收 | browser pointer-selection regression + keyboard handlers |
| 465 | §43 连续摘录快捷规则总表 | 连续摘录关闭： - 普通正文划选后显示“创建节点”入口。 | 自动/源码通过；当前 ChatGPT 选择待验收 | mock continuous/Ctrl bypass; source Shift bypass |
| 466 | §43 连续摘录快捷规则总表 | 连续摘录开启： - 普通正文划选 → 自动创建节点； - Ctrl＋正文划选 → 不创建节点； - Shift＋正文划选 → 不创建节点。 | 自动/源码通过；当前 ChatGPT 选择待验收 | mock continuous/Ctrl bypass; source Shift bypass |
| 467 | §43 连续摘录快捷规则总表 | Ctrl 和 Shift 的连续摘录绕过行为仅发生在正文划选过程中，不改变这些按键在画布中的其他既定用途。 | 自动/源码通过；当前 ChatGPT 选择待验收 | mock continuous/Ctrl bypass; source Shift bypass |
| 468 | §44 明确取消的旧需求 | 取消旧名称“Chat Tree”，统一使用 ChatGPT NET。 | 自动/源码通过 | `tests/static_audit.js` forbidden-token/behavior scan |
| 469 | §44 明确取消的旧需求 | 取消“一名子节点最多只能有一个父节点”的限制。 | 自动/源码通过 | `tests/static_audit.js` forbidden-token/behavior scan |
| 470 | §44 明确取消的旧需求 | 取消以树作为唯一层级结构的设计。 | 自动/源码通过 | `tests/static_audit.js` forbidden-token/behavior scan |
| 471 | §44 明确取消的旧需求 | 取消新节点纵向优先排列。 | 自动/源码通过 | `tests/static_audit.js` forbidden-token/behavior scan |
| 472 | §44 明确取消的旧需求 | 新节点统一改为横向优先、空间不足时换行。 | 自动/源码通过 | `tests/static_audit.js` forbidden-token/behavior scan |
| 473 | §44 明确取消的旧需求 | 取消 Alt＋单击多选。 | 自动/源码通过 | `tests/static_audit.js` forbidden-token/behavior scan |
| 474 | §44 明确取消的旧需求 | 取消 Alt＋框选。 | 自动/源码通过 | `tests/static_audit.js` forbidden-token/behavior scan |
| 475 | §44 明确取消的旧需求 | 取消 Alt＋滚轮缩放。 | 自动/源码通过 | `tests/static_audit.js` forbidden-token/behavior scan |
| 476 | §44 明确取消的旧需求 | 取消 Alt＋正文划选绕过连续摘录。 | 自动/源码通过 | `tests/static_audit.js` forbidden-token/behavior scan |
| 477 | §44 明确取消的旧需求 | 取消独立“适合内容”按钮。 | 自动/源码通过 | `tests/static_audit.js` forbidden-token/behavior scan |
| 478 | §44 明确取消的旧需求 | 取消“适合内容”功能。 | 自动/源码通过 | `tests/static_audit.js` forbidden-token/behavior scan |
| 479 | §44 明确取消的旧需求 | 取消“单击节点立即跳转正文”。 | 自动/源码通过 | `tests/static_audit.js` forbidden-token/behavior scan |
| 480 | §44 明确取消的旧需求 | 取消删除备忘录条目后自动送回画布。 | 自动/源码通过 | `tests/static_audit.js` forbidden-token/behavior scan |
| 481 | §44 明确取消的旧需求 | 取消正常桌面状态下将插件直接覆盖在 ChatGPT 正文上方。 | 自动/源码通过 | `tests/static_audit.js` forbidden-token/behavior scan |
| 482 | §44 明确取消的旧需求 | 取消所有子节点关系线无条件共享主干的规则。 | 自动/源码通过 | `tests/static_audit.js` forbidden-token/behavior scan |
| 483 | §44 明确取消的旧需求 | 只有拥有共同起点或共同终点的关系线允许共享相应主干。 | 自动/源码通过 | `tests/static_audit.js` forbidden-token/behavior scan |
| 484 | §44 明确取消的旧需求 | 取消节点折叠/展开进入撤回历史。 | 自动/源码通过 | `tests/static_audit.js` forbidden-token/behavior scan |
| 485 | §44 明确取消的旧需求 | 取消画布大小、缩放或视图位置变化进入撤回历史。 | 自动/源码通过 | `tests/static_audit.js` forbidden-token/behavior scan |
| 486 | §44 明确取消的旧需求 | 取消隐私窗口首次使用数据保存提醒。 | 自动/源码通过 | `tests/static_audit.js` forbidden-token/behavior scan |
| 487 | §45 功能优先级 | 第一优先：用户数据不能丢失。 | 自动/源码通过 | schema/router/mutate failure paths implement hard-priority cancellation |
| 488 | §45 功能优先级 | 第二优先：节点边框不得非法重叠。 | 自动/源码通过 | schema/router/mutate failure paths implement hard-priority cancellation |
| 489 | §45 功能优先级 | 第三优先：关系线不得穿过或接触无关节点。 | 自动/源码通过 | schema/router/mutate failure paths implement hard-priority cancellation |
| 490 | §45 功能优先级 | 第四优先：无共同起点/终点的关系线不得交叉或重叠。 | 自动/源码通过 | schema/router/mutate failure paths implement hard-priority cancellation |
| 491 | §45 功能优先级 | 第五优先：用户已经手工整理好的位置尽可能不被系统自动改动。 | 自动/源码通过 | schema/router/mutate failure paths implement hard-priority cancellation |
| 492 | §45 功能优先级 | 第六优先：新建、拖动和建立关系尽可能接近用户指定位置。 | 自动/源码通过 | schema/router/mutate failure paths implement hard-priority cancellation |
| 493 | §45 功能优先级 | 如果低优先级目标与高优先级硬性规则冲突，以高优先级规则为准。 | 自动/源码通过 | schema/router/mutate failure paths implement hard-priority cancellation |
| 494 | §45 功能优先级 | 如果最终没有合法解，则取消本次操作并明确提示，而不是产生非法画布状态。 | 自动/源码通过 | schema/router/mutate failure paths implement hard-priority cancellation |
| 495 | §46 Baseline 1.3 冻结原则 | 本文是 ChatGPT NET 1.3 后续代码修改和功能验收的唯一功能基线。 | 自动/源码通过 | baseline sections 1–46 and clauses 1–500 continuity assertions |
| 496 | §46 Baseline 1.3 冻结原则 | 原 Chat Tree v2、Chat Tree 0.4.3 及其他旧版本规范中与本基线冲突的功能要求全部废止；旧项目的数据兼容、迁移和升级不属于 ChatGPT NET 1.3 的实现目标。 | 自动/源码通过 | baseline sections 1–46 and clauses 1–500 continuity assertions |
| 497 | §46 Baseline 1.3 冻结原则 | 可以参考旧项目中仅属于必要安全、数据保存和 Firefox 稳定性的工程经验，但 ChatGPT NET 1.3 应采用独立的新项目数据模型/存储命名空间，不自动读取、迁移或改写旧 Chat Tree 画布数据，也不得因此改变本文确定的用户功能行为。 | 自动/源码通过 | baseline sections 1–46 and clauses 1–500 continuity assertions |
| 498 | §46 Baseline 1.3 冻结原则 | 后续代码实现不得自行增加 AI 功能、自动关系判断、Alt 快捷操作或其他未经确认的交互。 | 自动/源码通过 | baseline sections 1–46 and clauses 1–500 continuity assertions |
| 499 | §46 Baseline 1.3 冻结原则 | 如果实现过程中发现技术限制，优先调整实现方式，不自行改变已经冻结的功能语义。 | 自动/源码通过 | baseline sections 1–46 and clauses 1–500 continuity assertions |
| 500 | §46 Baseline 1.3 冻结原则 | 后续新增功能或改变本文规则，应作为 ChatGPT NET Functional Baseline 的新版本明确记录，不在代码中隐式改变。 | 自动/源码通过 | baseline sections 1–46 and clauses 1–500 continuity assertions |

## 7. 发布判定

当前源码审查没有发现仍需用户补充定义的 Baseline 1.3 功能语义，也没有发现已知的、能够在本环境复现而尚未修正的实现冲突。**但这不等于发布验收完成。** Windows Firefox 152+ 上必须先通过 `MANUAL_ACCEPTANCE_1.3.md`，尤其是用户本轮已经实际遇到的六项回归门槛、生产 ChatGPT 页面真实让位、正文原生选择、工具栏 icon 状态、隐私窗口、多标签冲突和真实 branch-in-new-chat。

# ChatGPT NET 1.4.2 — 修订 Baseline 1.3 重新校对记录

**校对日期：** 2026-08-09

**校对范围：** 仓库全部 Markdown、Functional Baseline 1.3 的 46 章/条款 1–500、Baseline Audit 1.3 的逐条矩阵、Manual Acceptance 1.3 的 0 与 A–R 验收组。

**版本关系：** 1.4.2 是回归 Baseline 1.3 语义的实现修正版；只修改第 83 条的多父独立性规则，其他 499 条编号和文字保持不变。

## 校对方法与结论

`tests/static_audit.js` 校验两份基线逐字一致、46 章与 1–500 连续、只有 Baseline 1.3 作为当前需求、版本/权限/禁用能力及关键实现映射；`tests/core.test.js` 验证 schema、DAG、多父独立性、共享主干和线路稳定；`tests/router_stress.test.js` 验证 500 节点代表性路由；`tests/browser_integration.py` 在真实 Chromium DOM 中执行 Range、pointer、HTML5 DnD、页面让位、滚动隔离、增量 SVG、备忘录命中反馈和关闭清理。随后逐行复核 `BASELINE_AUDIT_1.3.md` 的 500 条映射。

结论：源码和当前可执行自动化未发现剩余的已知 Baseline 冲突。Firefox 工具栏、当前生产 ChatGPT DOM、隐私窗口、多标签冲突、真实分支、10 分钟休眠及 500 节点主观手感仍属于人工验收边界，不被 Chromium mock 冒充为实机通过。

## 46 章逐章复核

| 章 | 主题 | 1.4.2 结果 | 主要证据 |
|---:|---|---|---|
| 1 | 产品定位 | 自动/源码通过 | manifest、无网络/AI/旧命名空间静态审计 |
| 2 | 插件名称与 Firefox 工具栏状态 | 自动/源码通过；Firefox 待验 | per-tab background、close/reopen 浏览器路径 |
| 3 | 侧栏显示与关闭 | 自动/源码通过；Firefox 待验 | toolbar-only、fullClose 清理 |
| 4 | ChatGPT 页面空间关系 | Chromium 通过；生产页面待验 | fixed/100vw 壳与 composer 让位测试 |
| 5 | 侧栏总体布局 | 自动/源码通过 | 尺寸常量、初始世界中心 |
| 6 | 固定工具区 | 自动/源码通过 | 工具栏、三色、解除、zoom DOM |
| 7 | 画布硬性无重叠 | 自动通过 | schema/geometry/router 单元和压力测试 |
| 8 | 手工层级网络 | 自动通过 | 局部落点、多父独立性、无全组件布局 |
| 9 | 删除和解除层级 | 自动通过 | 独有线/共享主干判定、解除浏览器测试 |
| 10 | 节点删除 | 自动通过 | 关系清理、批量与 undo |
| 11 | 折叠与展开 | 自动/源码通过 | 多父折叠限制、隐藏节点排除 |
| 12 | 正文创建节点 | Chromium 通过；生产 DOM 待验 | 原生 Range、跨消息、控件过滤 |
| 13 | 连续摘录 | Chromium 通过；生产 DOM 待验 | continuous/Ctrl/Shift 路径 |
| 14 | 自由节点 | 自动通过 | 创建、编辑、拖动、删除、关系 |
| 15 | 新节点自动排列 | 自动/源码通过 | 仅新节点 autoGroup，不重排关系组件 |
| 16 | 新节点空间不足 | 自动通过 | 最近合法组位置、原子失败 |
| 17 | 有限画布 | 自动通过 | 2880×3600、25%–300%、边界 |
| 18 | 节点显示和编辑 | 自动通过；字体待验 | DOM 高度与 schema 最低高度 |
| 19 | 拖动后冲突顺序 | 自动通过 | 旧线路保留→最近落点→少量相关→回滚 |
| 20 | 点击与选择 | Chromium 通过 | click/drag threshold、Ctrl/Shift、单选收敛 |
| 21 | 框选与平移 | Chromium/源码通过 | 手势隔离、正文滚动不变 |
| 22 | 画布/备忘录选择互斥 | Chromium 通过 | 双向选择断言 |
| 23 | 画布批量操作 | 自动通过 | 批量移动/关系/删除/改色原子性 |
| 24 | 正文锚点和双向定位 | Chromium 通过；生产 DOM 待验 | sanitized anchor/highlight、回退逻辑 |
| 25 | 缩放与视图 | 自动/源码通过 | 初始中心、zoom 范围、视图保存 |
| 26 | 备忘录基本行为 | Chromium 通过 | 扩大命中区、整区反馈、转换后无副本 |
| 27 | 单条拖回画布 | Chromium 通过 | HTML5 DnD、独立根、合法落点 |
| 28 | 多条拖回画布 | Chromium 通过 | 视觉顺序、全成/全败、单步 undo |
| 29 | 备忘录标题 | Chromium/源码通过 | 分组徽标/容器、新建/改名/折叠/排序 |
| 30 | 备忘录批量选择 | 自动/源码通过 | 互斥选择与批量 mutate |
| 31 | 删除备忘录条目 | 自动通过 | 真删除、批量与 undo |
| 32 | 颜色系统 | Chromium 通过 | 三槽、实体色与高亮 RGB |
| 33 | 搜索 | 自动/源码通过 | conversation-local substring、定位展开 |
| 34 | 撤回与重做 | 自动通过 | 15 步、批量单步、非 history 状态 |
| 35 | 休眠 | 源码通过；10 分钟待验 | timer/observer 暂停 |
| 36 | ChatGPT 分支 | 自动/源码通过；真实分支待验 | fingerprint、可定位实体复制 |
| 37 | 导入导出 | 自动通过；Firefox UI 待验 | Baseline 1.3 导出、1.3/1.4 严格导入 |
| 38 | 隐私窗口 | 源码通过；Firefox private 待验 | manifest spanning、无首次提示 |
| 39 | 恢复和多标签 | 自动/源码通过；实机待验 | revision conflict、错误保留 |
| 40 | 页面变化保护 | 自动/源码通过；生产 DOM 待验 | 导航监听、锚点安全、无效数据只读 |
| 41 | 性能和稳定性 | 自动通过；Firefox 体感待验 | 路线缓存、增量 SVG、20 render、500 节点压力 |
| 42 | 快捷操作总表 | 自动/源码通过 | Ctrl/Escape、editable 原生行为 |
| 43 | 连续摘录快捷规则 | Chromium/静态通过 | ordinary/Ctrl/Shift、无 Alt |
| 44 | 取消的旧需求 | 自动通过 | forbidden-token、无网络、旧 namespace |
| 45 | 功能优先级 | 自动/源码通过 | schema/router 硬规则和明确回滚 |
| 46 | Baseline 1.3 冻结原则 | 自动通过 | 46 章、1–500、仅第 83 条修订 |

## 人工验收文档逐组复核

| 组 | 对应内容 | 当前证据 | 目标实机边界 |
|---|---|---|---|
| 0 | 用户问题回归门槛 | 增量 SVG、滚动隔离、memo 反馈、三色自动通过 | Firefox 图标与生产页面最终确认 |
| A | 工具栏生命周期 | close/reopen、手势取消、宽度恢复 | Firefox per-tab 图标、刷新/重启 |
| B | 页面空间和尺寸 | 困难 fixed/100vw 布局通过 | 生产 ChatGPT 与窄窗 overlay |
| C | 正文/连续摘录 | Range、跨消息、过滤、Ctrl/Shift 通过 | 生产消息 DOM |
| D | 节点显示/编辑/移动 | click/pointer/selection/height 通过 | Firefox 字体、长文本视觉 |
| E | 框选/平移/缩放 | 滚动隔离和源码边界通过 | Firefox wheel/pointer 手感 |
| F | 多父与关系路由 | 独立父约束、共享主干、局部放置通过 | 密集自由图视觉抽检 |
| G | 删除/折叠/新节点排列 | core/browser/源码通过 | 长交互序列 |
| H | 备忘录/标题 | 扩大命中、单/多 DnD、分组视觉通过 | Firefox HTML5 DnD 手感 |
| I | 三色和高亮 | 三槽与 RGB 对应通过 | 生产正文 rect |
| J | 搜索和双向定位 | anchor/browser/source 通过 | 消息再生成/生产 DOM |
| K | Undo/Redo | core/browser 通过 | 16 步手工序列 |
| L | 休眠 | 源码通过 | 约 10 分钟真实等待 |
| M | ChatGPT 分支 | fingerprint/clone 通过 | 真实 Branch in new chat |
| N | 导入导出/数据安全 | schema/route/冲突保护通过 | Firefox 文件 UI |
| O | 隐私/多标签/恢复 | revision/source 路径通过 | private、stale tab、重启 |
| P | 页面变化保护 | mock 导航与只读保护通过 | 生产流式生成/selector 变化 |
| Q | 500 节点性能 | 500 节点路由、增量线路/DOM 通过 | Firefox 500 节点体感 |
| R | 发布前检查 | 静态禁用项、46/500、自动测试 | Firefox 控制台与全部待验项 |

## 最终判定

1.4.2 可作为修订 Baseline 1.3 的代码候选版本；当前环境可复现的用户报告问题已进入自动回归。只有 `MANUAL_ACCEPTANCE_1.3.md` 中标明的 Windows Firefox + 当前生产 ChatGPT 项目完成后，才可以声明目标实机全部通过。

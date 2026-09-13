# ChatGPT NET 1.4.4 — 修订 Baseline 1.3 重新校对记录

**校对日期：** 2026-08-10  
**校对范围：** 全部 Markdown、Functional Baseline 1.3 的 46 章/条款 1–500、Baseline Audit 逐条矩阵、Manual Acceptance 的 0 与 A–R。  
**版本关系：** 1.4.4 仅修正复杂层级排列和路由实现；第 83 条仍是 Baseline 唯一文字修订。

## 结论

静态审计继续检查两份 Baseline 与两份 Audit 逐字一致、46 章和条款 1–500 连续。新增层级测试与真实 Chromium pointer 流程覆盖障碍节点、多父 DAG、共同父/共同子主干、结构线路上限、无关位置稳定和失败原子回滚。未发现新的源码或自动化冲突；依赖 Windows Firefox/生产 ChatGPT 的项目继续保留为人工待验。

## 46 章逐章复核

| 章 | 主题 | 1.4.4 结果 | 主要证据 |
|---:|---|---|---|
| 1 | 产品定位 | 自动/源码通过 | 无网络、AI 自动归类或旧命名空间 |
| 2 | 名称与 Firefox 工具栏 | 自动/源码通过；Firefox 待验 | per-tab background、close/reopen |
| 3 | 侧栏显示与关闭 | 自动/源码通过；Firefox 待验 | toolbar-only、fullClose 清理 |
| 4 | ChatGPT 页面空间关系 | Chromium 通过；生产页待验 | fixed/100vw、composer 让位 |
| 5 | 侧栏总体布局 | 自动/源码通过 | 尺寸常量、初始中心 |
| 6 | 固定工具区 | 自动/源码通过 | 工具栏、三色、解除、zoom |
| 7 | 画布硬性无重叠 | 自动通过 | schema、geometry、router |
| 8 | 手工层级网络 | 自动通过；Firefox 手感待验 | tree/DAG、障碍换位、结构线路、多父规则 |
| 9 | 删除和解除层级 | 自动通过 | 独有线/共享主干、解除测试 |
| 10 | 节点删除 | 自动通过 | 关系清理、批量、undo |
| 11 | 折叠与展开 | 自动/源码通过 | 多父限制、隐藏节点排除 |
| 12 | 正文创建节点 | Chromium 通过；生产 DOM 待验 | Range、跨消息、控件过滤 |
| 13 | 连续摘录 | Chromium 通过；生产 DOM 待验 | continuous、Ctrl、Shift |
| 14 | 自由节点 | 自动通过 | 创建、编辑、拖动、删除 |
| 15 | 新节点自动排列 | 自动/源码通过 | autoGroup 与关系层级排列隔离 |
| 16 | 新节点空间不足 | 自动通过 | 最近合法组位置、原子失败 |
| 17 | 有限画布 | 自动通过 | 世界边界、zoom、极宽树转向 |
| 18 | 节点显示和编辑 | 自动通过；字体待验 | 高度、宽度、编辑 |
| 19 | 拖动后冲突顺序 | 自动通过；Firefox 待验 | 普通拖动局部求解、关系整体换位、回滚 |
| 20 | 点击与选择 | Chromium 通过 | 阈值、Ctrl/Shift、单选收敛 |
| 21 | 框选与平移 | Chromium/源码通过 | 手势隔离、正文不滚动 |
| 22 | 画布/备忘录选择互斥 | Chromium 通过 | 双向选择断言 |
| 23 | 画布批量操作 | 自动通过 | 批量关系、同层、原子性、undo |
| 24 | 正文锚点和双向定位 | Chromium 通过；生产 DOM 待验 | 索引、定位、回退 |
| 25 | 缩放与视图 | 自动/源码通过 | 范围、中心、保存 |
| 26 | 备忘录基本行为 | Chromium 通过 | 命中反馈、转换无副本 |
| 27 | 单条拖回画布 | Chromium 通过 | HTML5 DnD、合法落点 |
| 28 | 多条拖回画布 | Chromium 通过 | 视觉顺序、原子性、undo |
| 29 | 备忘录标题 | Chromium/源码通过 | 分组徽标、容器、折叠排序 |
| 30 | 备忘录批量选择 | 自动/源码通过 | 互斥选择、批量 mutate |
| 31 | 删除备忘录条目 | 自动通过 | 真删除、批量、undo |
| 32 | 颜色系统 | Chromium 通过 | 三槽、实体与高亮 RGB |
| 33 | 搜索 | 自动/源码通过 | 本对话子串、定位展开 |
| 34 | 撤回与重做 | 自动通过 | 15 步、批量单步 |
| 35 | 休眠 | 源码通过；10 分钟待验 | timer/observer 暂停 |
| 36 | ChatGPT 分支 | 自动/源码通过；真实分支待验 | fingerprint、可定位实体复制 |
| 37 | 导入导出 | 自动通过；Firefox UI 待验 | 1.3 导出、1.3/1.4 严格导入 |
| 38 | 隐私窗口 | 源码通过；Firefox private 待验 | manifest spanning |
| 39 | 恢复和多标签 | 自动/源码通过；实机待验 | revision conflict、错误保留 |
| 40 | 页面变化保护 | 自动/源码通过；生产 DOM 待验 | 导航监听、无效数据只读 |
| 41 | 性能和稳定性 | 自动通过；Firefox 体感待验 | 建关系耗时、增量 SVG、500 节点压力 |
| 42 | 快捷操作总表 | 自动/源码通过 | Ctrl/Escape、editable 原生行为 |
| 43 | 连续摘录快捷规则 | Chromium/静态通过 | ordinary/Ctrl/Shift、无 Alt |
| 44 | 取消的旧需求 | 自动通过 | 禁用 token、无网络、旧 namespace |
| 45 | 功能优先级 | 自动/源码通过 | 硬规则优先、无解回滚 |
| 46 | Baseline 1.3 冻结原则 | 自动通过 | 46 章、1–500、仅第 83 条修订 |

## 人工验收文档逐组复核

| 组 | 对应内容 | 当前证据 | 目标实机边界 |
|---|---|---|---|
| 0 | 用户问题回归 | complex hierarchy/browser 自动通过 | Firefox 生产页最终确认 |
| A | 工具栏生命周期 | close/reopen 与清理通过 | Firefox 图标、刷新、重启 |
| B | 页面空间和尺寸 | 困难 mock 通过 | 生产页、窄窗 overlay |
| C | 正文与连续摘录 | Range/跨消息/Ctrl/Shift 通过 | 生产消息 DOM |
| D | 节点显示编辑移动 | pointer/selection/height 通过 | Firefox 字体和长文本 |
| E | 框选平移缩放 | 滚动隔离和边界通过 | Firefox wheel/pointer 手感 |
| F | 多父与关系路由 | 多父分层、障碍换位、四点线路、无回退通过 | 用户真实笔记视觉抽检 |
| G | 删除折叠与排列 | core/browser/hierarchy 通过 | 长交互序列 |
| H | 备忘录与标题 | 单/多 DnD、扩大命中、分组视觉通过 | Firefox DnD 手感 |
| I | 三色和高亮 | 三槽与 RGB 对应通过 | 生产正文 rect |
| J | 搜索和双向定位 | anchor/browser/source 通过 | 生产 DOM 再生成 |
| K | Undo/Redo | core/browser 通过 | 16 步手工序列 |
| L | 休眠 | 源码通过 | 约 10 分钟实测 |
| M | ChatGPT 分支 | fingerprint/clone 通过 | 真实 Branch in new chat |
| N | 导入导出和数据安全 | schema/router/冲突保护通过 | Firefox 文件 UI |
| O | 隐私多标签恢复 | revision/source 通过 | private、stale tab、重启 |
| P | 页面变化保护 | mock 导航与只读保护通过 | 生产流式生成 |
| Q | 500 节点性能 | 压力、增量线路、候选位置上限通过 | Firefox 主观手感 |
| R | 发布前检查 | 46/500、禁用项与全套自动测试 | Firefox 控制台及待验项 |

## 最终判定

1.4.4 可作为修订 Baseline 1.3 的新候选版本；人工项目未执行前不标记为实机通过。

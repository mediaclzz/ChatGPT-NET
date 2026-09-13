# ChatGPT NET 1.4.2 发布说明

**发布日期：** 2026-08-09

**功能基线：** 经第 83 条单项修订的 ChatGPT NET Functional Baseline 1.3

**数据格式：** schema 1；新导出标记 Baseline 1.3；兼容导入 1.3/1.4

1.4.2 撤销了 1.4.1 偏离手工自由画布语义的整组件自动分层布局。节点仍由用户自由整理；建立关系只调整被拖节点，并仅在确实无解时尝试少量直接相关节点。

## 本轮修正

- 关系路由先保留全部仍合法的旧线路，只计算新增或因节点实际移动而失效的线路；无关自由节点移动不再触发全图寻路。
- SVG 关系线按 relation id 增量复用；坐标不变时不替换 polyline，也不重复写 `points`。
- 常见同侧父子关系使用组织结构图式的少折线正交路径；同一父节点的同侧子节点从父边缘共用一段主干后再分支。障碍场景才进入有预算的 A* 回退。
- 取消 1.4.1 的独立端口分配和整连通分量重排；恢复 Baseline 1.3 第 89～93、204～206 条规定的局部处理顺序。
- 画布 pointer/wheel 事件完整阻止向 ChatGPT 页面冒泡；普通画布操作不再带动正文滚动。页面让位只在挂载、切换画布或调整侧栏宽度时更新，不再在每次 render 中重写页面布局。
- 画布拖入备忘录的命中区扩展到分隔线附近和整个 memo 区；进入时显示整区虚线提示与高层 ghost，并暂停画布边缘自动平移。
- 分组备忘录新增“分组”徽标、左侧色条、浅色容器和条目缩进，与未分组条目形成明确视觉层次。
- 修订 Functional Baseline 1.3 第 83 条：同一子节点的多个父节点可以无关或处于共同祖先下的平级分支，但父节点之间不得存在直接或间接祖先/后代关系。无论是添加第二父节点，还是后来试图连接既有共同父节点，都会原子拒绝并给出专用提示。
- schema 同步拒绝违反上述多父独立性规则的导入/持久化数据。

## 参考设计的采用范围

本轮只借鉴与本项目规则一致的连接与拖动思想，不引入外部项目的单父树模型、自动内容推断、全图自动布局或编辑器框架：

- [wanglin2/mind-map OrganizationStructure](https://github.com/wanglin2/mind-map/blob/e8e5ef9c41bc13ca7b13084e078123adff002242/simple-mind-map/src/layouts/OrganizationStructure.js)：父节点短主干、横向总线、子节点分支的组织结构图连接方式。
- [wanglin2/mind-map Drag](https://github.com/wanglin2/mind-map/blob/e8e5ef9c41bc13ca7b13084e078123adff002242/simple-mind-map/src/plugins/Drag.js)：拖动阈值、默认事件抑制和目标反馈。
- [KityMinder L connector](https://github.com/fex-team/kityminder-core/blob/7aabc8d7fc115d31e6f1616fae8c4d8b8d167ee3/src/connect/l.js) 与 [poly connector](https://github.com/fex-team/kityminder-core/blob/7aabc8d7fc115d31e6f1616fae8c4d8b8d167ee3/src/connect/poly.js)：根据相对方向选择少拐点折线。
- [Graphviz `splines=ortho`](https://graphviz.org/docs/attrs/splines/) 与 [`concentrate=true`](https://graphviz.org/docs/attrs/concentrate/)：正交连线和可辨识的边集中思路。

## 验证结果

- `npm test`：覆盖语法、基线静态审计、schema/DAG、共享主干、无关线路稳定性和 500 节点路由压力；最终结果见本版本重新校对记录。
- Chromium 真实浏览器集成：覆盖关系建立、共享主干、SVG 元素复用、无关分量线路稳定、20 次连续 render、正文滚动隔离、扩大 memo 命中区、分组视觉、摘录/高亮、工具栏生命周期与无效数据保护。
- Firefox 隔离测试浏览器的已安装版本与当前自动化驱动不匹配，匹配版下载在本轮环境中超时，因此没有把 Firefox 自动化标记为通过。当前支持边界 Windows Firefox 152+ 与生产 ChatGPT 的最终交互仍须按 `MANUAL_ACCEPTANCE_1.3.md` 实机确认。

## 升级说明

直接在 Firefox `about:debugging` 中重新加载本目录的 `manifest.json`。schema 未升级，现有数据无需迁移；但若旧数据已经包含“共同父节点之间又存在祖先/后代关系”的非法结构，本版本会停止写入并保留原数据，避免静默改写。

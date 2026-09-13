# ChatGPT NET 文档索引

文档按“当前实现”“历史基线”“历史发布”区分。历史文件保留用于追溯，不代表当前版本仍沿用其中所有实现细节。

## 当前 1.5.0 实现依据

- `ChatGPT NET Functional Baseline 1.5.md`：当前唯一产品需求基准，并明确继承未被替换的 1.3 规则。
- `BASELINE_RECHECK_1.5.0.md`：条款 1～116 的逐条实现、自动测试与 Firefox 证据矩阵。
- `MANUAL_ACCEPTANCE_1.5.md`：Windows Firefox 1.5 实机验收清单。
- `RELEASE_NOTES_1.5.0.md`：当前版本改动、资源数据、实机边界与发行包哈希。

## 历史基线与 1.4.6 实现依据

- `ChatGPT NET Functional Baseline 1.3.md`：1.3～1.4.6 的历史正式功能基线。
- `BASELINE_AUDIT_1.3.md`：源码和自动测试逐条审计。
- `MANUAL_ACCEPTANCE_1.3.md`：1.3～1.4.6 历史 Firefox 实机验收清单；未被 1.5 替换的项目继续作为回归参考。
- `BASELINE_RECHECK_1.4.6.md`：1.4.6 对完整章节和验收组的复核。
- `RELEASE_NOTES_1.4.6.md`：当前版本改动与验证证据。

## 历史发布记录

- `BASELINE_RECHECK_1.4.0.md`～`BASELINE_RECHECK_1.4.6.md`
- `RELEASE_NOTES_1.4.0.md`～`RELEASE_NOTES_1.4.6.md`

这些历史文件由 Git 跟踪并备份到 GitHub，不放入 Firefox 安装包，也不需要在本地复制额外备份。

## 本地目录约定

- `src/`、`background.js`、`manifest.json`、`icons/`：插件运行源码。
- `tests/`、`scripts/`、`package.json`、`package-lock.json`：测试和构建入口。
- `docs/`：需求、验收和发布记录。
- `dist/`：可重新构建的安装包；只在本地临时保留当前版本，Git 忽略。
- `output/`：测试截图、浏览器配置和临时运行时；可删除，Git 忽略。
- `node_modules/`：可由 `npm ci` 恢复的依赖缓存；可删除，Git 忽略。

正式备份依靠 Git 提交、版本标签和 GitHub Release；不把依赖缓存、临时浏览器配置或重复安装包上传到仓库。

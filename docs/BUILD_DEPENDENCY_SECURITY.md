# 构建依赖安全更新 / Build dependency security update

2026-09-13

## 已处理 / Resolved

在 v1.5.0 发布后，将构建工具 web-ext 从 8.10.0 升级并固定到 10.6.0，更新锁文件。扩展运行代码、manifest 和版本号保持 1.5.0。

After publishing v1.5.0, the build tool was upgraded from web-ext 8.10.0 to an exact 10.6.0 pin with a refreshed lockfile. Extension runtime code, manifest and product version remain 1.5.0.

The updated dependency tree includes fast-uri 3.1.7, shell-quote 1.10.0, adm-zip 0.6.1, tmp 0.2.7, js-yaml 4.3.2 and ajv 8.20.0. The vulnerable uuid/node-notifier chain is removed. The static audit now verifies an exact builder version and matching installed version in the lockfile, rather than rejecting every update away from 8.10.0.

## 上游尚无修复版本 / Unpatched upstream advisories

npm audit still reports three high-severity package entries: image-size and its parent chain addons-linter → web-ext. These trace to two image-size advisories, both affecting all currently published versions through 2.0.2:

- https://github.com/advisories/GHSA-w3rx-r6r6-pgpr — malformed ICNS images can cause an infinite loop.
- https://github.com/advisories/GHSA-5p2g-fcmc-qvqq — malformed JXL/HEIF images can cause infinite loops.

当前注册表未提供已修复版本。未隐藏告警，也未采用 npm audit 建议的旧版工具降级。此依赖属于扩展 lint 工具链，不会打入 ZIP/XPI；项目构建仅调用 web-ext build。不要用此版本的 web-ext lint 检查不受信任的图片或扩展包。上游发布修复后，应更新并重新执行完整审计。

No patched registry release is available at verification time. Alerts are not suppressed and the suggested downgrade to an obsolete builder is not applied. This dependency belongs to the extension lint toolchain, is not shipped in ZIP/XPI, and the project build invokes only web-ext build. Do not run this version of web-ext lint against untrusted images or extension packages. Upgrade and rerun the full audit when an upstream fix becomes available.

## 验证 / Verification

Run npm ci, npm test, npm run build and npm audit. The full audit remains nonzero for the documented upstream advisories; passing functional tests does not mean these advisories are fixed.

Verified locally on 2026-09-13: npm ci, npm test, npm run build and native Firefox 152.0.4/geckodriver integration PASS. All 16 files inside the rebuilt archive are byte-identical to the published v1.5.0 archive. npm audit decreased from 13 package entries to 3 high entries for the two unpatched image-size advisories described above.


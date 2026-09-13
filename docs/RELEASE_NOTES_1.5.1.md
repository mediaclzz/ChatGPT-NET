# ChatGPT NET 1.5.1

## 更新内容 / Changes

- 构建工具 web-ext 从 8.10.0 升级并固定到 10.6.0，更新锁文件，处理已发现的可修复开发依赖漏洞。
- Upgrade the pinned web-ext build tool from 8.10.0 to 10.6.0 and refresh its dependency tree to address fixable development dependency advisories.
- 修复阻碍依赖升级的静态版本断言，增加 Windows 扩展构建 CI；Firefox 集成测试自动读取当前版本的 XPI 文件名。
- Fix the hard-coded builder version check, add Windows package-build CI, and derive the Firefox integration-test XPI filename from the manifest version.
- 扩展功能沿用 1.5 基线；运行代码与 1.5.0 一致，仅 manifest 中的产品版本更新为 1.5.1。
- Extension functionality follows the 1.5 baseline. Runtime code is unchanged from 1.5.0; the manifest product version is updated to 1.5.1.

## 安装 / Installation

需要 Firefox 152 或更新版本。下载 ZIP 后，打开 about:debugging#/runtime/this-firefox，选择“临时载入附加组件”，加载 ZIP 或解压后的 manifest.json。

Requires Firefox 152 or newer. Download the ZIP, open about:debugging#/runtime/this-firefox, and use “Load Temporary Add-on” to select the ZIP or the extracted manifest.json.

ZIP/XPI 尚未经 Mozilla 签名，仅供临时加载；重启 Firefox 后需重新加载。请备份重要笔记。

The ZIP/XPI is not Mozilla-signed and is intended for temporary loading; reload it after restarting Firefox and back up important notes.

## 已知限制 / Known limitations

image-size 的两项上游图片解析漏洞尚无已发布的补丁。npm audit 会将其及父依赖链报告为 3 个 high 告警包；该 lint 工具依赖不包含在扩展安装包中。详情参见 [构建依赖安全说明](BUILD_DEPENDENCY_SECURITY.md)。

Two upstream image-size parsing vulnerabilities have no published fix. npm audit reports three high-severity package entries including parent dependencies. This lint-tool dependency is not included in the extension package. See [build dependency security notes](BUILD_DEPENDENCY_SECURITY.md).

License: MIT. Copyright (c) 2026 MedicalZZ.

# v0.7.2 — 修复核心与数据扩展协议对齐

## 修复

- v0.7.1 的核心 `client.js` 发布内容缺少 `sessionGroupsUI` 服务，导致数据扩展安装后无法注册，数据菜单不出现
- v0.7.2 补回 `sessionGroupsUI` 协议和 provider 菜单逻辑
- 核心 Host 继续不提供 `/data`，数据由 `dsh-session-groups-data` 独立提供
- 同步核心 README 的 v0.7.2 版本说明和数据扩展安装说明

## 配套版本

- 核心：`0.7.2`
- 数据扩展：`0.1.1`

## 升级要求

先升级核心到 `0.7.2`，再安装/升级数据扩展到 `0.1.1`，然后完整重启 DSH Host。

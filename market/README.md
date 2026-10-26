# 上架 DSH 社区插件库

DSH 官方仓库的「发现」页默认不带任何索引源；社区插件库由
[awesome-dsh-plugin](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin)
收录，随后同步到 `dsh-market` 和插件市场站点。

## 当前状态

- `package.json` 已声明 `dsh.bundle`，仓库根有 `cordis.patch.yml`
- 仓库真实代码存在，创建时间已超过 1 天
- 已准备 `screenshots.json`，用于市场详情页截图
- 待办：给 GitHub 仓库添加 `dsh-plugin` topic
- 待办：向 awesome-dsh-plugin 提交 PR

## 提交 PR

1. Fork https://github.com/awesome-dsh-plugin/awesome-dsh-plugin
2. 新建文件：

   ```text
   data/plugins/xyzYaeMiko__dsh-session-groups.yml
   ```

   内容复制自本目录的 `awesome-dsh-plugin-entry.yml`。

3. 提 PR，标题建议：

   ```text
   Add xyzYaeMiko/dsh-session-groups
   ```

4. 等待 CI 和人工审核；通过后通常一天内同步到社区市场。

## 上架前检查

- GitHub 仓库添加 topic：`dsh-plugin`
- 确认 `README.md`、`package.json`、`client.js`、`docs/` 已是最新
- 补全 Release `v0.4.1` 的更新说明（见 `release-notes-v0.4.1.md`）
- 可选的 npm 发布：不影响收录；若发布，`repository` 字段需指回本仓库

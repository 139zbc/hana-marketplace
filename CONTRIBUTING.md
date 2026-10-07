# Contributing / 投稿指南

[中文](#中文投稿指南) · [English](#english-guide)

## 中文投稿指南

本仓库是 Hana **Global 市场目录**。PR 用于登记作者的 GitHub 仓库，不用于上传扩展源码或安装包。中国大陆市场独立审核和发布，不会自动同步此处的收录。

支持 `app`、`skill`、`recipe`、`connector`、`role`、`bundle` 六种扩展。新 App 必须使用 manifestVersion 2；v1 是冻结的兼容层，不接受新的市场投稿。

### 1. 准备可安装的发布包

在 Hana 源码仓库中使用官方打包命令。例如：

```bash
npm run pack:extension -- --kind app --dir /path/to/my-app \
  --publisher "Example Author" --out ./dist-extensions
```

将示例路径和发布者换成自己的值。其他扩展使用对应的 `--kind`。App 需要先完成自己的构建，运行入口不能是未编译的 `.ts` 文件。Connector 包不能包含令牌或其他凭据。

保留打包器生成的 **`.entry.json` 和对应 `.zip`**，不要手动改写大小或 SHA-256，也不要用 GitHub 自动生成的源码归档代替安装包。完整的清单和打包要求见 [Hana App 文档](https://github.com/liliMozi/openhanako/blob/main/APPS.md)。

### 2. 在自己的仓库发布正式 Release

在登记的 GitHub 仓库创建正式 Release，并将上述两个文件同时上传为 Release 附件。仓库和附件必须可供市场自动化及用户访问。

- Release 不能是草稿或预发布版本。
- 同步器读取 GitHub 的 **latest 正式 Release**，不是任意最新 tag。请确认 GitHub 选中的 Release 包含要投稿的扩展。
- App、Connector、Role、Bundle 的条目附件名为 `<kind>-<id>-<version>.entry.json`。
- Skill、Recipe 的条目附件名为 `<kind>-<id>.entry.json`，ZIP 使用打包器生成的内容寻址文件名。
- 每个登记项必须能匹配唯一的条目附件，且对应 ZIP 必须属于同一 Release。

如果一个仓库有多条独立发布线，请确保 latest Release 适合已登记的扩展；市场不会猜测发布轨道。

### 3. 提交登记 PR

Fork 本仓库，在 `registry.json` 的 `entries` 数组中追加一条记录，保留现有条目。例如：

```json
{
  "schemaVersion": 1,
  "entries": [
    {
      "kind": "app",
      "id": "example-app",
      "repository": "author/example-app",
      "publisher": "Example Author"
    }
  ]
}
```

这里的 `entries` 仅为示例，不要覆盖真实目录。

- `kind`、`id` 和 `publisher` 必须与打包生成的条目一致。
- `repository` 使用 `owner/repository`，不是完整 URL。
- 除非维护者要求批量变更，一个 PR 只登记一个扩展。
- **不要手工编辑 `index.v2.json`**，也不要为投稿修改同步器或工作流。
- 按 PR 模板说明扩展用途，提供仓库及正式 Release 链接，便于维护者审核。

### 4. 检查、审核与上架

可在市场仓库使用 Node.js 24.15.0 或兼容的 Node 24 运行只读检查，无需安装依赖：

```bash
node scripts/extension-market-sync.mjs --registry registry.json --previous index.v2.json --out index.v2.json --check
```

检查需要联网读取 Release 和附件。可选的只读 `GITHUB_TOKEN` 可提高 GitHub API 限额；不要提交令牌。

PR 检查使用基线分支的同步器读取候选登记文件，不执行投稿代码。检查通过不等于审核通过，也不等于已经上架。维护者审核并合并后，发布工作流校验已登记的 Release，成功更新 `index.v2.json` 后客户端才可发现新条目。

### 5. 后续更新

收录后，在同一仓库发布新的正式 Release，并同时上传新生成的条目和 ZIP 即可，**通常无需再次提 PR**。登记信息（如仓库或发布者）变化时仍需提 PR。

- 工作流配置为每小时发现新版本；主分支变更或手动运行也可触发。实际执行时间取决于 GitHub Actions 调度，不保证整点上架。
- 对有语义化版本的扩展，请发布更高版本；不要降级，也不要用新安装包替换已发布的同一版本。
- Skill / Recipe 按内容哈希更新，条目中的 `0.0.0` 不需要人为递增。
- 自动发现只更新目录，**不会自动替用户安装或更新扩展**。

### 常见失败

| 现象 | 应检查的内容 |
| --- | --- |
| 找不到可用 Release | 是否仍为草稿或预发布；GitHub latest 是否指向预期 Release |
| 找不到条目或 ZIP | 是否同时上传两个打包产物；附件名称和登记身份是否一致 |
| 身份或完整性校验失败 | `kind`、`id`、发布者、大小和 SHA-256 是否与原始打包产物一致 |
| 版本更新被拒绝 | 是否版本倒退，或替换了同一版本的安装包 |
| 已合并但目录没更新 | 查看发布 Actions 是否成功；合并本身不是发布成功的证明 |

发布采用**整批原子更新**：任一登记项不可用或校验失败，整批都不会发布，原索引保持不变。因此检查失败也可能来自另一个已登记条目。根据日志定位具体失败项，修复 Release 或通过 PR 调整登记，再由维护者重跑；不要删除无关条目来绕过检查。

## English guide

This repository is the Hana **Global market catalog**. Enrollment PRs register an author's GitHub repository; they do not upload extension source code or installation packages. The mainland China catalog is reviewed and published independently.

Supported kinds are `app`, `skill`, `recipe`, `connector`, `role`, and `bundle`. New Apps must use manifestVersion 2. The frozen v1 compatibility line does not accept new market submissions.

### 1. Package your extension

Use the official packer from a Hana source checkout:

```bash
npm run pack:extension -- --kind app --dir /path/to/my-app \
  --publisher "Example Author" --out ./dist-extensions
```

Replace the path, publisher, and kind as appropriate. Build Apps before packaging; their runtime entry must not be uncompiled TypeScript. Connector packages must not contain tokens or other credentials. See the [Hana App documentation](https://github.com/liliMozi/openhanako/blob/main/APPS_EN.md) for manifest and packaging requirements.

Keep the generated `.entry.json` and matching `.zip` together. Do not alter their byte count or SHA-256 metadata, or substitute GitHub's automatically generated source archives.

### 2. Publish a stable GitHub Release

Upload both generated files as assets of a stable Release in the repository you will register. The repository and assets must be accessible to market automation and users. Drafts and prereleases are not eligible.

The synchronizer selects GitHub's **latest stable Release**, not an arbitrary newest tag. Ensure that release contains the intended extension, especially if the repository has multiple independent release tracks.

- Apps, connectors, roles, and bundles: `<kind>-<id>-<version>.entry.json`.
- Skills and recipes: `<kind>-<id>.entry.json`, with the packer-generated content-addressed ZIP filename.
- Each enrollment must match exactly one entry asset. Its ZIP must belong to the same Release.

### 3. Open an enrollment PR

Fork this repository and append one record to the `entries` array in `registry.json`, preserving existing records. Example record:

```json
{
  "kind": "app",
  "id": "example-app",
  "repository": "author/example-app",
  "publisher": "Example Author"
}
```

The registry keeps `schemaVersion: 1`. The kind, id, and publisher must match the packer output. Use `owner/repository`, not a full URL. Submit one enrollment per PR unless maintainers request a batch.

Follow the PR template, explain the extension's purpose, and link its repository and stable Release. **Do not edit `index.v2.json` manually** or change the synchronizer or workflows as part of an enrollment.

### 4. Validate and wait for review

With Node.js 24.15.0 or a compatible Node 24 release, run this read-only check from the market repository. No dependency installation is required:

```bash
node scripts/extension-market-sync.mjs --registry registry.json --previous index.v2.json --out index.v2.json --check
```

The check needs network access to releases and assets. An optional read-only `GITHUB_TOKEN` raises the API rate limit; never commit it.

PR validation uses the base branch's synchronizer and does not execute submitted code. Passing checks does not replace maintainer review. After approval and merge, a successful publishing workflow must update `index.v2.json` before clients can discover the extension.

### 5. Publish updates

Publish a new stable Release in the same repository with both newly generated assets. Normal releases **do not require another enrollment PR**. Changes to registration details, such as repository or publisher, do.

Discovery is scheduled hourly and can also run on main-branch changes or a manual trigger. GitHub Actions scheduling may delay execution. Versioned extensions must not downgrade or replace an existing version's archive. Skills and recipes update by content hash and retain `0.0.0` in their entry metadata. Discovery never installs updates automatically for users.

### Troubleshooting

Check the selected latest Release, stable status, asset names, matching identity and publisher, byte count, SHA-256, and version progression. A merged PR is not proof of a successful publication; inspect publishing Actions when an entry does not appear.

Publication is **atomic across the entire batch**. Any unavailable or invalid enrollment blocks the new index, leaving the previous index unchanged. A failure may therefore belong to another enrolled extension. Identify the failing record in the logs, fix its Release or request a reviewed registry correction, then ask a maintainer to rerun publication. Do not remove unrelated entries to bypass validation.

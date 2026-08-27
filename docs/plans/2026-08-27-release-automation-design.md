# README 与发布自动化设计

## 目标

将 `@jxi/comparison-table` 作为可独立发布的 npm 库维护，并让贡献者可在本地安全地验证、演练和手动发布；同时由 GitHub Actions 持续验证代码，并在明确授权的发布事件中通过 npm Trusted Publishing 自动发布。

## 方案选择

采用“本地手动流程 + GitHub Release/手动触发自动流程”。不采用推送 tag 即发布，避免首次接入或日常 tag 操作误发版本。

## 文档

- 根目录 `README.md` 说明 monorepo 结构、安装、最小使用示例、开发命令、发布路径和 npm Trusted Publishing 配置步骤。
- `packages/comparison-table/README.md` 面向 npm 使用者，包含安装、样式导入、最小 API 示例和 peer dependencies。
- README 只引用公开包入口和 CSS 子路径，不依赖 demo 的内部文件。

## 本地脚本

- `release:check` 依次运行格式检查、类型检查、构建、单元测试和库 tarball 检查。
- `release:dry-run` 在完整校验后执行 npm 发布演练，不改变 registry。
- `release:publish` 在完整校验后发布公开 scoped 包；其失败不会覆盖 npm 上已有版本。
- 命令统一通过 pnpm 调用，打包目标仅为 `@jxi/comparison-table`，不包含 `apps/demo`。

## GitHub Actions

- CI 工作流在 push 与 pull request 时执行 `pnpm install --frozen-lockfile` 和 `pnpm run release:check`。
- 发布工作流仅在 GitHub Release 发布或手动 `workflow_dispatch` 时运行。
- 发布工作流拥有 `id-token: write` 与 `contents: read` 权限，并使用 `npm publish --provenance --access public`。它不需要也不读取 `NPM_TOKEN`。
- 手动触发会先验证输入版本与 `packages/comparison-table/package.json` 一致，避免误将错误版本发布出去。
- 配置 npm Trusted Publishing 前，发布工作流会因 npm 认证被拒绝而失败；CI 与本地流程仍可正常使用。

## 可验证边界

- 根脚本：从仓库根运行，必须覆盖 library 与 demo 的 build/test，且 pack 检查仅打包 library。
- 发布脚本：发布演练必须传递 `--dry-run`，真实发布必须传递 provenance 与 public access。
- 工作流：CI 不含发布步骤；发布工作流具备 OIDC 权限、受限触发条件，并执行相同的发布前验证。
- 包文档：示例只使用包的公开 imports，确保使用者可复制。

## 验证

- 为根发布脚本和 YAML 工作流添加面向文件/命令的测试，验证以上可观察契约。
- 运行 `pnpm run format:check`、`pnpm run build`、`pnpm test` 和 `pnpm run pack:check`。

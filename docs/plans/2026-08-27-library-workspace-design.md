# @jxi/comparison-table 工作区库设计

## 目标

将当前 Vite 应用拆分为可独立发布的 React 组件库 `@jxi/comparison-table` 与仅用于展示、示例和页面测试的 demo 应用，消除库代码、测试页面与构建职责的混合。

## 工作区

使用 npm workspaces：

- `packages/comparison-table`：组件、核心逻辑、库样式、库单元测试、打包与发布配置。
- `apps/demo`：Vite 文档/交互页面、示例模块与页面测试，通过 `workspace:*` 依赖库。
- 根目录：共享 TypeScript、Vitest、Prettier 与工作区脚本。

## 发布包

库包名称为 `@jxi/comparison-table`，产物为 ESM、CJS、类型声明和 CSS。`react`、`react-dom`、`antd`、`@ant-design/icons` 作为 peer dependencies，避免消费者出现重复 React/AntD 实例。包的 exports 提供主入口和 `./styles.css`。

库采用 tsup，不使用 Vite 作为库构建工具。发布前运行 build、库测试和 `npm pack --dry-run`；Changesets 管理版本，GitHub Actions 的 CI 只验证，发布工作流需在仓库设置 `NPM_TOKEN` 后才可向 npm 发布。

## 测试边界

库测试覆盖核心比较逻辑和 `RecursiveComparisonTable` 的公开行为。demo 测试只覆盖示例页面、示例排列和库在真实页面中的集成。打包检查验证发布 tarball 中只包含必要产物与元数据。


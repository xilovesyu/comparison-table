# API 文档与静态截图设计

## 目标

让 `@jxi/comparison-table` 的 GitHub README、npm 包页和 IDE 都能清楚展示组件能力、Props、配置类型、渲染器扩展和发布流程。

## 文档结构

- 根 `README.md` 保持快速上手，补充功能概览、截图和到包 API 文档的入口。
- `packages/comparison-table/README.md` 是 npm 包页面，包含完整组件 Props 表、关键类型、内置 renderers 和可复制的完整配置示例。
- GitHub 专属扩展说明放在 `docs/`，避免 npm 使用者被 monorepo 维护细节干扰。

## JSDoc

只为公开 API 添加简洁、可被 TypeScript IDE 读取的 JSDoc：

- `RecursiveComparisonTable` 与每个公开 Props。
- 数据版本、字段选择、显示规则、Diff、搜索、renderer 的类型与回调上下文。
- `buildComparisonRows`、过滤函数、`RendererRegistry`、内置 registry 和合并工厂。

内部递归辅助函数不额外堆叠注释。

## 静态截图

截图存放于 `docs/images/`，从 demo 的实际界面生成并纳入版本控制：

1. 基础递归对比。
2. Diff 与基准列。
3. 综合高级配置。

根 README 使用相对路径嵌入这些文件，因此在 GitHub 与 npm 包页都可稳定渲染。

## 测试边界

文档契约测试通过仓库公开文件验证：

- 两份 README 引用的图片文件真实存在。
- npm README 覆盖 `RecursiveComparisonTableProps` 的每一个公开字段。
- 文档只使用库公开入口与样式子路径。

不会测试 Markdown 渲染器、GitHub 页面或截图像素。

## 验证

运行格式检查、构建、全部测试和打包检查；文档截图由本地 demo 生成，作为可审阅的静态资产。

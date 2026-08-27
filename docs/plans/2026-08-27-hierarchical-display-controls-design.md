# 层级显示控制设计

## 目标

保留现有全局 Diff 与全局搜索 API，同时支持按字段和子树控制 Diff 标签、节点搜索按钮与 Base 标签的可见性。

## API

`differenceIndicator` 扩展为 `true | false | renderer`：`true` 使用默认 Diff，`false` 隐藏，函数自定义内容。顶层比较配置继续作为默认值，`DisplayRule` 和 `PropertyDefinition` 可针对一行覆盖。

新增 `nodeSearchable?: boolean`。它独立于现有 `searchable`：后者控制全局搜索框，前者控制每个可展开节点旁的子树搜索按钮。二者都可保持原有默认行为。

新增 `comparison.showBaselineBadge?: boolean`，默认显示 Base 标签；设为 `false` 只隐藏标签，不影响基准列高亮或自定义 className。

## 继承与优先级

每行的有效显示设置按以下顺序合并：全局默认、父级有效值、匹配的 `DisplayRule`、当前 `PropertyDefinition`。后者优先，因此子级可用 `true` 显式重新开启父级关闭的能力。

## 示例与验证

新增“显示控制与层级继承”示例，放在综合高级配置之前；综合示例也显式包含相关配置。组件 UI 测试覆盖继承、子级覆写、Base 隐藏和节点搜索按钮，文档示例测试覆盖新增示例顺序与集成。

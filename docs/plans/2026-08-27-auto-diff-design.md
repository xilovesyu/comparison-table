# 自动 Diff 设计

## 配置

新增 `comparison` 配置：

```ts
comparison?: {
  onlyDifferences?: boolean;
  baseVersionId?: string;
  comparator?: (values, context) => boolean;
}
```

`comparator` 返回 `true` 表示该属性存在差异，并优先于默认深度比较和基准版比较。

## 核心行为

每个 `ComparisonRow` 带有 `hasDifference`。默认比较所有版本的原始值；指定 `baseVersionId` 后，每个值与该版本比较。深度相等用于对象和数组，日期按时间戳比较，`null`、`undefined` 和 `NaN` 均有明确语义。

`filterDifferenceRows` 保留直接差异行和含差异后代的父行，移除没有差异的叶子及整棵相同子树。

## UI

表格在搜索栏旁提供“仅显示差异”开关和差异行计数。开启时与搜索、节点搜索共同筛选。差异行附带轻量样式和可访问文本标识。

## 示例与测试

增加自动 Diff 示例，覆盖默认比较、基准版本与容差 comparator。测试公共核心 API 的比较和筛选行为，以及 UI 开关、差异标识与示例存在性。

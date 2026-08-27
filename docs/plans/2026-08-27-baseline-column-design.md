# 基准列高亮设计

`comparison.baseVersionId` 存在且匹配某个版本时，组件为该列的表头和单元格添加默认 class：`comparison-baseline-header` 与 `comparison-baseline-cell`。未配置基准版本时不添加任何基准列样式。

`baselineHeaderClassName` 和 `baselineCellClassName` 是可选参数；提供后分别替换默认 class，支持业务 CSS 主题覆盖。

新增“基准列高亮”示例，置于“综合高级配置”之前；综合案例同步配置默认基准列高亮。测试覆盖默认 class、自定义 class 与未配置时不出现样式。

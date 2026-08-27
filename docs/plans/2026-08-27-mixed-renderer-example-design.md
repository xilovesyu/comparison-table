# 混合 Renderer 示例设计

## 目标

调整示例顺序，并让“综合高级配置”真实使用局部 renderer，同时保留部分内置金额格式。

## 展示规则

1. “局部 Renderer Registry”移动到“综合高级配置”之前。
2. 综合案例定义局部 `localMoney` renderer，并将 `billing.money` 指向它，显示业务定制的本地金额文本。
3. `billing.summaryMoney` 仍使用内置 `money` renderer，显示标准货币格式。
4. 综合案例源码展示两个 renderer 名称的路径规则，说明局部自定义与内置 renderer 能混用。

## 测试

通过文档页的 DOM 顺序验证独立 Registry 案例位于综合案例之前；验证综合案例同时显示局部金额文本与内置 `$` 金额格式。

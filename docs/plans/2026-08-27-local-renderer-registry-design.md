# 局部 Renderer Registry 设计

## 目标

允许每个 `RecursiveComparisonTable` 实例增加 renderer 或覆盖同名内置 renderer，且绝不修改共享的 `builtInRenderers`。

## API

`renderers` 支持 `RendererRegistry` 与普通对象两种输入：

```tsx
<RecursiveComparisonTable
  renderers={{ statusBadge: renderStatus, money: renderCompactMoney }}
/>
```

`RendererRegistry` 保留链式注册与复用能力。对象键映射到 renderer 名称。

## 合并规则

组件为每次传入的自定义配置构造局部 registry：它先复制内置 registry，再注册局部 entries。因此，局部同名 entry 只覆盖当前表格实例；未覆盖的内置 renderer 仍可用；其他表格和 `builtInRenderers` 不受影响。

## 测试

1. registry 合并可以追加自定义 renderer，并覆盖复制体的内置项，原始内置 registry 不变。
2. 表格使用对象形式局部 renderer 时可显示新增 renderer。
3. 表格局部覆盖 `money` 后，另一张默认表仍使用内置金额 renderer。
4. 文档页加入一个可查看源码的 renderer-registry 示例。

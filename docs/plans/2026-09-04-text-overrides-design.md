# Comparison Table 文案覆盖设计

## 状态

Issue #18 的架构已批准。本文冻结实现 seam 与兼容边界；当前提交只记录设计，不包含生产代码、Demo 或测试改动。

## 目标

- 让每个 `RecursiveComparisonTable` 实例通过一个 `texts` 配置局部覆盖组件自身拥有的可见、状态和无障碍文案。
- 未配置 `texts` 时，当前默认文案、DOM 语义、交互和回调时机保持不变。
- 静态文案使用 `string`，动态文案使用只接收文档化语义参数并返回 `string` 的 formatter。
- 所有缺省值与运行时校验集中在一个 resolver module 中，避免组件继续散落硬编码文案。

## 非目标

- 不翻译或改写 `versions[].label`、`PropertyDefinition.label`、`DisplayRule.label`、原始数据值、renderer 输出或 mergeEditor 输出。
- 不提供内置语言包、locale code、ICU、全局 Provider 或第三方 i18n 绑定。
- 不控制 Ant Design 自己产生的内部 locale；该部分继续由宿主的 `ConfigProvider` 负责。
- 不改变 comparison rows、搜索和差异计算、merge planner、`mergedData`、`resolvedPatch`、source/edit state 或公开回调语义。
- `texts` 不接受 `ReactNode`，也不检查、序列化或解析 renderer/mergeEditor 的 `ReactNode`。

## 公开 interface

`RecursiveComparisonTableProps` 新增：

```ts
readonly texts?: ComparisonTableTextOverrides;
```

公开导出两个集中类型：

```ts
export interface ComparisonTableTexts {
  // 表格与差异
  readonly tableRegionLabel: string;
  readonly propertyColumn: string;
  readonly baselineBadge: string;
  readonly baselineBadgeAriaLabel: string;
  readonly differenceIndicator: string;
  readonly differenceIndicatorAriaLabel: string;

  // 全局与节点搜索
  readonly globalSearchLabel: string;
  readonly globalSearchPlaceholder: string;
  readonly onlyDifferencesLabel: string;
  readonly onlyDifferencesCount: (context: Readonly<{ count: number }>) => string;
  readonly nodeSearchLabel: (
    context: Readonly<{ propertyLabel: string; path: PropertyPath }>,
  ) => string;
  readonly nodeFilterLabel: (
    context: Readonly<{ propertyLabel: string; path: PropertyPath }>,
  ) => string;
  readonly nodeFilterPlaceholder: (
    context: Readonly<{ propertyLabel: string; path: PropertyPath }>,
  ) => string;

  // Final merge
  readonly finalColumn: string;
  readonly sourceChoiceLabel: (
    context: Readonly<{ path: PropertyPath; versionLabel: string }>,
  ) => string;
  readonly presenceGroupLabel: (context: Readonly<{ path: PropertyPath }>) => string;
  readonly includeFromLabel: (
    context: Readonly<{ path: PropertyPath; versionLabel: string }>,
  ) => string;
  readonly includeFromText: (context: Readonly<{ versionLabel: string }>) => string;
  readonly excludeLabel: (context: Readonly<{ path: PropertyPath }>) => string;
  readonly excludeText: string;
  readonly clearResolutionLabel: (context: Readonly<{ path: PropertyPath }>) => string;
  readonly clearResolutionText: string;
  readonly clearEditLabel: (context: Readonly<{ path: PropertyPath }>) => string;
  readonly clearEditText: string;
  readonly editValueLabel: (context: Readonly<{ path: PropertyPath }>) => string;
  readonly setNullLabel: (context: Readonly<{ path: PropertyPath }>) => string;
  readonly setNullText: string;
  readonly deleteValueLabel: (context: Readonly<{ path: PropertyPath }>) => string;
  readonly deleteValueText: string;
  readonly inheritedSourceStatus: (
    context: Readonly<{ path: PropertyPath; sourcePath: string; versionLabel: string }>,
  ) => string;
  readonly needsSelectionStatus: string;
  readonly completeStatus: string;
  readonly unresolvedStatus: string;
  readonly deletedStatus: string;
  readonly addedStatus: string;
  readonly removedStatus: string;
  readonly missingStatus: (
    context: Readonly<{
      path: PropertyPath;
      versionIds: readonly string[];
      versionLabels: readonly string[];
    }>,
  ) => string;
  readonly validationError: (context: Readonly<{ path: PropertyPath; error: string }>) => string;
}

export type ComparisonTableTextOverrides = Partial<ComparisonTableTexts>;
```

最终 inventory 共 38 个键；`*Label` 仅负责 accessible name，六个 `*Text` 键独立负责对应控件的可见文本。

实现前的 UI inventory test 必须核对上述清单覆盖所有由库产生的可见字符串、placeholder、title、`aria-label`、`aria-live` 状态和错误文本。如果同一可见文本与 accessible name 需要独立覆盖，使用独立键，不让调用方从 DOM 文本反推无障碍名称。

## Resolver module

文案解析形成一个私有深 module：

1. `defaultComparisonTableTexts` 是唯一默认字典，逐项复刻当前发布行为。
2. `resolveComparisonTableTexts(overrides)` 只合并 own keys；未覆盖项回退到默认字典。
3. 组件只通过 resolver 返回的访问器读取文案，禁止新增未登记的用户可见硬编码字符串。
4. formatter 只接收该键声明的不可变语义 context。它不接收 row、renderer result、React element 或 planner 内部对象。
5. 每次 formatter 调用后运行时检查返回值。返回非 `string` 时立即抛出包含 text key 的明确错误；不做 `String(...)` 隐式转换，不静默回退。

resolver 位于 presentation seam。`texts` 不传给 `buildComparisonRows`、filter functions、difference calculation、`buildMergeResult` 或其他 comparison/merge planner。这样文案变化只影响展示，不可能改变 raw value、搜索命中、scope、patch、完成状态或回调时机。

formatter identity 变化可以触发展示重算，但不得重置或提交 controlled/uncontrolled source/edit state。文档可建议调用方稳定化频繁创建的 formatter，不把该建议变成功能前置条件。

## 优先级与所有权

Final 列标题严格按以下顺序解析：

```text
merge.finalLabel > texts.finalColumn > defaultComparisonTableTexts.finalColumn
```

其他文本只使用 `texts` 覆盖和默认字典。以下内容始终由调用方拥有，不进入 resolver：

- version、property definition 与 display rule 的 label；
- raw value 及其 renderer/mergeEditor 输出；
- container summary formatter 输出；
- Ant Design 控件内部 locale。

宿主若同时需要本库文案和 AntD locale，应组合使用：

```tsx
<ConfigProvider locale={antdLocale}>
  <RecursiveComparisonTable texts={comparisonTexts} {...props} />
</ConfigProvider>
```

## 兼容与错误语义

- `texts` 完全可选；省略时默认字符串必须与当前 main 的可见和无障碍文案逐字兼容。
- 已有 `merge.finalLabel` 不迁移、不降级，并继续拥有最高优先级。
- merge 关闭时不因 `texts` 渲染任何 Final 控件或状态。
- formatter 抛出的异常原样传播；formatter 返回非字符串则由 resolver fail-fast。两者都不吞掉、不转成数据值。
- 文案覆盖不能进入搜索数据源；搜索继续使用 property label 与 raw version values，不能命中仅存在于 formatter 输出中的文本。

## 验证策略

自动测试按公开 interface 通过，不越过 resolver seam：

1. 默认字典逐项回归当前表格、搜索、Diff、Base、节点搜索以及 Final merge 文案。
2. 静态与动态局部覆盖、未覆盖项回退、长 property/version label 插值。
3. 可见文案与 accessible name 分别覆盖；placeholder、title、`aria-live` 状态和 validation error 均进入 inventory。
4. Final 标题三层优先级，merge enabled/disabled，source/presence/edit/clear/completion 文案。
5. formatter 非字符串和 formatter throw 的明确失败；renderer、mergeEditor 与 raw value 隔离。
6. 文案变化前后 comparison/filter/Diff、controlled/uncontrolled state、callbacks、`sourceDecisions`、`mergedData` 和 `resolvedPatch` 相同。
7. AntD `ConfigProvider` locale 与 `texts` 可以组合，且彼此不越权。

若实现阶段新增 Demo，必须遵守 `AGENTS.md`：示例放在“综合高级配置”之前，将能力同步集成到 Advanced，并同步源码面板和测试。README/JSDoc 需列出完整键、动态 context、回退规则、Final 优先级与 AntD locale 边界；手工验收覆盖默认语言、局部中文覆盖、长动态 label、键盘/读屏名称及 Final merge 状态。

## 实施顺序

1. 先以 test-first 方式冻结公开类型、默认字典、resolver 和 UI inventory。
2. 将表格/搜索/Diff 文案接到 resolver，证明默认行为不变。
3. 接入 Final merge 的 source、presence、edit、validation 和状态文本，保持 planner 无 `texts` 参数。
4. 同步 Demo、Advanced、源码面板、README/JSDoc 与 manual testing。
5. 运行 library、Demo、release contracts、lint、format、build、pack 和 diff checks，并补真实浏览器/辅助技术验收证据。

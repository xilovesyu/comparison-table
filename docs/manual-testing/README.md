# Comparison Table 手工测试平台

此目录是可重复执行的手工测试入口，不引入任何库运行时代码或生产 API。它复用 `apps/demo` 的公开示例；浏览器截图在 `evidence/`，可访问性树快照和一次性浏览器产物不提交。

## 容器摘要

打开“容器摘要”，确认收起的 package 单元格显示“字段数：2”；搜索“字段数”不应返回该行。再打开“综合高级配置”的源码面板，确认其中包含 `containerSummary`。

## 启动与环境

```powershell
pnpm install
pnpm --filter @jxi/comparison-table-demo dev --host 127.0.0.1 --port 4173
```

在 Chrome、Firefox 或 Edge 打开 `http://127.0.0.1:4173/`。本次执行环境为 Windows、Chrome（headless）、1440 x 1000、2026-09-01；Demo 无后端请求。每轮运行前刷新页面，以隔离每张示例卡片的本地状态。

## 数据场景与操作约定

| 场景 | Demo 卡片                     | 关键数据 / 预期                                                                        |
| ---- | ----------------------------- | -------------------------------------------------------------------------------------- |
| S1   | 基础递归对比                  | 三版本对象；`user.address.city` 为 Beijing/Shanghai/Shenzhen；`summaryMoney` 不展开。  |
| S2   | 属性选择与路径覆盖            | `customer.password`、`internal.traceId` 必须不可见。                                   |
| S3   | 受控展开、数组与缺失值        | 按索引数组、`null`、缺失值、后加字段。                                                 |
| S4   | 自定义顺序与扁平层级          | `lines` 容器消失，`lines[0]`、备注、`lines[1]` 顶层排列。                              |
| S5   | Renderer / Registry           | 金额、百分比、日期；局部覆盖不会污染默认表。                                           |
| S6   | Diff / baseline / inheritance | `onlyDifferences`、业务 comparator、Base 与继承的 Diff/搜索设置。                      |
| S7   | 业务键数组对齐                | SKU `P-100` 修改，`P-200` 重排且不变，`P-300` Added，`P-400` Removed。                 |
| S8   | 综合高级配置                  | S2--S7 的组合：受控展开、扁平 keyed array、renderer、Base、源码。                      |
| S9   | 示例目录导航                  | 1440×1000 视口下打开 `#example-keyed-array`；检查五组目录、选中状态、返回/前进及源码。 |
| S10  | GitHub Pages 发布后 smoke     | live root 与 Keyed/Container/Advanced 深链 reload；检查 heading、current、表格与资源。 |
| S11  | Performance Lab               | 固定 seed 的空、深、宽、长文本与 keyed 数据；生产 Vite host 记录环境、bundle 与 R-7。  |
| S12  | Final 最终版本合并            | 默认关闭；controlled/uncontrolled source 与 edits、keyed presence 及 raw 结果。        |

## GitHub Pages 发布后验证

Pages 验证只针对已部署的 HTTPS 地址，不以本地 Vite 服务代替。每次 `main` 部署由
`.github/workflows/pages.yml` 自动执行 Chromium Playwright smoke；检查 root、
`#example-keyed-array`、`#example-container-summary` 和 `#example-advanced-configuration` 的 reload、
H2、`aria-current`、`Recursive comparison table`、静态资源、console 与 page error。失败时保留
screenshot、trace 和 video。

首次启用、证据留存与 rollback 步骤见 [Pages deployment guide](../pages-deployment.md)。该远端流程
不计入下方已经执行的 22 个本地正式用例，也不能通过本地运行触发真实部署。

## 已执行正式用例

结果定义：通过 = 实际与预期一致；阻塞 = 无法执行且非产品失败。本轮共 22 个正式用例：22 通过、0 失败、0 阻塞；其中 MT-18 通过但产生文档 Finding。

| ID    | 目标、前置与步骤                                                                                      | 预期                                                                                                                      | 实际 / 结果                                                                                                                                                                | 证据                                                       |
| ----- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| MT-01 | S1；加载基础卡片。                                                                                    | 三个版本列、对象递归、Diff 与不同/相同叶子均可见。                                                                        | 草稿/审核版/最终版；city、age 为 Diff，country 不为 Diff。通过。                                                                                                           | `basic-global-filter.png`                                  |
| MT-02 | S1；点“用户信息”的展开图标，再恢复。                                                                  | 子行隐藏/恢复，图标和读屏名称切换 Expand/Collapse row。                                                                   | 行可折叠恢复；ARIA 快照为预期名称。通过。                                                                                                                                  | 浏览器 ARIA 快照（本次会话）                               |
| MT-03 | S1；在全局搜索输入 `Shenzhen`，清空。                                                                 | 保留匹配 city 和必要父级；清空后恢复。                                                                                    | 仅用户信息 > address > city 留下，清空后恢复。通过。                                                                                                                       | `basic-global-filter.png`                                  |
| MT-04 | S1；点“Search within 用户信息”，输入 `Shanghai`，清空。                                               | 仅该子树筛选，不影响同表其他顶层节点。                                                                                    | 子树只保留 address/city；金额等仍可见。通过。                                                                                                                              | `basic-subtree-filter.png`                                 |
| MT-05 | S2；检查客户资料与 status。                                                                           | include 生效，password/internal 排除优先。                                                                                | name、email、status 可见；password/internal 不可见。通过。                                                                                                                 | Demo 与 `apps/demo/src/App.test.tsx`                       |
| MT-06 | S3；在 `lines[0]` 点 Expand row。                                                                     | 受控回调更新后显示 sku 与 quantity；null、缺失、后加字段仍明确展示。                                                      | 展开后有 A-1/quantity；`null`、`—`、introducedLater 可见。通过。                                                                                                           | `controlled-expansion.png`                                 |
| MT-07 | S4；检查顶层顺序。                                                                                    | 不显示 `lines` 父级，顺序为 lines[0]、备注、lines[1]。                                                                    | 与预期一致。通过。                                                                                                                                                         | `apps/demo/src/App.test.tsx`                               |
| MT-08 | S5；比较两张 Registry 表。                                                                            | 自定义 status/money 仅作用第一张表，第二张仍是内置 money。                                                                | 第一张显示“状态标记”“本地金额”，第二张 `$1,250.00`。通过。                                                                                                                 | Demo 与组件测试                                            |
| MT-09 | S6 Diff；检查仅差异初始状态。                                                                         | stable 被隐藏，保留 product 父级和 price/name 差异；price 103 对 baseline 100 被 comparator 视为相同。                    | stable 不显示；price 仍显示是因为 final 135 超阈值。通过。                                                                                                                 | `keyboard-diff-toggle.png`                                 |
| MT-10 | S6 Diff；聚焦 Only show differences，按 Space。                                                       | 开关可键盘操作，切换后显示 stable。                                                                                       | switch 已 checked，stable 出现。通过。                                                                                                                                     | `keyboard-diff-toggle.png`                                 |
| MT-11 | S6 baseline；检查基准版。                                                                             | Base 标签和表头/单元格基准样式存在；继承示例可独立隐藏 Base。                                                             | Base 与高亮存在；显示控制卡没有 Base 且仍高亮。通过。                                                                                                                      | Demo、ARIA 快照                                            |
| MT-12 | S6 inheritance；检查资料分组和联系信息。                                                              | 父级没有 Diff/子树搜索；子级明确重新开启两者。                                                                            | 资料分组无控件，联系信息同时有 Diff 和 Search。通过。                                                                                                                      | Demo 与组件测试                                            |
| MT-13 | S7；检查重排、修改、新增、删除。                                                                      | P-200 无 Diff；P-100 quantity Diff；P-300 Added；P-400 Removed。                                                          | 四项均与预期一致。通过。                                                                                                                                                   | `keyed-array.png`                                          |
| MT-14 | S7 / 核心测试；执行重复、缺失、空白 SKU 及隐藏/折叠数组。                                             | 每种非法业务键抛出含 path/version/field/value-or-index 的错误，不能被展示配置绕过。                                       | 单测均通过。通过。                                                                                                                                                         | `packages/comparison-table/src/core/comparison.test.ts`    |
| MT-15 | S7 / 组件测试；三版本 middle 缺失、最后回归。                                                         | presence 保留，不能误标 Removed；稳定 key 支持受控展开。                                                                  | 单测断言通过。通过。                                                                                                                                                       | `RecursiveComparisonTable.test.tsx`                        |
| MT-16 | S8；打开综合卡，检查 S2--S7 组合。                                                                    | secret/internal 排除；SKU keyed 扁平；Base、Diff、局部/内置金额、null/新增字段均可见。                                    | 全部可见且符合预期。通过。                                                                                                                                                 | `advanced-source.png`                                      |
| MT-17 | S8；点“查看源代码”，检查源码面板。                                                                    | 打开后有复制按钮，源码含 definitions、key field、baseline、JSX。                                                          | 面板和复制按钮可见，关键配置文本完整。通过。                                                                                                                               | `advanced-source.png`                                      |
| MT-18 | 可发现性；对照 README 的 BuildComparisonConfig 表、公开 types 与 S7。                                 | README 的“complete Props and configuration reference”应列出业务键数组配置及约束。                                         | `arrayItemKeyFields` 已公开并被 Demo 使用，但两个 README 均未提及。功能不受影响，记录 FND-001。通过（发现）。                                                              | FND-001                                                    |
| MT-19 | 按 S11 运行 `pnpm run perf:lab`；保留 seed、manifest、environment、bundle、每场景样本和 artifact。    | 私有 production Vite host 以真实 Chromium/ARIA 表执行 two-RAF；warmup 2 不入样，recorded 7 生成有限 R-7。                 | 固定 v1 catalog 覆盖空对象、1000 宽度、10k 长文本、depth 20 与 keyed 1024；JSON 可按环境复现且不进入 Demo/Pages/npm。通过。                                                | `.performance-lab/results/performance-lab.v1.json`（临时） |
| MT-20 | Chromium 以 1440×1000 打开 `#example-keyed-array`；核对五组目录、当前项、展开表与源码后刷新截图。     | 当前项清晰，只有已访问示例挂载；README render 使用更新后的 `docs/images/demo-navigation.png`。                            | 五组、当前项、展开表及源码入口均可见；真实 Chromium 截图覆盖 README。通过。                                                                                                | `demo-navigation.png`                                      |
| MT-21 | S12；打开 Final 最终版本合并，验证默认关闭及 controlled/uncontrolled 模式、Clear 与键盘原生单选。     | keyed presence 先选 Include/Exclude；non-keyed array 作为整体 atomic 选择；复合 composite key 先物化为 canonical string。 | U1：JSON-like 与 Date 保持 deep 深度独立，不可 clone 的 function/symbol 明确失败。U2：`onComplete` 仅用户 incomplete→complete 后触发，mount 不触发。通过。                 | Demo、组件与 core merge 测试                               |
| MT-22 | S12；在 Final 与 Advanced 验证 Ant Design source controls、primitive raw edit 与 custom mergeEditor。 | object/keyed array/item container source inherit；child override 后 Clear 回退；keyed presence 仍先 Include/Exclude。     | controlled 与 uncontrolled `defaultEdits` 均可操作；`onComplete` 等 value/source 与 edits pair echo。`resolvedPatch` 保持 canonical、stable、non-overlap migration。通过。 | Demo、组件与 core merge 测试                               |

## Findings

### FND-001 — P2 文档：公开的 keyed-array 配置不可发现

- 最小复现：阅读根 README 的 “What it supports” 与包 README 的 `BuildComparisonConfig` 表，然后尝试按业务键对齐数组；`arrayItemKeyFields` 不在 API 表、说明或示例中。
- 预期：既然 `BuildComparisonConfig` 和 Demo 已支持 `arrayItemKeyFields`，README 应说明其 `Record<string, string>` 形态、基于 dot-path 的数组路径、身份字段约束（唯一、存在、非空白）以及 `Added`/`Removed` 语义。
- 实际：唯一出现仅在 TypeScript 源码和 Demo；包 README 对外声称提供 complete reference。
- 环境/证据：Windows + Chrome headless；`packages/comparison-table/src/core/types.ts`、`apps/demo/src/examples/KeyedArrayExample.tsx`、`packages/comparison-table/README.md`。无网络日志，因为是本地 API 文档缺失。
- 影响：消费者难以发现关键能力，且若自行猜测/错误配置，异常约束没有文档指引；不影响已部署表格渲染。
- 建议：补充属性表与一个简短 keyed-array 用例；更新时同步根 README。未修改生产实现。

### 平台噪声 — P3

Chrome 控制台只有 `GET /favicon.ico 404`。不影响 Demo 功能；可在 Demo 补一个 favicon 或忽略该开发服务器噪声。本轮未改动。

## Dogfooding / 探索式观察

- 示例目录按需挂载当前示例；访问过的示例保持挂载并在非活动时隐藏，因此目录切换可保留本地交互状态。
- 建议：`Added` 项的容器单元格显示 `[object Object]`，虽然下钻后 SKU/quantity 清楚，但折叠状态的信息密度和可读性较弱。可考虑数组容器使用 `[ 1 item ]` 或业务键摘要；这不是数据正确性缺陷。
- 建议（性能风险，P3）：生产构建提示 Demo 单一 JavaScript chunk 为 937 kB（gzip 292 kB），超过 Vite 500 kB 警戒线；未发现实际浏览器卡顿，但应在 S9 fixture 后测量并评估按示例懒加载。
- 已验证的可用性：全局/子树输入框、Switch、展开图标具有可访问名称；键盘可操作 Diff 开关；空值显示 `null`、缺失值显示 `—`。未发现浏览器运行时 JavaScript 错误。

## 未覆盖风险与下轮建议

- Demo 没有长文本、大数据量、空数据集或极深嵌套的交互基准；需要独立 performance/accessibility fixture 后，测量首渲染、搜索、展开和横向滚动。
- 本轮 Chromium 手工路径已跑；Firefox/WebKit 兼容性与真实读屏软件（NVDA/VoiceOver）未覆盖。
- 复制源码按钮只验证可达与展示，未验证系统剪贴板权限受限时的反馈；当前实现没有成功/失败提示。
- 非法 keyed identity 使用核心单测而非 Demo，以避免为测试复制产品逻辑；可在未来添加仅开发态的异常演示入口。

## 维护规则

新增 Demo 示例时，遵守仓库 `AGENTS.md`：示例列在综合高级配置之前、能力接入综合案例、源码面板和测试同步更新。新增能力必须补一条对应的 MT 用例和一个可复现证据链接。Performance Lab 是私有工具而非 Demo 示例；操作和证据解释见 [Performance Lab](../performance-lab.md)。

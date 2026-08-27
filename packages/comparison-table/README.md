# @jxi/comparison-table

An Ant Design 5 React component for recursively comparing structured data across multiple versions.

## Installation

```bash
pnpm add @jxi/comparison-table antd @ant-design/icons react react-dom
```

## Basic usage

```tsx
import { RecursiveComparisonTable } from '@jxi/comparison-table';
import '@jxi/comparison-table/styles.css';

const versions = [
  { id: 'draft', label: 'Draft', data: { customer: { name: 'Ava' } } },
  { id: 'final', label: 'Final', data: { customer: { name: 'Ava Lin' } } },
];

export function VersionComparison() {
  return <RecursiveComparisonTable versions={versions} />;
}
```

`react`, `react-dom`, `antd`, and `@ant-design/icons` are peer dependencies and must be installed by the host application.

See the [repository README](https://github.com/xilovesyu/comparison-table#readme) for configuration options, demo development, and release guidance.

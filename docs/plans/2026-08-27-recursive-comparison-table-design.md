# Recursive Multi-Version Comparison Table

## Scope

Build a React TypeScript component on Ant Design 5 that compares any number of nested data versions. A pure comparison engine produces a presentation tree, leaving Table as a UI adapter.

## Architecture

`buildComparisonRows` discovers the union of data paths, applies selection rules, resolves display expansion and renderer precedence, then returns recursive `ComparisonRow` values. `filterComparisonRows` preserves matching rows and their ancestor context. `RecursiveComparisonTable` owns the Ant Design columns, search field, and controlled or uncontrolled expanded row state.

## Public seams and tests

The confirmed contracts are: (1) engine creation/filtering, (2) renderer registration and precedence, and (3) user-visible React table behavior. Tests use known fixtures and rendered output, never internal implementation mocks.

## Decisions

Paths are arrays serialized with JSON to support keys containing dots. Array elements are aligned by index. Missing values remain `undefined`, distinct from `null`. Discovered plain objects expand by default; display rules can retain an object as one leaf. Explicit include matches retain required ancestor nodes. Rule precedence is path, predicate, type, then global. The initial implementation supplies text, number, percentage, boolean, date-time, money, and lookup renderers.

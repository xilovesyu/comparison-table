import { SearchOutlined } from '@ant-design/icons';
import { Button, Input, InputNumber, Radio, Space, Switch, Table, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  buildComparisonRows,
  filterComparisonRows,
  filterDifferenceRows,
  getPropertyType,
  type BuildComparisonConfig,
  type ComparisonRow,
  type ComparisonVersion,
  type DifferenceOptions,
  type MergeEdit,
  type MergeEdits,
  type MergeOptions,
  type MergeResolution,
  type MergeResolutions,
  type MergeScopeEntry,
  type MergeSourceDecision,
  type SearchOptions,
} from '../core/comparison';
import { buildMergeResult } from '../core/merge';
import { copyComparisonRow, getContainerSummaries } from '../core/presentation';
import {
  createRendererRegistry,
  type RendererOverrides,
  RendererRegistry,
} from '../core/renderers';

/** Public props accepted by {@link RecursiveComparisonTable}. */
export interface RecursiveComparisonTableProps extends BuildComparisonConfig {
  /** Ordered versions rendered as table columns. Version ids must be unique. */
  versions: readonly ComparisonVersion[];
  /** Per-table renderer additions or overrides. Built-in renderers remain unchanged globally. */
  renderers?: RendererOverrides;
  /** Shows the global property/value search input. Defaults to `true`. */
  searchable?: boolean;
  /** Chooses whether global search matches property labels, values, or both. */
  searchOptions?: SearchOptions;
  /** Expands every visible tree node initially when no controlled keys are supplied. Defaults to `true`. */
  expandAll?: boolean;
  /** Initial expanded row keys for uncontrolled expansion. */
  defaultExpandedKeys?: React.Key[];
  /** Controlled expanded row keys. */
  expandedKeys?: React.Key[];
  /** Reports expansion changes for controlled or uncontrolled usage. */
  onExpandedChange?: (keys: React.Key[]) => void;
  /**
   * Opt-in Final-column merge resolution. Omit it (or leave `enabled` false) for the legacy table.
   * Supports controlled `value` or an uncontrolled `defaultValue` decision record.
   */
  merge?: MergeOptions;
}

/**
 * Displays recursive records from multiple versions in an Ant Design table.
 *
 * Use `rules` for path-based presentation, `propertyDefinitions` for an explicit
 * display tree, and `comparison` for difference and baseline behavior.
 */
export function RecursiveComparisonTable({
  versions,
  renderers,
  searchable = true,
  searchOptions,
  expandAll = true,
  defaultExpandedKeys,
  expandedKeys,
  onExpandedChange,
  merge,
  ...config
}: RecursiveComparisonTableProps) {
  const [query, setQuery] = useState('');
  const [onlyDifferences, setOnlyDifferences] = useState(
    config.comparison?.onlyDifferences ?? false,
  );
  const [openNodeSearches, setOpenNodeSearches] = useState<React.Key[]>([]);
  const [nodeQueries, setNodeQueries] = useState<Record<string, string>>({});
  const rows = useMemo(() => buildComparisonRows(versions, config), [versions, config]);
  const containerSummaries = useMemo(() => getContainerSummaries(rows), [rows]);
  const differenceRows = useMemo(() => filterDifferenceRows(rows), [rows]);
  const locallyFilteredRows = useMemo(
    () => applyNodeFilters(onlyDifferences ? differenceRows : rows, nodeQueries),
    [onlyDifferences, differenceRows, rows, nodeQueries],
  );
  const visibleRows = useMemo(
    () => filterComparisonRows(locallyFilteredRows, query, searchOptions),
    [locallyFilteredRows, query, searchOptions],
  );
  const allKeys = useMemo(() => collectKeys(visibleRows), [visibleRows]);
  const [internalExpanded, setInternalExpanded] = useState<React.Key[]>(
    defaultExpandedKeys ?? (expandAll ? allKeys : []),
  );
  const activeExpanded =
    query || Object.values(nodeQueries).some(Boolean)
      ? allKeys
      : (expandedKeys ?? internalExpanded);
  const registry = useMemo(() => createRendererRegistry(renderers), [renderers]);
  const baselineId = config.comparison?.baseVersionId;
  const mergeEnabled = merge?.enabled === true;
  const [internalResolutions, setInternalResolutions] = useState<MergeResolutions>(() => ({
    ...(merge?.defaultValue ?? {}),
  }));
  const [internalEdits, setInternalEdits] = useState<MergeEdits>(() => ({
    ...(merge?.defaultEdits ?? {}),
  }));
  const [invalidEditPaths, setInvalidEditPaths] = useState<ReadonlySet<string>>(() => new Set());
  const [announcedInheritedRowId, setAnnouncedInheritedRowId] = useState<string>();
  const activeResolutions = merge?.value ?? internalResolutions;
  const activeEdits = merge?.edits ?? internalEdits;
  const usesEditedMergePlanner =
    merge?.edits !== undefined ||
    merge?.defaultEdits !== undefined ||
    merge?.onEditsChange !== undefined ||
    hasContainerResolution(rows, activeResolutions);
  const mergeResult = useMemo(
    () =>
      mergeEnabled
        ? buildMergeResult(
            rows,
            versions,
            activeResolutions,
            baselineId,
            config.arrayItemKeyFields,
            usesEditedMergePlanner ? activeEdits : undefined,
          )
        : undefined,
    [
      activeEdits,
      activeResolutions,
      baselineId,
      config.arrayItemKeyFields,
      mergeEnabled,
      rows,
      usesEditedMergePlanner,
      versions,
    ],
  );
  const pendingControlledCompletion = useRef<{
    resolutions: MergeResolutions;
    edits: MergeEdits;
    previousResolutions: MergeResolutions;
    previousEdits: MergeEdits;
  }>();
  useEffect(() => {
    const pending = pendingControlledCompletion.current;
    if (!pending) return;
    if (!mergeEnabled) {
      pendingControlledCompletion.current = undefined;
      return;
    }
    const resolutionsMatch = equalResolutions(activeResolutions, pending.resolutions);
    const editsMatch = equalEdits(activeEdits, pending.edits);
    if (resolutionsMatch && editsMatch) {
      pendingControlledCompletion.current = undefined;
      if (!mergeResult?.isComplete) return;
      merge.onComplete?.(mergeResult);
      return;
    }
    const resolutionsRemainExpected =
      merge?.value === undefined ||
      equalResolutions(activeResolutions, pending.previousResolutions) ||
      resolutionsMatch;
    const editsRemainExpected =
      merge?.edits === undefined || equalEdits(activeEdits, pending.previousEdits) || editsMatch;
    if (!resolutionsRemainExpected || !editsRemainExpected) {
      pendingControlledCompletion.current = undefined;
    }
  }, [activeEdits, activeResolutions, merge, mergeEnabled, mergeResult]);
  const rememberControlledCompletion = (
    nextResolutions: MergeResolutions,
    nextEdits: MergeEdits,
    nextComplete: boolean,
  ) => {
    if (!mergeResult || mergeResult.isComplete || !nextComplete) return false;
    if (merge?.value === undefined && merge?.edits === undefined) return false;
    pendingControlledCompletion.current = {
      resolutions: nextResolutions,
      edits: nextEdits,
      previousResolutions: activeResolutions,
      previousEdits: activeEdits,
    };
    return true;
  };
  const publishMergeResolutions = (nextResolutions: MergeResolutions) => {
    if (!mergeEnabled || !mergeResult) return;
    const nextResult = buildMergeResult(
      rows,
      versions,
      nextResolutions,
      baselineId,
      config.arrayItemKeyFields,
      usesEditedMergePlanner ? activeEdits : undefined,
    );
    if (merge?.value === undefined) setInternalResolutions(nextResolutions);
    const waitsForEcho = rememberControlledCompletion(
      nextResolutions,
      activeEdits,
      nextResult.isComplete,
    );
    merge?.onChange?.(nextResolutions, nextResult);
    if (!waitsForEcho && !mergeResult.isComplete && nextResult.isComplete) {
      merge?.onComplete?.(nextResult);
    }
  };
  const publishMergeEdits = (nextEdits: MergeEdits) => {
    if (!mergeEnabled || !mergeResult) return;
    const nextResult = buildMergeResult(
      rows,
      versions,
      activeResolutions,
      baselineId,
      config.arrayItemKeyFields,
      nextEdits,
    );
    if (merge?.edits === undefined) setInternalEdits(nextEdits);
    const waitsForEcho = rememberControlledCompletion(
      activeResolutions,
      nextEdits,
      nextResult.isComplete,
    );
    merge?.onEditsChange?.(nextEdits, nextResult);
    if (!waitsForEcho && !mergeResult.isComplete && nextResult.isComplete) {
      merge?.onComplete?.(nextResult);
    }
  };
  const updateMergeResolution = (resolutionKey: string, resolution: MergeResolution) => {
    publishMergeResolutions({
      ...activeResolutions,
      [resolutionKey]: resolution,
    });
  };
  const clearMergeResolution = (resolutionKey: string) => {
    const nextResolutions: Record<string, MergeResolution> = { ...activeResolutions };
    delete nextResolutions[resolutionKey];
    setAnnouncedInheritedRowId(resolutionKey);
    publishMergeResolutions(nextResolutions);
  };
  const selectMergeSource = (row: ComparisonRow, versionId: string) => {
    updateMergeResolution(row.id, { kind: 'source', versionId });
  };
  const updateMergeEdit = (row: ComparisonRow, edit: MergeEdit) => {
    setInvalidEditPaths((paths) => {
      if (!paths.has(row.id)) return paths;
      const next = new Set(paths);
      next.delete(row.id);
      return next;
    });
    publishMergeEdits({ ...activeEdits, [row.id]: edit });
  };
  const mergeScopeByRowId = useMemo(
    () => new Map(mergeResult?.scope.map((entry) => [entry.resolutionKey, entry]) ?? []),
    [mergeResult],
  );
  const needsMergeSelection = Boolean(
    mergeResult?.scope.some(
      (entry) =>
        entry.active &&
        mergeResult.sourceDecisions.some(
          (decision) =>
            decision.resolutionKey === entry.resolutionKey &&
            (decision.kind === 'unresolved' || decision.kind === 'stale'),
        ),
    ),
  );
  const columns: ColumnsType<ComparisonRow> = [
    {
      title: 'Property',
      key: 'property',
      width: 300,
      render: (_: unknown, row) => (
        <PropertyCell
          row={row}
          open={openNodeSearches.includes(row.id)}
          query={nodeQueries[row.id] ?? ''}
          onToggle={() =>
            setOpenNodeSearches((ids) =>
              ids.includes(row.id) ? ids.filter((id) => id !== row.id) : [...ids, row.id],
            )
          }
          onQuery={(value) => setNodeQueries((queries) => ({ ...queries, [row.id]: value }))}
          baselineId={baselineId ?? versions[0]?.id}
          versionIds={versions.map((version) => version.id)}
        />
      ),
    },
    ...versions.map((version) => {
      const isBaseline = baselineId === version.id;
      const headerClassName = isBaseline
        ? (config.comparison?.baselineHeaderClassName ?? 'comparison-baseline-header')
        : undefined;
      return {
        title: (
          <span className="comparison-version-header">
            <span className={headerClassName}>{version.label}</span>
            {isBaseline && config.comparison?.showBaselineBadge !== false && (
              <span className="comparison-baseline-badge" aria-label="Base">
                Base
              </span>
            )}
          </span>
        ),
        key: version.id,
        className: isBaseline
          ? (config.comparison?.baselineCellClassName ?? 'comparison-baseline-cell')
          : undefined,
        render: (_: unknown, row: ComparisonRow) => {
          const value = renderValue(
            row,
            version,
            registry,
            renderers,
            containerSummaries.get(row.id),
            config.containerSummary,
          );
          const scopeEntry = mergeScopeByRowId.get(row.id);
          if (
            !mergeEnabled ||
            !scopeEntry?.active ||
            scopeEntry.role === 'keyed-presence' ||
            !scopeEntry.allowedSourceVersionIds.includes(version.id) ||
            (!isMergeDecisionRow(row) && scopeEntry.role === 'value')
          ) {
            return value;
          }
          const resolution = activeResolutions[row.id];
          const checked = resolution?.kind === 'source' && resolution.versionId === version.id;
          return (
            <Radio
              name={`merge-source-${row.id}`}
              aria-label={`${row.property.path.join('.')} ${version.label}`}
              checked={checked}
              onChange={() => selectMergeSource(row, version.id)}
            >
              {value}
            </Radio>
          );
        },
      };
    }),
    ...(mergeEnabled
      ? [
          {
            title: merge?.finalLabel ?? 'Final',
            key: 'merge-final',
            render: (_: unknown, row: ComparisonRow) => {
              const scopeEntry = mergeScopeByRowId.get(row.id);
              const hasManualResolution = Object.prototype.hasOwnProperty.call(
                activeResolutions,
                row.id,
              );
              const clearButton = hasManualResolution ? (
                <Button
                  aria-label={`Clear ${row.property.path.join('.')}`}
                  size="small"
                  onClick={() => clearMergeResolution(row.id)}
                >
                  Clear
                </Button>
              ) : null;
              if (scopeEntry?.role === 'keyed-presence' && scopeEntry.active) {
                const resolution = activeResolutions[row.id];
                const pathLabel = row.property.path.join('.');
                return (
                  <div role="radiogroup" aria-label={`${pathLabel} presence`}>
                    {scopeEntry.allowedSourceVersionIds.map((versionId) => {
                      const version = versions.find((candidate) => candidate.id === versionId);
                      if (!version) return null;
                      return (
                        <Radio
                          key={versionId}
                          name={`merge-presence-${row.id}`}
                          aria-label={`${pathLabel} Include from ${version.label}`}
                          checked={
                            resolution?.kind === 'source' && resolution.versionId === versionId
                          }
                          onChange={() =>
                            updateMergeResolution(row.id, { kind: 'source', versionId })
                          }
                        >
                          Include from {version.label}
                        </Radio>
                      );
                    })}
                    <Radio
                      name={`merge-presence-${row.id}`}
                      aria-label={`${pathLabel} Exclude`}
                      checked={resolution?.kind === 'exclude'}
                      onChange={() => updateMergeResolution(row.id, { kind: 'exclude' })}
                    >
                      Exclude
                    </Radio>
                    {clearButton}
                    {resolution && <span aria-live="polite">Complete</span>}
                  </div>
                );
              }
              if (!scopeEntry) return null;
              const decision = mergeResult?.sourceDecisions.find(
                (candidate) => candidate.kind !== 'stale' && candidate.resolutionKey === row.id,
              );
              const edit = activeEdits[row.id];
              const inherited =
                !hasManualResolution && !edit
                  ? findInheritedResolution(
                      scopeEntry,
                      mergeScopeByRowId,
                      activeResolutions,
                      versions,
                    )
                  : undefined;
              const editor =
                usesEditedMergePlanner && scopeEntry.active && scopeEntry.role === 'value' ? (
                  <MergeValueEditor
                    row={row}
                    edit={edit}
                    sourceDecision={decision}
                    invalid={invalidEditPaths.has(row.id)}
                    onInvalid={(invalid) =>
                      setInvalidEditPaths((paths) => {
                        const next = new Set(paths);
                        if (invalid) next.add(row.id);
                        else next.delete(row.id);
                        return next;
                      })
                    }
                    onEdit={(nextEdit) => updateMergeEdit(row, nextEdit)}
                  />
                ) : null;
              if (edit) {
                const displayVersion =
                  versions.find(
                    (candidate) =>
                      decision &&
                      'sourceVersionId' in decision &&
                      candidate.id === decision.sourceVersionId,
                  ) ?? versions[0];
                return (
                  <div>
                    {edit.kind === 'set' && displayVersion
                      ? renderCellValue(
                          row,
                          edit.value,
                          displayVersion,
                          registry,
                          renderers,
                          containerSummaries.get(row.id),
                          config.containerSummary,
                        )
                      : 'Deleted'}
                    {editor}
                    {clearButton}
                  </div>
                );
              }
              if (!decision || !('sourceVersionId' in decision)) {
                return (
                  <div>
                    <span>Unresolved</span>
                    {editor}
                    {clearButton}
                  </div>
                );
              }
              const version = versions.find(
                (candidate) => candidate.id === decision.sourceVersionId,
              );
              const finalValue = version
                ? renderValue(
                    row,
                    version,
                    registry,
                    renderers,
                    containerSummaries.get(row.id),
                    config.containerSummary,
                  )
                : 'Unresolved';
              return (
                <div>
                  {finalValue}
                  {inherited && announcedInheritedRowId === row.id && (
                    <span aria-live="polite">
                      Inherited from {inherited.path}: {inherited.versionLabel}
                    </span>
                  )}
                  {editor}
                  {clearButton}
                </div>
              );
            },
          },
        ]
      : []),
  ];
  return (
    <section aria-label="Recursive comparison table">
      <div className="comparison-toolbar">
        {searchable && (
          <Input
            aria-label="Search comparison"
            allowClear
            placeholder="Search properties and values"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        )}
        <Space className="comparison-difference-control">
          <Switch
            aria-label="Only show differences"
            checked={onlyDifferences}
            onChange={setOnlyDifferences}
          />
          <Typography.Text>仅显示差异（{countRows(differenceRows)}）</Typography.Text>
        </Space>
        {mergeEnabled && (
          <span aria-live="polite">{needsMergeSelection ? 'Needs selection' : 'Complete'}</span>
        )}
      </div>
      <Table<ComparisonRow>
        rowKey="id"
        columns={columns}
        dataSource={visibleRows}
        pagination={false}
        rowClassName={(row) =>
          row.hasOwnDifference
            ? 'comparison-row-difference'
            : row.hasDifference
              ? 'comparison-row-difference-parent'
              : ''
        }
        expandable={{
          expandedRowKeys: activeExpanded,
          onExpandedRowsChange: (keys) => {
            const nextKeys = [...keys];
            if (!expandedKeys) setInternalExpanded(nextKeys);
            onExpandedChange?.(nextKeys);
          },
        }}
      />
    </section>
  );
}
function isMergeDecisionRow(row: ComparisonRow): boolean {
  return Boolean(row.hasOwnDifference && !row.children?.length);
}
function hasContainerResolution(
  rows: readonly ComparisonRow[],
  resolutions: MergeResolutions,
): boolean {
  return rows.some(
    (row) =>
      (Boolean(row.children?.length) &&
        Object.prototype.hasOwnProperty.call(resolutions, row.id)) ||
      hasContainerResolution(row.children ?? [], resolutions),
  );
}
function equalResolutions(left: MergeResolutions, right: MergeResolutions): boolean {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  return (
    leftKeys.length === rightKeys.length &&
    leftKeys.every((key) => {
      const leftValue = left[key];
      const rightValue = right[key];
      return (
        leftValue?.kind === rightValue?.kind &&
        (leftValue?.kind !== 'source' ||
          (rightValue?.kind === 'source' && leftValue.versionId === rightValue.versionId))
      );
    })
  );
}
function equalEdits(left: MergeEdits, right: MergeEdits): boolean {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  return (
    leftKeys.length === rightKeys.length &&
    leftKeys.every((key) => {
      const leftValue = left[key];
      const rightValue = right[key];
      return (
        leftValue?.kind === rightValue?.kind &&
        (leftValue?.kind !== 'set' ||
          (rightValue?.kind === 'set' && Object.is(leftValue.value, rightValue.value)))
      );
    })
  );
}
function findInheritedResolution(
  scopeEntry: MergeScopeEntry,
  scopeByRowId: ReadonlyMap<string, MergeScopeEntry>,
  resolutions: MergeResolutions,
  versions: readonly ComparisonVersion[],
): { path: string; versionLabel: string } | undefined {
  let parentKey = scopeEntry.parentResolutionKey;
  while (parentKey) {
    const resolution = resolutions[parentKey];
    if (resolution?.kind === 'source') {
      const parent = scopeByRowId.get(parentKey);
      const version = versions.find((candidate) => candidate.id === resolution.versionId);
      if (parent && version) {
        return { path: parent.path.join('.'), versionLabel: version.label };
      }
    }
    parentKey = scopeByRowId.get(parentKey)?.parentResolutionKey;
  }
  return undefined;
}
function MergeValueEditor({
  row,
  edit,
  sourceDecision,
  invalid,
  onInvalid,
  onEdit,
}: {
  row: ComparisonRow;
  edit?: MergeEdit;
  sourceDecision?: MergeSourceDecision;
  invalid: boolean;
  onInvalid: (invalid: boolean) => void;
  onEdit: (edit: MergeEdit) => void;
}) {
  const pathLabel = row.property.path.join('.');
  const sourceVersionId =
    sourceDecision && 'sourceVersionId' in sourceDecision
      ? sourceDecision.sourceVersionId
      : undefined;
  const sourceValue = sourceVersionId
    ? row.values[sourceVersionId]
    : Object.values(row.values).find((value) => value !== undefined);
  const editValue = edit?.kind === 'set' ? edit.value : sourceValue;
  const valueType = getPropertyType(sourceValue);
  const controls = (() => {
    if (valueType === 'number') {
      const numberValue =
        typeof editValue === 'number' && Number.isFinite(editValue) ? editValue : null;
      return (
        <InputNumber
          type="number"
          aria-label={`Edit ${pathLabel}`}
          aria-invalid={invalid}
          value={numberValue}
          onChange={(value) => {
            if (typeof value === 'number' && Number.isFinite(value)) {
              onInvalid(false);
              onEdit({ kind: 'set', value });
            } else {
              onInvalid(true);
            }
          }}
          onBlur={(event) => {
            const value = event.currentTarget.value.trim();
            if (value !== '' && !Number.isFinite(Number(value))) onInvalid(true);
          }}
        />
      );
    }
    if (valueType === 'boolean') {
      return (
        <Switch
          aria-label={`Edit ${pathLabel}`}
          checked={typeof editValue === 'boolean' ? editValue : false}
          onChange={(value) => onEdit({ kind: 'set', value })}
        />
      );
    }
    return (
      <Input
        aria-label={`Edit ${pathLabel}`}
        value={typeof editValue === 'string' ? editValue : ''}
        onChange={(event) => onEdit({ kind: 'set', value: event.target.value })}
      />
    );
  })();
  return (
    <div className="comparison-merge-editor">
      {controls}
      <Button
        size="small"
        aria-label={`Set ${pathLabel} to null`}
        onClick={() => onEdit({ kind: 'set', value: null })}
      >
        Null
      </Button>
      <Button
        size="small"
        aria-label={`Delete ${pathLabel}`}
        onClick={() => onEdit({ kind: 'delete' })}
      >
        Delete
      </Button>
      {invalid && <span role="alert">{pathLabel} must be a finite number</span>}
    </div>
  );
}
function PropertyCell({
  row,
  open,
  query,
  onToggle,
  onQuery,
  baselineId,
  versionIds,
}: {
  row: ComparisonRow;
  open: boolean;
  query: string;
  onToggle: () => void;
  onQuery: (value: string) => void;
  baselineId?: string;
  versionIds: readonly string[];
}) {
  const expandable = Boolean(row.children?.length);
  const baselinePresent = baselineId ? row.presence?.[baselineId] : undefined;
  const missingVersionIds = versionIds.filter((id) => !row.presence?.[id]);
  const status =
    row.itemIdentity && baselinePresent !== undefined
      ? baselinePresent
        ? missingVersionIds.length === versionIds.length - 1
          ? 'removed'
          : undefined
        : missingVersionIds.length === 1
          ? 'added'
          : undefined
      : undefined;
  return (
    <div className="comparison-property-cell">
      <span>{row.property.label}</span>
      {status && (
        <span className={`comparison-item-status comparison-item-status-${status}`}>
          {status === 'added' ? 'Added' : 'Removed'}
        </span>
      )}
      {row.itemIdentity && !status && missingVersionIds.length > 0 && (
        <span className="comparison-item-status comparison-item-status-missing">
          Missing in {missingVersionIds.join(', ')}
        </span>
      )}
      <DifferenceIndicator row={row} indicator={row.differenceIndicator} />
      {expandable && row.nodeSearchable && (
        <Button
          aria-label={`Search within ${row.property.label}`}
          type="text"
          size="small"
          icon={<SearchOutlined />}
          onClick={onToggle}
        />
      )}
      {open && (
        <Input
          aria-label={`Filter ${row.property.label} children`}
          size="small"
          allowClear
          value={query}
          placeholder={`Filter ${row.property.label}`}
          onChange={(event) => onQuery(event.target.value)}
        />
      )}
    </div>
  );
}
function DifferenceIndicator({
  row,
  indicator,
}: {
  row: ComparisonRow;
  indicator: DifferenceOptions['differenceIndicator'];
}) {
  if (!row.hasDifference || indicator === false) return null;
  const info = {
    row,
    values: Object.values(row.values),
    isDirectDifference: Boolean(row.hasOwnDifference),
    descendantDifferenceCount: row.descendantDifferenceCount ?? 0,
  };
  if (typeof indicator === 'function') return <>{indicator(info)}</>;
  return (
    <span
      className={`comparison-difference-badge ${
        info.isDirectDifference
          ? 'comparison-difference-badge-direct'
          : 'comparison-difference-badge-parent'
      }`}
      aria-label="Diff"
    >
      Diff
      {info.descendantDifferenceCount > 0 && <sup>{info.descendantDifferenceCount}</sup>}
    </span>
  );
}
function renderValue(
  row: ComparisonRow,
  version: ComparisonVersion,
  registry: RendererRegistry,
  overrides: RendererOverrides | undefined,
  resolvedSummary: BuildComparisonConfig['containerSummary'],
  tableSummary: BuildComparisonConfig['containerSummary'],
) {
  return renderCellValue(
    row,
    row.values[version.id],
    version,
    registry,
    overrides,
    resolvedSummary,
    tableSummary,
  );
}
function renderCellValue(
  row: ComparisonRow,
  value: unknown,
  version: ComparisonVersion,
  registry: RendererRegistry,
  overrides: RendererOverrides | undefined,
  resolvedSummary: BuildComparisonConfig['containerSummary'],
  tableSummary: BuildComparisonConfig['containerSummary'],
) {
  const context = {
    key: row.property.key,
    path: row.property.path,
    value,
    level: row.property.level,
    type: row.property.type,
    valueType: getPropertyType(value),
    version,
    property: row.property,
  };
  const explicit = row.property.renderValue?.(value, context);
  if (explicit != null) return explicit;
  if (row.property.renderer !== undefined) {
    const renderer = registry.get(row.property.renderer ?? String(row.property.type));
    if (renderer) return renderer(value, context);
  }
  if (hasRendererOverride(overrides, String(row.property.type))) {
    const renderer = registry.get(String(row.property.type));
    if (renderer) return renderer(value, context);
  }
  if (isSummaryContainer(value)) {
    const summary = resolvedSummary ?? tableSummary;
    const rendered = summary?.(value, context);
    if (rendered !== undefined) return rendered;
    return defaultContainerSummary(value);
  }
  const typedRenderer = registry.get(row.property.type);
  if (typedRenderer) return typedRenderer(value, context);
  return registry.get('text')?.(value, context);
}
function defaultContainerSummary(value: Record<string, unknown> | unknown[]): string {
  return Array.isArray(value)
    ? `[ ${value.length} items ]`
    : `{ ${Object.keys(value).length} fields }`;
}
function hasRendererOverride(overrides: RendererOverrides | undefined, name: string): boolean {
  if (!overrides) return false;
  return overrides instanceof RendererRegistry
    ? Array.from(overrides.entries()).some(([key]) => key === name)
    : Object.prototype.hasOwnProperty.call(overrides, name);
}
function isSummaryContainer(value: unknown): value is Record<string, unknown> | unknown[] {
  if (Array.isArray(value)) return true;
  if (value === null || typeof value !== 'object') return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
function collectKeys(rows: readonly ComparisonRow[]): React.Key[] {
  return rows.flatMap((row) => [row.id, ...collectKeys(row.children ?? [])]);
}
function applyNodeFilters(
  rows: readonly ComparisonRow[],
  queries: Readonly<Record<string, string>>,
): ComparisonRow[] {
  return rows.map((row) => {
    const children = row.children ? applyNodeFilters(row.children, queries) : undefined;
    const ownQuery = queries[row.id];
    return copyComparisonRow(row, {
      children: ownQuery ? filterComparisonRows(children ?? [], ownQuery) : children,
    });
  });
}
function countRows(rows: readonly ComparisonRow[]): number {
  return rows.reduce((count, row) => count + 1 + countRows(row.children ?? []), 0);
}

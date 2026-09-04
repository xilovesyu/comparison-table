import type { ComparisonTableTexts, ComparisonTableTextOverrides } from './types';

export const defaultComparisonTableTexts: ComparisonTableTexts = {
  tableRegionLabel: 'Recursive comparison table',
  propertyColumn: 'Property',
  baselineBadge: 'Base',
  baselineBadgeAriaLabel: 'Base',
  differenceIndicator: 'Diff',
  differenceIndicatorAriaLabel: 'Diff',
  globalSearchLabel: 'Search comparison',
  globalSearchPlaceholder: 'Search properties and values',
  onlyDifferencesLabel: 'Only show differences',
  onlyDifferencesCount: ({ count }) => `仅显示差异（${count}）`,
  nodeSearchLabel: ({ propertyLabel }) => `Search within ${propertyLabel}`,
  nodeFilterLabel: ({ propertyLabel }) => `Filter ${propertyLabel} children`,
  nodeFilterPlaceholder: ({ propertyLabel }) => `Filter ${propertyLabel}`,
  finalColumn: 'Final',
  sourceChoiceLabel: ({ path, versionLabel }) => `${path.join('.')} ${versionLabel}`,
  presenceGroupLabel: ({ path }) => `${path.join('.')} presence`,
  includeFromLabel: ({ path, versionLabel }) => `${path.join('.')} Include from ${versionLabel}`,
  excludeLabel: ({ path }) => `${path.join('.')} Exclude`,
  clearResolutionLabel: ({ path }) => `Clear ${path.join('.')}`,
  clearEditLabel: ({ path }) => `Clear edit ${path.join('.')}`,
  editValueLabel: ({ path }) => `Edit ${path.join('.')}`,
  setNullLabel: ({ path }) => `Set ${path.join('.')} to null`,
  deleteValueLabel: ({ path }) => `Delete ${path.join('.')}`,
  inheritedSourceStatus: ({ sourcePath, versionLabel }) =>
    `Inherited from ${sourcePath}: ${versionLabel}`,
  needsSelectionStatus: 'Needs selection',
  completeStatus: 'Complete',
  unresolvedStatus: 'Unresolved',
  deletedStatus: 'Deleted',
  addedStatus: 'Added',
  removedStatus: 'Removed',
  missingStatus: ({ versionIds }) => `Missing in ${versionIds.join(', ')}`,
  validationError: ({ error }) => error,
};

export function resolveComparisonTableTexts(
  overrides?: ComparisonTableTextOverrides,
): ComparisonTableTexts {
  const resolved: ComparisonTableTexts = {
    tableRegionLabel: resolveText(overrides, 'tableRegionLabel'),
    propertyColumn: resolveText(overrides, 'propertyColumn'),
    baselineBadge: resolveText(overrides, 'baselineBadge'),
    baselineBadgeAriaLabel: resolveText(overrides, 'baselineBadgeAriaLabel'),
    differenceIndicator: resolveText(overrides, 'differenceIndicator'),
    differenceIndicatorAriaLabel: resolveText(overrides, 'differenceIndicatorAriaLabel'),
    globalSearchLabel: resolveText(overrides, 'globalSearchLabel'),
    globalSearchPlaceholder: resolveText(overrides, 'globalSearchPlaceholder'),
    onlyDifferencesLabel: resolveText(overrides, 'onlyDifferencesLabel'),
    onlyDifferencesCount: resolveText(overrides, 'onlyDifferencesCount'),
    nodeSearchLabel: resolveText(overrides, 'nodeSearchLabel'),
    nodeFilterLabel: resolveText(overrides, 'nodeFilterLabel'),
    nodeFilterPlaceholder: resolveText(overrides, 'nodeFilterPlaceholder'),
    finalColumn: resolveText(overrides, 'finalColumn'),
    sourceChoiceLabel: resolveText(overrides, 'sourceChoiceLabel'),
    presenceGroupLabel: resolveText(overrides, 'presenceGroupLabel'),
    includeFromLabel: resolveText(overrides, 'includeFromLabel'),
    excludeLabel: resolveText(overrides, 'excludeLabel'),
    clearResolutionLabel: resolveText(overrides, 'clearResolutionLabel'),
    clearEditLabel: resolveText(overrides, 'clearEditLabel'),
    editValueLabel: resolveText(overrides, 'editValueLabel'),
    setNullLabel: resolveText(overrides, 'setNullLabel'),
    deleteValueLabel: resolveText(overrides, 'deleteValueLabel'),
    inheritedSourceStatus: resolveText(overrides, 'inheritedSourceStatus'),
    needsSelectionStatus: resolveText(overrides, 'needsSelectionStatus'),
    completeStatus: resolveText(overrides, 'completeStatus'),
    unresolvedStatus: resolveText(overrides, 'unresolvedStatus'),
    deletedStatus: resolveText(overrides, 'deletedStatus'),
    addedStatus: resolveText(overrides, 'addedStatus'),
    removedStatus: resolveText(overrides, 'removedStatus'),
    missingStatus: resolveText(overrides, 'missingStatus'),
    validationError: resolveText(overrides, 'validationError'),
  };

  return {
    ...resolved,
    onlyDifferencesCount: checkedFormatter('onlyDifferencesCount', resolved.onlyDifferencesCount),
    nodeSearchLabel: checkedFormatter('nodeSearchLabel', resolved.nodeSearchLabel),
    nodeFilterLabel: checkedFormatter('nodeFilterLabel', resolved.nodeFilterLabel),
    nodeFilterPlaceholder: checkedFormatter(
      'nodeFilterPlaceholder',
      resolved.nodeFilterPlaceholder,
    ),
    sourceChoiceLabel: checkedFormatter('sourceChoiceLabel', resolved.sourceChoiceLabel),
    presenceGroupLabel: checkedFormatter('presenceGroupLabel', resolved.presenceGroupLabel),
    includeFromLabel: checkedFormatter('includeFromLabel', resolved.includeFromLabel),
    excludeLabel: checkedFormatter('excludeLabel', resolved.excludeLabel),
    clearResolutionLabel: checkedFormatter('clearResolutionLabel', resolved.clearResolutionLabel),
    clearEditLabel: checkedFormatter('clearEditLabel', resolved.clearEditLabel),
    editValueLabel: checkedFormatter('editValueLabel', resolved.editValueLabel),
    setNullLabel: checkedFormatter('setNullLabel', resolved.setNullLabel),
    deleteValueLabel: checkedFormatter('deleteValueLabel', resolved.deleteValueLabel),
    inheritedSourceStatus: checkedFormatter(
      'inheritedSourceStatus',
      resolved.inheritedSourceStatus,
    ),
    missingStatus: checkedFormatter('missingStatus', resolved.missingStatus),
    validationError: checkedFormatter('validationError', resolved.validationError),
  };
}

function resolveText<Key extends keyof ComparisonTableTexts>(
  overrides: ComparisonTableTextOverrides | undefined,
  key: Key,
): ComparisonTableTexts[Key] {
  const override = overrides?.[key];
  return override === undefined ? defaultComparisonTableTexts[key] : override;
}

function checkedFormatter<Context>(
  key: keyof ComparisonTableTexts,
  formatter: (context: Context) => string,
): (context: Context) => string {
  return (context) => {
    const result = formatter(context);
    if (typeof result !== 'string') {
      throw new TypeError(`Comparison table text formatter ${key} must return a string`);
    }
    return result;
  };
}

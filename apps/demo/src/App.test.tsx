import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { StrictMode } from 'react';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';

const navigationExamples = [
  ['basic-recursive', '基础递归对比'],
  ['selection', '属性选择与路径覆盖'],
  ['renderer', '自定义渲染器'],
  ['controlled', '受控展开、数组与缺失值'],
  ['flattened', '自定义顺序与扁平层级'],
  ['registry', '局部 Renderer Registry'],
  ['diff', '自动 Diff 与自定义比较'],
  ['baseline', '基准列高亮'],
  ['presentation-controls', '显示控制与层级继承'],
  ['keyed-array', '业务键数组对齐'],
  ['container-summary', '容器摘要'],
  ['final-merge', '最终版本合并'],
  ['text-overrides', '内置文案配置与本地化'],
  ['advanced-configuration', '综合高级配置'],
] as const;

const navigationGroups = ['基础', '配置', '差异', '高级', '综合'] as const;

function setExampleHash(id = 'basic-recursive') {
  window.history.replaceState({}, '', `#example-${id}`);
}

function exampleCard(title: string) {
  return screen.getByRole('heading', { name: title }).closest('.ant-card') as HTMLElement;
}

function navigation() {
  return screen.getByRole('navigation', { name: '示例目录' });
}

function navigateToExample(id: (typeof navigationExamples)[number][0]) {
  const [, title] = navigationExamples.find(([exampleId]) => exampleId === id)!;
  fireEvent.click(within(navigation()).getByRole('link', { name: title }));
  return exampleCard(title);
}

function renderExample(id: (typeof navigationExamples)[number][0]) {
  setExampleHash();
  render(<App />);
  return navigateToExample(id);
}

afterEach(() => {
  cleanup();
  window.history.replaceState({}, '', '/');
  vi.restoreAllMocks();
});

describe('documentation examples', () => {
  it('shows the documented comparison scenarios', () => {
    for (const [id, title] of navigationExamples) {
      const card = renderExample(id);
      expect(within(card).getByRole('heading', { name: title })).toBeInTheDocument();
      cleanup();
    }
  });

  it('reveals a source panel for each example', () => {
    const card = renderExample('basic-recursive');
    fireEvent.click(within(card).getByRole('button', { name: '查看源代码' }));
    expect(within(card).getByText(/RecursiveComparisonTable/)).toBeInTheDocument();
    expect(within(card).getByRole('button', { name: '复制源代码' })).toBeInTheDocument();
  });

  it('keeps the original built-in text when an existing example does not pass texts', () => {
    const card = renderExample('basic-recursive');

    expect(
      within(card).getByRole('region', { name: 'Recursive comparison table' }),
    ).toBeInTheDocument();
    expect(within(card).getByRole('columnheader', { name: 'Property' })).toBeInTheDocument();
    expect(within(card).getByRole('textbox', { name: 'Search comparison' })).toHaveAttribute(
      'placeholder',
      'Search properties and values',
    );
    expect(within(card).getByRole('switch', { name: 'Only show differences' })).toBeInTheDocument();
  });

  it('shows summary money as a non-expandable first-level value', () => {
    const card = renderExample('basic-recursive');
    const row = within(card).getByText('汇总金额（仅一级）').closest('tr')!;
    expect(within(row).getByText('$1,200.00')).toBeInTheDocument();
    expect(within(row).queryByRole('button', { name: /row/i })).not.toBeInTheDocument();
  });

  it('shows array items as top-level presentation rows without their lines parent', () => {
    const card = renderExample('flattened');
    expect(within(card).getByText('lines[0]')).toBeInTheDocument();
    expect(within(card).getByText('备注')).toBeInTheDocument();
    expect(within(card).getByText('lines[1]')).toBeInTheDocument();
    expect(within(card).queryByText(/^lines$/)).not.toBeInTheDocument();
  });

  it('combines flattened rows, money renderers and sensitive-field filtering', () => {
    const card = renderExample('advanced-configuration');
    expect(within(card).getByText('结算金额（可展开）')).toBeInTheDocument();
    expect(within(card).getByText('总计（仅一级）')).toBeInTheDocument();
    expect(within(card).getAllByText(/^订单行 \[/).length).toBeGreaterThan(0);
    expect(within(card).queryByText('secret')).not.toBeInTheDocument();
  });

  it('places the local registry example before the advanced example and mixes renderer styles', () => {
    const registryCard = renderExample('registry');
    const advancedCard = navigateToExample('advanced-configuration');
    expect(within(advancedCard).getByText('本地金额：USD 980')).toBeInTheDocument();
    expect(within(advancedCard).getByText('$1,200.00')).toBeInTheDocument();
    expect(registryCard).toHaveAttribute('hidden');
  });

  it('places automatic diff before the advanced example and integrates its diff indicator', () => {
    const diffCard = renderExample('diff');
    const advancedCard = navigateToExample('advanced-configuration');
    expect(within(advancedCard).getAllByLabelText('Diff').length).toBeGreaterThan(0);
    expect(diffCard).toHaveAttribute('hidden');
  });

  it('places hierarchical display controls before the advanced example and integrates them', () => {
    const controlsCard = renderExample('presentation-controls');
    const advancedCard = navigateToExample('advanced-configuration');
    expect(
      within(advancedCard).queryByRole('button', { name: 'Search within 客户信息' }),
    ).not.toBeInTheDocument();
    expect(within(advancedCard).getByLabelText('Base')).toBeInTheDocument();
    expect(controlsCard).toHaveAttribute('hidden');
  });

  it('places keyed-array alignment before the advanced example and integrates it', () => {
    const keyedCard = renderExample('keyed-array');
    const advancedCard = navigateToExample('advanced-configuration');
    expect(within(keyedCard).getByText('lines[P-100]')).toBeInTheDocument();
    expect(within(advancedCard).getAllByText(/^订单行 \[/).length).toBeGreaterThan(0);
  });

  it('shows complete data, configuration and JSX in the advanced source panel', () => {
    const advancedCard = renderExample('advanced-configuration');

    fireEvent.click(within(advancedCard).getByRole('button', { name: '查看源代码' }));

    expect(within(advancedCard).getByText(/const advancedVersions/)).toBeInTheDocument();
    expect(within(advancedCard).getByText(/const advancedDefinitions/)).toBeInTheDocument();
    expect(
      within(advancedCard).getByText(/arrayItemKeyFields={{ lines: 'sku' }}/),
    ).toBeInTheDocument();
    expect(within(advancedCard).getByText(/baseVersionId: 'baseline'/)).toBeInTheDocument();
    expect(within(advancedCard).getByText(/<RecursiveComparisonTable/)).toBeInTheDocument();
  });

  it('places the keyed-array example before advanced configuration and includes it in the advanced source panel', () => {
    const keyedCard = renderExample('keyed-array');
    const advancedCard = navigateToExample('advanced-configuration');
    expect(within(keyedCard).getByText('lines[P-100]')).toBeInTheDocument();
    const keyedCardAfterReturn = navigateToExample('keyed-array');
    fireEvent.click(within(keyedCardAfterReturn).getByRole('button', { name: '查看源代码' }));
    expect(within(keyedCardAfterReturn).getByText(/arrayItemKeyFields/)).toBeInTheDocument();
    navigateToExample('advanced-configuration');
    fireEvent.click(within(advancedCard).getByRole('button', { name: '查看源代码' }));
    expect(within(advancedCard).getByText(/arrayItemKeyFields/)).toBeInTheDocument();
    expect(within(advancedCard).getByText(/itemDefinition/)).toBeInTheDocument();
  });

  it('shows a genuine baseline-only keyed item as Removed in the keyed-array example', () => {
    const card = renderExample('keyed-array');

    expect(within(card).getByText('Removed')).toBeInTheDocument();
  });

  it('places container summaries before advanced configuration and includes them in source panels', () => {
    const summaryCard = renderExample('container-summary');
    const advancedCard = navigateToExample('advanced-configuration');
    expect(within(summaryCard).getAllByText('字段数：2')).toHaveLength(2);
    const summaryCardAfterReturn = navigateToExample('container-summary');
    fireEvent.click(within(summaryCardAfterReturn).getByRole('button', { name: '查看源代码' }));
    expect(within(summaryCardAfterReturn).getByText(/containerSummary/)).toBeInTheDocument();
    navigateToExample('advanced-configuration');
    fireEvent.click(within(advancedCard).getByRole('button', { name: '查看源代码' }));
    expect(within(advancedCard).getByText(/containerSummary/)).toBeInTheDocument();
  });

  it('keeps the container-summary demo safe for object, array, null, undefined, and long values', () => {
    const card = renderExample('container-summary');
    expect(within(card).getByText('[ 2 items ]')).toBeInTheDocument();
    expect(within(card).getByText('null')).toBeInTheDocument();
    expect(within(card).getAllByText('—')).not.toHaveLength(0);
    expect(within(card).queryByText(/x{100}/)).not.toBeInTheDocument();
    fireEvent.click(within(card).getByRole('button', { name: '查看源代码' }));
    expect(within(card).getByText(/10000/)).toBeInTheDocument();
  });

  it('shows an Advanced keyed item missing only in review and keeps it in the source panel', () => {
    const card = renderExample('advanced-configuration');
    expect(within(card).getByText(/Missing in review/)).toBeInTheDocument();
    fireEvent.click(within(card).getByRole('button', { name: '查看源代码' }));
    expect(within(card.querySelector('.source-panel')!).getByText(/review/)).toBeInTheDocument();
  });

  it('shows the review/P-400/Missing scenario in the opened Advanced source panel', () => {
    const card = renderExample('advanced-configuration');
    fireEvent.click(within(card).getByRole('button', { name: '查看源代码' }));
    const source = within(card)
      .getByText(/const advancedVersions/)
      .closest('.source-panel') as HTMLElement;
    expect(
      within(source).getByText(/id: 'review',[\s\S]*sku: 'P-400',[\s\S]*containerSummary/),
    ).toBeInTheDocument();
  });

  it('keeps the Advanced comparison interactive when its source panel is opened', () => {
    const card = renderExample('advanced-configuration');
    expect(within(card).getByLabelText('综合配置对比表')).toBeInTheDocument();
    fireEvent.click(within(card).getByRole('button', { name: '查看源代码' }));
    expect(within(card).getByLabelText('综合配置对比表')).toBeInTheDocument();
    expect(
      within(card)
        .getByText(/const advancedVersions/)
        .closest('.source-panel'),
    ).toBeInTheDocument();
  });

  it('places the Final merge example before Advanced and keeps its raw source and copy action in sync', () => {
    const originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    const writeText = vi.fn<(text: string) => Promise<void>>(() => Promise.resolve());
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    try {
      const mergeCard = renderExample('final-merge');

      expect(within(mergeCard).getByRole('columnheader', { name: 'Final' })).toBeInTheDocument();
      expect(within(mergeCard).getAllByRole('radio').length).toBeGreaterThan(0);
      expect(
        within(mergeCard).getByRole('radio', { name: /lines\..*Include from/i }),
      ).toBeInTheDocument();
      fireEvent.click(within(mergeCard).getByRole('button', { name: '查看源代码' }));
      const sourcePanel = mergeCard.querySelector('.source-panel') as HTMLElement;
      const sourceText = sourcePanel.textContent ?? '';
      expect(sourceText).toMatch(/merge={{/);
      expect(sourceText).toMatch(/arrayItemKeyFields/);
      expect(sourceText).toMatch(/onChange/);
      expect(sourceText).toMatch(/onComplete/);
      expect(sourceText).toMatch(/reviewSteps/);
      expect(sourceText).toMatch(/defaultValue/);
      fireEvent.click(within(sourcePanel).getByRole('button', { name: '复制源代码' }));
      expect(writeText).toHaveBeenCalledTimes(1);
      expect(writeText.mock.calls[0]?.[0]).toContain('merge={{');
      expect(writeText.mock.calls[0]?.[0]).toContain('reviewSteps');
      expect(writeText.mock.calls[0]?.[0]).toContain('defaultValue');

      navigateToExample('advanced-configuration');
      expect(mergeCard).toHaveAttribute('hidden');
      const directoryLinks = within(navigation()).getAllByRole('link');
      const finalIndex = directoryLinks.findIndex(
        (link) => link.getAttribute('href') === '#example-final-merge',
      );
      const textsIndex = directoryLinks.findIndex(
        (link) => link.getAttribute('href') === '#example-text-overrides',
      );
      const advancedIndex = directoryLinks.findIndex(
        (link) => link.getAttribute('href') === '#example-advanced-configuration',
      );
      expect(finalIndex).toBeGreaterThanOrEqual(0);
      expect(textsIndex).toBeGreaterThanOrEqual(0);
      expect(advancedIndex).toBeGreaterThanOrEqual(0);
      expect(finalIndex).toBeLessThan(textsIndex);
      expect(textsIndex).toBeLessThan(advancedIndex);
    } finally {
      if (originalClipboard) Object.defineProperty(navigator, 'clipboard', originalClipboard);
      else Reflect.deleteProperty(navigator, 'clipboard');
    }
  });

  it('integrates merge, keyed presence, renderer, and container summaries into Advanced and its source panel', () => {
    const advancedCard = renderExample('advanced-configuration');

    expect(
      within(advancedCard).getByRole('columnheader', { name: '最终结果' }),
    ).toBeInTheDocument();
    expect(
      within(advancedCard).getByRole('radio', {
        name: /^lines\.P-300 从复核版加入$/i,
      }),
    ).toBeInTheDocument();
    expect(within(advancedCard).getByText('本地金额：USD 980')).toBeInTheDocument();
    fireEvent.click(within(advancedCard).getByRole('button', { name: '查看源代码' }));
    const sourcePanel = advancedCard.querySelector('.source-panel') as HTMLElement;
    expect(sourcePanel.textContent).toMatch(/merge={{/);
    expect(sourcePanel.textContent).toMatch(/arrayItemKeyFields/);
    expect(sourcePanel.textContent).toMatch(/renderers=/);
    expect(sourcePanel.textContent).toMatch(/containerSummary=/);
  });

  it('places a localized built-in-text example before Advanced and keeps its raw source and copy action synchronized', () => {
    const localizedIndex = navigationExamples.findIndex(([id]) => id === 'text-overrides');
    const advancedIndex = navigationExamples.findIndex(([id]) => id === 'advanced-configuration');
    expect(localizedIndex).toBe(advancedIndex - 1);

    const originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    const writeText = vi.fn<(text: string) => Promise<void>>(() => Promise.resolve());
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    try {
      const card = renderExample('text-overrides');
      expect(within(card).getByRole('region', { name: '本地化递归对比表' })).toBeInTheDocument();
      expect(within(card).getByRole('columnheader', { name: '字段' })).toBeInTheDocument();
      expect(within(card).getByRole('textbox', { name: '搜索对比内容' })).toHaveAttribute(
        'placeholder',
        '搜索属性和值',
      );
      expect(within(card).getByRole('switch', { name: '仅显示差异' })).toBeInTheDocument();
      expect(within(card).getByText(/^共 \d+ 项差异$/)).toBeInTheDocument();
      expect(
        within(card).getByRole('button', { name: '搜索 客户资料（customer）' }),
      ).toBeInTheDocument();
      expect(within(card).getByRole('columnheader', { name: '本地化结果' })).toBeInTheDocument();
      expect(
        within(card).getByRole('radio', { name: 'customer.name 采用复核版' }),
      ).toBeInTheDocument();
      expect(
        within(card).getByRole('radiogroup', { name: 'lines.P-300 的存在状态' }),
      ).toBeInTheDocument();
      expect(
        within(card).getByRole('radio', { name: 'lines.P-300 从复核版加入' }),
      ).toBeInTheDocument();

      const editor = within(card).getByRole('spinbutton', { name: '编辑 amount' });
      fireEvent.change(editor, { target: { value: 'not-a-number' } });
      fireEvent.blur(editor);
      expect(within(card).getByRole('alert')).toHaveTextContent(/amount.*无效/i);

      fireEvent.click(within(card).getByRole('button', { name: '查看源代码' }));
      const sourcePanel = card.querySelector('.source-panel') as HTMLElement;
      const sourceText = sourcePanel.textContent ?? '';
      expect(sourceText).toMatch(/const localizedTexts/);
      expect(sourceText).toMatch(/texts={localizedTexts}/);
      expect(sourceText).toMatch(/onlyDifferencesCount/);
      expect(sourceText).toMatch(/sourceChoiceLabel/);
      expect(sourceText).toMatch(/presenceGroupLabel/);
      expect(sourceText).toMatch(/validationError/);
      fireEvent.click(within(sourcePanel).getByRole('button', { name: '复制源代码' }));
      expect(writeText).toHaveBeenCalledTimes(1);
      expect(writeText.mock.calls[0]?.[0]).toContain('texts={localizedTexts}');
      expect(writeText.mock.calls[0]?.[0]).toContain('validationError');
    } finally {
      if (originalClipboard) Object.defineProperty(navigator, 'clipboard', originalClipboard);
      else Reflect.deleteProperty(navigator, 'clipboard');
    }
  });

  it('integrates local text overrides into Advanced without dropping merge, keyed, renderer, or summary capabilities', () => {
    const originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    const writeText = vi.fn<(text: string) => Promise<void>>(() => Promise.resolve());
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    try {
      const card = renderExample('advanced-configuration');

      expect(within(card).getByRole('region', { name: '综合配置对比表' })).toBeInTheDocument();
      expect(within(card).getByRole('columnheader', { name: '属性' })).toBeInTheDocument();
      expect(within(card).getByRole('columnheader', { name: '最终结果' })).toBeInTheDocument();
      expect(
        within(card).getByRole('radio', { name: /^lines\.P-300 从复核版加入$/ }),
      ).toBeInTheDocument();
      expect(within(card).getByText('本地金额：USD 980')).toBeInTheDocument();

      fireEvent.click(within(card).getByRole('button', { name: '查看源代码' }));
      const sourcePanel = card.querySelector('.source-panel') as HTMLElement;
      const sourceText = sourcePanel.textContent ?? '';
      expect(sourceText).toMatch(/texts=/);
      expect(sourceText).toMatch(/sourceChoiceLabel/);
      expect(sourceText).toMatch(/arrayItemKeyFields/);
      expect(sourceText).toMatch(/containerSummary/);
      expect(sourceText).toMatch(/renderers=/);
      expect(sourceText).toMatch(/merge={{/);
      fireEvent.click(within(sourcePanel).getByRole('button', { name: '复制源代码' }));
      expect(writeText).toHaveBeenCalledTimes(1);
      expect(writeText.mock.calls[0]?.[0]).toContain('texts=');
      expect(writeText.mock.calls[0]?.[0]).toContain('sourceChoiceLabel');
    } finally {
      if (originalClipboard) Object.defineProperty(navigator, 'clipboard', originalClipboard);
      else Reflect.deleteProperty(navigator, 'clipboard');
    }
  });

  it('localizes Advanced Missing and keyed child merge controls in visible text and aria', () => {
    const card = renderExample('advanced-configuration');
    const missingRow = card.querySelector(
      `tr[data-row-key='${JSON.stringify(['lines', 'P-400'])}']`,
    ) as HTMLElement;
    expect(missingRow).toBeInTheDocument();
    expect.soft(within(missingRow).queryByText('lines.P-400 在复核版缺失')).toBeInTheDocument();

    fireEvent.click(within(card).getByRole('radio', { name: /^lines\.P-300 从复核版加入$/ }));

    const presenceRow = card.querySelector(
      `tr[data-row-key='${JSON.stringify(['lines', 'P-300'])}']`,
    ) as HTMLElement;
    const presenceFinalCell = presenceRow.querySelector('td:last-child') as HTMLElement;
    const clearSource = within(presenceFinalCell).getByRole('button');
    expect.soft(clearSource).toHaveAccessibleName('清除 lines.P-300 的来源');
    expect.soft(clearSource).toHaveTextContent(/^清除来源$/);
    fireEvent.click(within(presenceRow).getByRole('button', { name: 'Expand row' }));

    const quantityRow = card.querySelector(
      `tr[data-row-key='${JSON.stringify(['lines', 'P-300', 'quantity'])}']`,
    ) as HTMLElement;
    const quantityFinalCell = quantityRow.querySelector('td:last-child') as HTMLElement;
    const quantityEditor = within(quantityFinalCell).getByRole('spinbutton');
    expect.soft(quantityEditor).toHaveAccessibleName('编辑 lines.P-300.quantity');
    const setNull = within(quantityFinalCell).getByRole('button', {
      name: /^(?:Set lines\.P-300\.quantity to null|将 lines\.P-300\.quantity 设为空值)$/,
    });
    const deleteValue = within(quantityFinalCell).getByRole('button', {
      name: /^(?:Delete lines\.P-300\.quantity|删除 lines\.P-300\.quantity)$/,
    });
    expect.soft(setNull).toHaveAccessibleName('将 lines.P-300.quantity 设为空值');
    expect.soft(setNull).toHaveTextContent(/^设为空值$/);
    expect.soft(deleteValue).toHaveAccessibleName('删除 lines.P-300.quantity');
    expect.soft(deleteValue).toHaveTextContent(/^删除值$/);

    fireEvent.click(setNull);
    const updatedQuantityRow = card.querySelector(
      `tr[data-row-key='${JSON.stringify(['lines', 'P-300', 'quantity'])}']`,
    ) as HTMLElement;
    const clearEdit = within(
      updatedQuantityRow.querySelector('td:last-child') as HTMLElement,
    ).getByRole('button', {
      name: /^(?:Clear edit lines\.P-300\.quantity|清除 lines\.P-300\.quantity 的编辑)$/,
    });
    expect.soft(clearEdit).toHaveAccessibleName('清除 lines.P-300.quantity 的编辑');
    expect.soft(clearEdit).toHaveTextContent(/^清除编辑$/);
  });

  it.each([
    {
      id: 'final-merge' as const,
      title: '最终版本合并',
      childPath: 'customer.name',
      childValue: 'Mia Zhang',
      presenceName: /^lines\.P-300 Include from 复核版$/i,
    },
    {
      id: 'advanced-configuration' as const,
      title: '综合高级配置',
      childPath: 'customer.tier',
      childValue: 'PLATINUM',
      presenceName: /^lines\.P-300 从复核版加入$/i,
    },
  ])(
    'keeps Final before Advanced and demonstrates container inheritance plus keyed item and presence choices in $title',
    ({ id, childPath, childValue, presenceName }) => {
      const finalIndex = navigationExamples.findIndex(([exampleId]) => exampleId === 'final-merge');
      const textsIndex = navigationExamples.findIndex(
        ([exampleId]) => exampleId === 'text-overrides',
      );
      const advancedIndex = navigationExamples.findIndex(
        ([exampleId]) => exampleId === 'advanced-configuration',
      );
      expect(navigationExamples).toHaveLength(14);
      expect(finalIndex).toBeLessThan(textsIndex);
      expect(textsIndex).toBeLessThan(advancedIndex);

      const card = renderExample(id);
      const containerSource = within(card).getByRole('radio', {
        name: /^customer 复核版$/i,
      });
      expect(containerSource).toHaveClass('ant-radio-input');
      fireEvent.click(containerSource);
      expect(containerSource).toBeChecked();

      const childRow = card.querySelector(
        `tr[data-row-key='${JSON.stringify(childPath.split('.'))}']`,
      ) as HTMLElement;
      expect(childRow).toBeInTheDocument();
      expect(
        within(childRow.querySelector('td:last-child') as HTMLElement).getByText(childValue),
      ).toBeInTheDocument();
      expect(within(card).getByRole('radio', { name: /^lines 复核版$/i })).toBeInTheDocument();
      expect(
        within(card).getByRole('radio', { name: /^lines\.P-100 复核版$/i }),
      ).toBeInTheDocument();
      expect(
        within(card).getByRole('radio', {
          name: presenceName,
        }),
      ).toBeInTheDocument();
    },
  );

  it.each([
    {
      id: 'final-merge' as const,
      title: 'Final',
      primitivePath: 'customer.name',
      customPath: 'lines.P-100.quantity',
    },
    {
      id: 'advanced-configuration' as const,
      title: 'Advanced',
      primitivePath: 'customer.tier',
      customPath: 'billing.money.amount',
    },
  ])(
    'demonstrates controlled raw edits and a custom mergeEditor in the $title example',
    ({ id, primitivePath, customPath }) => {
      const card = renderExample(id);

      expect(within(card).getByLabelText(`Edit ${primitivePath}`)).toBeInTheDocument();
      expect(within(card).getByLabelText(`Edit ${customPath}`)).toBeInTheDocument();
      fireEvent.click(within(card).getByRole('button', { name: '查看源代码' }));
      const sourcePanel = card.querySelector('.source-panel') as HTMLElement;
      const sourceText = sourcePanel.textContent ?? '';
      expect(sourceText).toMatch(/type MergeEdits/);
      expect(sourceText).toMatch(/const \[edits, setEdits\]/);
      expect(sourceText).toMatch(/\bedits,?/);
      expect(sourceText).toMatch(/onEditsChange/);
      expect(sourceText).toMatch(/mergeEditor/);
    },
  );

  it.each([
    ['final-merge', '最终版本合并'],
    ['advanced-configuration', '综合高级配置'],
  ] as const)(
    'keeps controlled and default source/edit modes plus raw source copy synchronized in %s',
    (id, _title) => {
      const originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
      const writeText = vi.fn<(text: string) => Promise<void>>(() => Promise.resolve());
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { writeText },
      });
      try {
        const card = renderExample(id);
        const defaultModeButton = within(card).getByRole('button', {
          name: /uncontrolled defaultValue.*defaultEdits/i,
        });
        expect(defaultModeButton).toHaveClass('ant-btn');

        fireEvent.click(within(card).getByRole('button', { name: '查看源代码' }));
        const sourcePanel = card.querySelector('.source-panel') as HTMLElement;
        expect(sourcePanel.textContent).toMatch(/defaultValue/);
        expect(sourcePanel.textContent).toMatch(/defaultEdits/);
        expect(sourcePanel.textContent).toMatch(/onEditsChange/);
        fireEvent.click(within(sourcePanel).getByRole('button', { name: '复制源代码' }));
        expect(writeText).toHaveBeenCalledTimes(1);
        const copiedSource = writeText.mock.calls[0]?.[0] ?? '';
        expect(copiedSource).toContain('defaultEdits');
        expect(copiedSource).toContain('onEditsChange');
        expect(copiedSource).toContain('mergeEditor');

        fireEvent.click(defaultModeButton);
        expect(
          within(card).getByText(/defaultValue.*defaultEdits.*未触发完成提交/i),
        ).toBeInTheDocument();
        expect(within(card).getByRole('button', { name: /^Clear edit /i })).toBeInTheDocument();
      } finally {
        if (originalClipboard) Object.defineProperty(navigator, 'clipboard', originalClipboard);
        else Reflect.deleteProperty(navigator, 'clipboard');
      }
    },
  );

  it('integrates the unkeyed atomic array into Advanced and keeps its raw source and copy action in sync', () => {
    const originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    const writeText = vi.fn<(text: string) => Promise<void>>(() => Promise.resolve());
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    try {
      const card = renderExample('advanced-configuration');
      const arrayRow = within(card).getByText('reviewSteps').closest('tr') as HTMLElement;

      expect(within(arrayRow).getAllByRole('radio')).toHaveLength(3);
      expect(
        within(arrayRow).getByRole('radio', { name: /^reviewSteps 初始版$/i }),
      ).toBeInTheDocument();
      expect(
        within(arrayRow).getByRole('radio', { name: /^reviewSteps 复核版$/i }),
      ).toBeInTheDocument();
      expect(
        within(arrayRow).getByRole('radio', { name: /^reviewSteps 最终版$/i }),
      ).toBeInTheDocument();
      expect(
        within(card).queryByRole('radio', { name: /reviewSteps(?:\.|\[)\d+/i }),
      ).not.toBeInTheDocument();

      expect(
        within(card).getByRole('radio', { name: /^lines\.P-300 从复核版加入$/i }),
      ).toBeInTheDocument();
      expect(within(card).getByText('本地金额：USD 980')).toBeInTheDocument();

      fireEvent.click(within(card).getByRole('button', { name: '查看源代码' }));
      const sourcePanel = card.querySelector('.source-panel') as HTMLElement;
      expect(sourcePanel.textContent).toMatch(/reviewSteps:\s*\[/);
      expect(sourcePanel.textContent).toMatch(/defaultValue/);
      expect(sourcePanel.textContent).toMatch(/arrayItemKeyFields={{ lines: 'sku' }}/);
      expect(sourcePanel.textContent).toMatch(/renderers=/);
      expect(sourcePanel.textContent).toMatch(/containerSummary=/);

      fireEvent.click(within(sourcePanel).getByRole('button', { name: '复制源代码' }));
      expect(writeText).toHaveBeenCalledTimes(1);
      expect(writeText.mock.calls[0]?.[0]).toContain('reviewSteps');
      expect(writeText.mock.calls[0]?.[0]).toContain('defaultValue');
    } finally {
      if (originalClipboard) Object.defineProperty(navigator, 'clipboard', originalClipboard);
      else Reflect.deleteProperty(navigator, 'clipboard');
    }
  });

  it('provides an operable Advanced uncontrolled defaultValue mode without treating mount as submission', () => {
    const card = renderExample('advanced-configuration');

    fireEvent.click(within(card).getByRole('button', { name: /uncontrolled defaultValue/i }));
    expect(within(card).getByText('默认方案已加载，未触发完成提交')).toBeInTheDocument();
    const selected = within(card).getByRole('radio', {
      name: /^approvalStatus 复核版$/i,
    });
    expect(selected).toBeChecked();
    expect(within(card).queryByText('合并已完成')).not.toBeInTheDocument();

    fireEvent.click(within(card).getByRole('button', { name: /^Clear approvalStatus$/i }));
    expect(selected).not.toBeChecked();
    expect(within(card).getByText(/仍有差异待选择|Needs selection/)).toBeInTheDocument();

    fireEvent.click(selected);
    expect(selected).toBeChecked();
    expect(within(card).getByText('合并已完成')).toBeInTheDocument();
  });

  it('offers one whole-array Final decision for an unkeyed changing array without numeric child controls', () => {
    const card = renderExample('final-merge');
    const arrayRow = within(card).getByText('reviewSteps').closest('tr') as HTMLElement;

    expect(within(arrayRow).getAllByRole('radio')).toHaveLength(3);
    expect(
      within(arrayRow).getByRole('radio', { name: /^reviewSteps 初始版$/i }),
    ).toBeInTheDocument();
    expect(
      within(arrayRow).getByRole('radio', { name: /^reviewSteps 复核版$/i }),
    ).toBeInTheDocument();
    expect(
      within(arrayRow).getByRole('radio', { name: /^reviewSteps 最终版$/i }),
    ).toBeInTheDocument();
    expect(
      within(card).queryByRole('radio', { name: /reviewSteps(?:\.|\[)\d+/i }),
    ).not.toBeInTheDocument();

    fireEvent.click(within(card).getByRole('button', { name: '查看源代码' }));
    const sourcePanel = card.querySelector('.source-panel') as HTMLElement;
    expect(sourcePanel.textContent).toMatch(/reviewSteps:\s*\[/);
    expect(sourcePanel.textContent).toMatch(/arrayItemKeyFields={{ lines: 'sku' }}/);
  });

  it('provides an operable uncontrolled defaultValue mode without treating mount as submission', () => {
    const card = renderExample('final-merge');

    fireEvent.click(within(card).getByRole('button', { name: /演示 uncontrolled defaultValue/i }));
    expect(within(card).getByText('默认方案已加载，未触发完成提交')).toBeInTheDocument();
    const selected = within(card).getByRole('radio', {
      name: /^approvalStatus 复核版$/i,
    });
    expect(selected).toBeChecked();
    expect(within(card).queryByText('合并已完成')).not.toBeInTheDocument();

    fireEvent.click(within(card).getByRole('button', { name: /^Clear approvalStatus$/i }));
    expect(selected).not.toBeChecked();
    expect(within(card).getByText(/仍有差异待选择|Needs selection/)).toBeInTheDocument();

    fireEvent.click(selected);
    expect(selected).toBeChecked();
    expect(within(card).getByText('合并已完成')).toBeInTheDocument();

    fireEvent.click(within(card).getByRole('button', { name: '查看源代码' }));
    const sourcePanel = card.querySelector('.source-panel') as HTMLElement;
    expect(sourcePanel.textContent).toMatch(/defaultValue/);
    expect(sourcePanel.textContent).toMatch(/approvalStatus/);
  });

  it.each([
    {
      id: 'final-merge' as const,
      radioName: /^customer\.name 复核版$/i,
      parentLabel: 'customer',
      finalValue: 'Mia Zhang',
    },
    {
      id: 'advanced-configuration' as const,
      radioName: /^billing\.money\.amount 复核版$/i,
      parentLabel: '结算金额（可展开）',
      finalValue: '1,100',
    },
  ])(
    'keeps the $id Final decision and raw value through difference, search, node-search, and expansion visibility',
    ({ id, radioName, parentLabel, finalValue }) => {
      const card = renderExample(id);
      const radio = within(card).getByRole('radio', { name: radioName });
      fireEvent.click(radio);
      expect(radio).toBeChecked();

      const finalCell = radio.closest('tr')?.querySelector('td:last-child') as HTMLElement;
      expect(within(finalCell).getByText(finalValue)).toBeInTheDocument();

      fireEvent.click(within(card).getByRole('switch', { name: 'Only show differences' }));
      expect(within(card).getByRole('radio', { name: radioName })).toBeChecked();

      const globalSearch = within(card).getByLabelText('Search comparison');
      fireEvent.change(globalSearch, { target: { value: '__no_matching_property__' } });
      expect(within(card).queryByRole('radio', { name: radioName })).not.toBeInTheDocument();
      fireEvent.change(globalSearch, { target: { value: '' } });
      expect(within(card).getByRole('radio', { name: radioName })).toBeChecked();

      fireEvent.click(within(card).getByRole('button', { name: `Search within ${parentLabel}` }));
      const nodeSearch = within(card).getByLabelText(`Filter ${parentLabel} children`);
      fireEvent.change(nodeSearch, { target: { value: '__no_matching_child__' } });
      expect(within(card).queryByRole('radio', { name: radioName })).not.toBeInTheDocument();
      fireEvent.change(nodeSearch, { target: { value: '' } });
      expect(within(card).getByRole('radio', { name: radioName })).toBeChecked();

      const parentRow = within(card).getByText(parentLabel).closest('tr') as HTMLElement;
      const expandButton = parentRow.querySelector('.ant-table-row-expand-icon') as HTMLElement;
      fireEvent.click(expandButton);
      expect(within(card).queryByRole('radio', { name: radioName })).not.toBeInTheDocument();
      fireEvent.click(expandButton);
      const restoredRadio = within(card).getByRole('radio', { name: radioName });
      expect(restoredRadio).toBeChecked();
      expect(
        within(
          restoredRadio.closest('tr')?.querySelector('td:last-child') as HTMLElement,
        ).getByText(finalValue),
      ).toBeInTheDocument();
    },
  );
});

describe('Issue #5 demo directory navigation', () => {
  it('publishes the fourteen actual examples as stable catalog links in five groups, with localized text before Advanced last', () => {
    setExampleHash();
    render(<App />);

    const directory = navigation();
    expect(within(directory).getAllByRole('group')).toHaveLength(5);
    expect(within(directory).getAllByRole('button', { name: /展开|收起/ })).toHaveLength(5);

    for (const [id, title] of navigationExamples) {
      expect(within(directory).getByRole('link', { name: title })).toHaveAttribute(
        'href',
        `#example-${id}`,
      );
    }
    expect(
      within(directory)
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual(navigationExamples.map(([, title]) => title));
    expect(navigationGroups.every((group) => directory.textContent?.includes(group))).toBe(true);
    expect(within(directory).getAllByRole('link').at(-1)).toHaveTextContent('综合高级配置');
  });

  it.each([
    ['', '基础递归对比', ''],
    ['#example-basic', '基础递归对比', '#example-basic-recursive'],
    ['#example-keyed-array', '业务键数组对齐', '#example-keyed-array'],
    ['#example-advanced-configuration', '综合高级配置', '#example-advanced-configuration'],
    ['#unknown-example', '基础递归对比', '#example-basic-recursive'],
  ])(
    'cold starts at %s with exactly the canonical selected example',
    (hash, title, canonicalHash) => {
      window.history.replaceState({}, '', hash || '/');
      render(<App />);

      expect(window.location.hash).toBe(canonicalHash);
      expect(screen.getByRole('heading', { name: title })).toBeInTheDocument();
      expect(navigation()).toBeInTheDocument();
      expect(within(navigation()).getByRole('link', { name: title })).toHaveAttribute(
        'aria-current',
        'page',
      );
      expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(1);
    },
  );

  it('uses click, Enter, hashchange, Back and Forward consistently for regular, keyed, and Advanced examples', async () => {
    setExampleHash('basic-recursive');
    const scrollIntoView = vi.fn();
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoView,
    });
    render(<App />);
    await waitFor(() => expect(scrollIntoView).toHaveBeenCalled());
    scrollIntoView.mockClear();

    const directory = navigation();
    const keyed = within(directory).getByRole('link', { name: '业务键数组对齐' });
    await act(async () => fireEvent.click(keyed));
    expect(window.location.hash).toBe('#example-keyed-array');
    expect(keyed).toHaveAttribute('aria-current', 'page');
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: '业务键数组对齐' })).toHaveFocus(),
    );
    expect(scrollIntoView).toHaveBeenCalled();

    scrollIntoView.mockClear();
    fireEvent.click(keyed);
    expect(window.location.hash).toBe('#example-keyed-array');
    expect(keyed).toHaveAttribute('aria-current', 'page');
    expect(scrollIntoView).not.toHaveBeenCalled();

    const advanced = within(directory).getByRole('link', { name: '综合高级配置' });
    await act(async () => fireEvent.keyDown(advanced, { key: 'Enter' }));
    expect(window.location.hash).toBe('#example-advanced-configuration');
    expect(advanced).toHaveAttribute('aria-current', 'page');

    await act(async () => window.history.back());
    await waitFor(() => expect(window.location.hash).toBe('#example-keyed-array'));
    await act(async () => window.history.forward());
    await waitFor(() => expect(window.location.hash).toBe('#example-advanced-configuration'));
  });

  it('does not mount unvisited examples, but keeps every visited card mounted and inert while inactive', () => {
    setExampleHash('basic-recursive');
    render(<App />);
    expect(screen.queryByRole('heading', { name: '业务键数组对齐' })).not.toBeInTheDocument();

    fireEvent.click(within(navigation()).getByRole('link', { name: '业务键数组对齐' }));
    const keyedCard = exampleCard('业务键数组对齐');
    fireEvent.click(within(navigation()).getByRole('link', { name: '基础递归对比' }));

    expect(keyedCard).toBeInTheDocument();
    expect(keyedCard).toHaveAttribute('hidden');
    expect(keyedCard).toHaveAttribute('aria-hidden', 'true');
    expect(within(keyedCard).queryByRole('button')).not.toBeInTheDocument();
  });

  it('preserves Basic source, Controlled expansion, and Advanced source/table state across directory navigation', () => {
    setExampleHash('basic-recursive');
    render(<App />);

    const basic = exampleCard('基础递归对比');
    fireEvent.click(within(basic).getByRole('button', { name: '查看源代码' }));
    fireEvent.click(within(navigation()).getByRole('link', { name: '受控展开、数组与缺失值' }));
    const controlled = exampleCard('受控展开、数组与缺失值');
    const expansionButton = within(controlled).getAllByRole('button', { name: /row/i })[0];
    fireEvent.click(expansionButton);
    fireEvent.click(within(navigation()).getByRole('link', { name: '综合高级配置' }));
    const advanced = exampleCard('综合高级配置');
    fireEvent.click(within(advanced).getByRole('button', { name: '查看源代码' }));
    expect(within(advanced).getByLabelText('综合配置对比表')).toBeInTheDocument();

    fireEvent.click(within(navigation()).getByRole('link', { name: '基础递归对比' }));
    expect(
      within(exampleCard('基础递归对比')).getByRole('button', { name: '隐藏源代码' }),
    ).toBeInTheDocument();
    fireEvent.click(within(navigation()).getByRole('link', { name: '受控展开、数组与缺失值' }));
    expect(
      within(exampleCard('受控展开、数组与缺失值')).getAllByRole('button', { name: /row/i })[0],
    ).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(within(navigation()).getByRole('link', { name: '综合高级配置' }));
    expect(
      within(exampleCard('综合高级配置')).getByLabelText('综合配置对比表'),
    ).toBeInTheDocument();
    expect(
      within(exampleCard('综合高级配置')).getByRole('button', { name: '隐藏源代码' }),
    ).toBeInTheDocument();
  });

  it('keeps group controls accessible, synchronised, and free of hidden keyboard traps', () => {
    setExampleHash();
    render(<App />);
    const directory = navigation();

    for (const control of within(directory).getAllByRole('button', { name: /展开|收起/ })) {
      expect(control).toHaveAttribute('aria-expanded');
      const controls = control.getAttribute('aria-controls');
      expect(controls).toBeTruthy();
      const group = document.getElementById(controls!);
      expect(group).toBeInTheDocument();
      fireEvent.click(control);
      expect(group).toHaveAttribute('hidden');
      expect(within(group!).queryAllByRole('link')).toHaveLength(0);
    }
  });

  it.each(navigationExamples)(
    'routes %s through its directory entry and retains source plus copy actions',
    (_id, title) => {
      setExampleHash();
      render(<App />);

      fireEvent.click(within(navigation()).getByRole('link', { name: title }));
      const card = exampleCard(title);
      expect(card).toBeVisible();
      fireEvent.click(within(card).getByRole('button', { name: '查看源代码' }));
      expect(within(card).getByRole('button', { name: '复制源代码' })).toBeInTheDocument();
    },
  );

  it('renders without browser globals and cleans its history listener after unmount', async () => {
    const originalWindow = globalThis.window;
    Reflect.deleteProperty(globalThis, 'window');
    try {
      expect(() => renderToString(<App />)).not.toThrow();
    } finally {
      Object.defineProperty(globalThis, 'window', { configurable: true, value: originalWindow });
    }

    setExampleHash('basic-recursive');
    const { unmount } = render(<App />);
    unmount();
    await act(async () => {
      window.location.hash = '#example-keyed-array';
    });
    expect(window.location.hash).toBe('#example-keyed-array');
  });
});

describe('Issue #5 architecture navigation compatibility', () => {
  it('keeps all fourteen stable IDs, including basic-recursive, without canonicalising an empty hash', () => {
    window.history.replaceState({}, '', '/');
    render(<App />);

    expect(window.location.hash).toBe('');
    expect(within(navigation()).getByRole('link', { name: '基础递归对比' })).toHaveAttribute(
      'href',
      '#example-basic-recursive',
    );
    expect(
      within(navigation())
        .getAllByRole('link')
        .map((link) => link.getAttribute('href')),
    ).toEqual([
      '#example-basic-recursive',
      '#example-selection',
      '#example-renderer',
      '#example-controlled',
      '#example-flattened',
      '#example-registry',
      '#example-diff',
      '#example-baseline',
      '#example-presentation-controls',
      '#example-keyed-array',
      '#example-container-summary',
      '#example-final-merge',
      '#example-text-overrides',
      '#example-advanced-configuration',
    ]);
  });

  it('replaces an invalid hash with basic-recursive but never moves focus for initial or browser history selection', async () => {
    window.history.replaceState({}, '', '#unknown');
    const scrollIntoView = vi.fn();
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoView,
    });
    render(<App />);

    await waitFor(() => expect(window.location.hash).toBe('#example-basic-recursive'));
    const initialHeading = screen.getByRole('heading', { name: '基础递归对比' });
    expect(initialHeading).toHaveAttribute('id', 'example-basic-recursive-heading');
    expect(initialHeading).toHaveAttribute('tabindex', '-1');
    expect(document.activeElement).not.toBe(initialHeading);

    await act(async () => {
      window.location.hash = '#example-keyed-array';
    });
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: '业务键数组对齐' })).toBeInTheDocument(),
    );
    expect(document.activeElement).not.toBe(
      screen.getByRole('heading', { name: '业务键数组对齐' }),
    );
    expect(scrollIntoView).toHaveBeenCalled();
    await act(async () => {
      window.history.back();
    });
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: '基础递归对比' })).toBeVisible(),
    );
  });

  it('moves focus to the stable H2 only for user click and Enter navigation', async () => {
    setExampleHash('basic-recursive');
    const scrollIntoView = vi.fn();
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoView,
    });
    render(<App />);

    const keyed = within(navigation()).getByRole('link', { name: '业务键数组对齐' });
    await act(async () => fireEvent.click(keyed));
    const keyedHeading = screen.getByRole('heading', { name: '业务键数组对齐' });
    await waitFor(() => expect(keyedHeading).toHaveFocus());
    expect(keyedHeading).toHaveAttribute('id', 'example-keyed-array-heading');
    expect(keyedHeading).toHaveAttribute('tabindex', '-1');
    expect(scrollIntoView).toHaveBeenCalled();

    const advanced = within(navigation()).getByRole('link', { name: '综合高级配置' });
    await act(async () => fireEvent.keyDown(advanced, { key: 'Enter' }));
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: '综合高级配置' })).toHaveFocus(),
    );
  });

  it('starts Controlled from its established expanded lines state, then preserves a collapse and re-expand over navigation', () => {
    const controlled = renderExample('controlled');
    const row = within(controlled).getAllByRole('button', { name: /row/i })[0];
    expect(row).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(row);
    expect(row).toHaveAttribute('aria-expanded', 'false');
    navigateToExample('basic-recursive');
    const restored = navigateToExample('controlled');
    const restoredRow = within(restored).getAllByRole('button', { name: /row/i })[0];
    expect(restoredRow).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(restoredRow);
    expect(restoredRow).toHaveAttribute('aria-expanded', 'true');
  });

  it('does not emit SSR useLayoutEffect or client act warnings under StrictMode', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() =>
      renderToString(
        <StrictMode>
          <App />
        </StrictMode>,
      ),
    ).not.toThrow();
    setExampleHash('basic-recursive');
    render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
    expect(consoleError).not.toHaveBeenCalledWith(
      expect.stringMatching(/useLayoutEffect|not wrapped in act/i),
    );
  });
});

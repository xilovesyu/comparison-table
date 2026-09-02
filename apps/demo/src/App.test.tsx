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
    expect(within(card).getByLabelText('Recursive comparison table')).toBeInTheDocument();
    fireEvent.click(within(card).getByRole('button', { name: '查看源代码' }));
    expect(within(card).getByLabelText('Recursive comparison table')).toBeInTheDocument();
    expect(
      within(card)
        .getByText(/const advancedVersions/)
        .closest('.source-panel'),
    ).toBeInTheDocument();
  });
});

describe('Issue #5 demo directory navigation', () => {
  it('publishes the twelve actual examples as stable catalog links in five groups, with Advanced last', () => {
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
    expect(within(advanced).getByLabelText('Recursive comparison table')).toBeInTheDocument();

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
      within(exampleCard('综合高级配置')).getByLabelText('Recursive comparison table'),
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
  it('keeps all twelve stable IDs, including basic-recursive, without canonicalising an empty hash', () => {
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

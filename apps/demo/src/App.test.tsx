import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from './App';

describe('documentation examples', () => {
  it('shows the documented comparison scenarios', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: '基础递归对比' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '属性选择与路径覆盖' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '自定义渲染器' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '受控展开、数组与缺失值' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '自定义顺序与扁平层级' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '综合高级配置' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '局部 Renderer Registry' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '自动 Diff 与自定义比较' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '基准列高亮' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '显示控制与层级继承' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '业务键数组对齐' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '容器摘要' })).toBeInTheDocument();
  });

  it('reveals a source panel for each example', () => {
    render(<App />);
    fireEvent.click(screen.getAllByRole('button', { name: '查看源代码' })[0]);
    expect(screen.getByText(/RecursiveComparisonTable/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '复制源代码' })).toBeInTheDocument();
  });

  it('shows summary money as a non-expandable first-level value', () => {
    render(<App />);
    const row = screen.getByText('汇总金额（仅一级）').closest('tr')!;
    expect(within(row).getByText('$1,200.00')).toBeInTheDocument();
    expect(within(row).queryByRole('button', { name: /row/i })).not.toBeInTheDocument();
  });

  it('shows array items as top-level presentation rows without their lines parent', () => {
    render(<App />);
    const card = screen
      .getByRole('heading', { name: '自定义顺序与扁平层级' })
      .closest('.ant-card') as HTMLElement;
    expect(within(card).getByText('lines[0]')).toBeInTheDocument();
    expect(within(card).getByText('备注')).toBeInTheDocument();
    expect(within(card).getByText('lines[1]')).toBeInTheDocument();
    expect(within(card).queryByText(/^lines$/)).not.toBeInTheDocument();
  });

  it('combines flattened rows, money renderers and sensitive-field filtering', () => {
    render(<App />);
    const card = screen
      .getByRole('heading', { name: '综合高级配置' })
      .closest('.ant-card') as HTMLElement;
    expect(within(card).getByText('结算金额（可展开）')).toBeInTheDocument();
    expect(within(card).getByText('总计（仅一级）')).toBeInTheDocument();
    expect(within(card).getAllByText(/^订单行 \[/).length).toBeGreaterThan(0);
    expect(within(card).queryByText('secret')).not.toBeInTheDocument();
  });

  it('places the local registry example before the advanced example and mixes renderer styles', () => {
    render(<App />);
    const registryHeading = screen.getByRole('heading', { name: '局部 Renderer Registry' });
    const advancedHeading = screen.getByRole('heading', { name: '综合高级配置' });
    const advancedCard = advancedHeading.closest('.ant-card') as HTMLElement;

    expect(
      registryHeading.compareDocumentPosition(advancedHeading) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(within(advancedCard).getByText('本地金额：USD 980')).toBeInTheDocument();
    expect(within(advancedCard).getByText('$1,200.00')).toBeInTheDocument();
  });

  it('places automatic diff before the advanced example and integrates its diff indicator', () => {
    render(<App />);
    const diffHeading = screen.getByRole('heading', { name: '自动 Diff 与自定义比较' });
    const advancedHeading = screen.getByRole('heading', { name: '综合高级配置' });
    const advancedCard = advancedHeading.closest('.ant-card') as HTMLElement;

    expect(
      diffHeading.compareDocumentPosition(advancedHeading) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(within(advancedCard).getAllByLabelText('Diff').length).toBeGreaterThan(0);
  });

  it('places hierarchical display controls before the advanced example and integrates them', () => {
    render(<App />);
    const controlsHeading = screen.getByRole('heading', { name: '显示控制与层级继承' });
    const advancedHeading = screen.getByRole('heading', { name: '综合高级配置' });
    const advancedCard = advancedHeading.closest('.ant-card') as HTMLElement;

    expect(
      controlsHeading.compareDocumentPosition(advancedHeading) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      within(advancedCard).queryByRole('button', { name: 'Search within 客户信息' }),
    ).not.toBeInTheDocument();
    expect(within(advancedCard).getByLabelText('Base')).toBeInTheDocument();
  });

  it('places keyed-array alignment before the advanced example and integrates it', () => {
    render(<App />);
    const keyedHeading = screen.getByRole('heading', { name: '业务键数组对齐' });
    const advancedHeading = screen.getByRole('heading', { name: '综合高级配置' });
    const keyedCard = keyedHeading.closest('.ant-card') as HTMLElement;
    const advancedCard = advancedHeading.closest('.ant-card') as HTMLElement;

    expect(
      keyedHeading.compareDocumentPosition(advancedHeading) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(within(keyedCard).getByText('lines[P-100]')).toBeInTheDocument();
    expect(within(advancedCard).getAllByText(/^订单行 \[/).length).toBeGreaterThan(0);
  });

  it('shows complete data, configuration and JSX in the advanced source panel', () => {
    render(<App />);
    const advancedCard = screen
      .getByRole('heading', { name: '综合高级配置' })
      .closest('.ant-card') as HTMLElement;

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
    render(<App />);
    const keyedHeading = screen.getByRole('heading', { name: '业务键数组对齐' });
    const advancedHeading = screen.getByRole('heading', { name: '综合高级配置' });
    const keyedCard = keyedHeading.closest('.ant-card') as HTMLElement;
    const advancedCard = advancedHeading.closest('.ant-card') as HTMLElement;
    expect(
      keyedHeading.compareDocumentPosition(advancedHeading) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(within(keyedCard).getByText('lines[P-100]')).toBeInTheDocument();
    fireEvent.click(within(keyedCard).getByRole('button', { name: '查看源代码' }));
    expect(within(keyedCard).getByText(/arrayItemKeyFields/)).toBeInTheDocument();
    fireEvent.click(within(advancedCard).getByRole('button', { name: '查看源代码' }));
    expect(within(advancedCard).getByText(/arrayItemKeyFields/)).toBeInTheDocument();
    expect(within(advancedCard).getByText(/itemDefinition/)).toBeInTheDocument();
  });

  it('shows a genuine baseline-only keyed item as Removed in the keyed-array example', () => {
    render(<App />);
    const card = screen
      .getByRole('heading', { name: '业务键数组对齐' })
      .closest('.ant-card') as HTMLElement;

    expect(within(card).getByText('Removed')).toBeInTheDocument();
  });

  it('places container summaries before advanced configuration and includes them in source panels', () => {
    render(<App />);
    const summaryHeading = screen.getByRole('heading', { name: '容器摘要' });
    const advancedHeading = screen.getByRole('heading', { name: '综合高级配置' });
    const summaryCard = summaryHeading.closest('.ant-card') as HTMLElement;
    const advancedCard = advancedHeading.closest('.ant-card') as HTMLElement;
    expect(
      summaryHeading.compareDocumentPosition(advancedHeading) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(within(summaryCard).getAllByText('字段数：2')).toHaveLength(2);
    fireEvent.click(within(summaryCard).getByRole('button', { name: '查看源代码' }));
    expect(within(summaryCard).getByText(/containerSummary/)).toBeInTheDocument();
    fireEvent.click(within(advancedCard).getByRole('button', { name: '查看源代码' }));
    expect(within(advancedCard).getByText(/containerSummary/)).toBeInTheDocument();
  });
});

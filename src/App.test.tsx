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
    expect(within(card).getByText('lines[0]')).toBeInTheDocument();
    expect(within(card).queryByText('secret')).not.toBeInTheDocument();
  });
});

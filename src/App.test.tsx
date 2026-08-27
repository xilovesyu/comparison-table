import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from './App';

describe('documentation examples', () => {
  it('shows the documented comparison scenarios', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: '基础递归对比' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '属性选择与路径覆盖' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '自定义渲染器' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '受控展开、数组与缺失值' })).toBeInTheDocument();
  });

  it('reveals a source panel for each example', () => {
    render(<App />);
    fireEvent.click(screen.getAllByRole('button', { name: '查看源代码' })[0]);
    expect(screen.getByText(/RecursiveComparisonTable/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '复制源代码' })).toBeInTheDocument();
  });
});

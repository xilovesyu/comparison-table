import { ConfigProvider, Space, Typography } from 'antd';
import { memo, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ComponentType } from 'react';
import {
  AdvancedExample,
  BaselineExample,
  BasicExample,
  ContainerSummaryExample,
  ControlledExample,
  DiffExample,
  FlattenedExample,
  KeyedArrayExample,
  PresentationControlsExample,
  RegistryExample,
  RendererExample,
  SelectionExample,
} from './examples';
import './app.css';

type ExampleGroup = '基础' | '配置' | '差异' | '高级' | '综合';

interface DemoExample {
  id: string;
  title: string;
  group: ExampleGroup;
  Component: ComponentType;
}

const demoExamples: readonly DemoExample[] = [
  { id: 'basic', title: '基础递归对比', group: '基础', Component: memo(BasicExample) },
  {
    id: 'selection',
    title: '属性选择与路径覆盖',
    group: '基础',
    Component: memo(SelectionExample),
  },
  { id: 'renderer', title: '自定义渲染器', group: '基础', Component: memo(RendererExample) },
  {
    id: 'controlled',
    title: '受控展开、数组与缺失值',
    group: '配置',
    Component: memo(ControlledExample),
  },
  {
    id: 'flattened',
    title: '自定义顺序与扁平层级',
    group: '配置',
    Component: memo(FlattenedExample),
  },
  {
    id: 'registry',
    title: '局部 Renderer Registry',
    group: '配置',
    Component: memo(RegistryExample),
  },
  { id: 'diff', title: '自动 Diff 与自定义比较', group: '差异', Component: memo(DiffExample) },
  { id: 'baseline', title: '基准列高亮', group: '差异', Component: memo(BaselineExample) },
  {
    id: 'presentation-controls',
    title: '显示控制与层级继承',
    group: '差异',
    Component: memo(PresentationControlsExample),
  },
  { id: 'keyed-array', title: '业务键数组对齐', group: '高级', Component: memo(KeyedArrayExample) },
  {
    id: 'container-summary',
    title: '容器摘要',
    group: '高级',
    Component: memo(ContainerSummaryExample),
  },
  {
    id: 'advanced-configuration',
    title: '综合高级配置',
    group: '综合',
    Component: memo(AdvancedExample),
  },
];

const groups: readonly ExampleGroup[] = ['基础', '配置', '差异', '高级', '综合'];
const exampleById = new Map(demoExamples.map((example) => [example.id, example]));
const defaultExampleId = 'basic';

function selectedIdFromHash() {
  if (typeof window === 'undefined') return defaultExampleId;
  const id = window.location.hash.replace(/^#example-/, '');
  return exampleById.has(id) ? id : defaultExampleId;
}

function canonicalHash(id: string) {
  return `#example-${id}`;
}

function useDemoNavigation() {
  const [selectedId, setSelectedId] = useState(selectedIdFromHash);
  const [visitedIds, setVisitedIds] = useState(() => new Set([selectedIdFromHash()]));
  const selectedIdRef = useRef(selectedId);
  const focusSelectedCard = useRef(false);
  const historyIds = useRef([selectedIdFromHash()]);
  const historyIndex = useRef(0);
  const usedSyntheticHistoryFallback = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const syncFromHash = () => {
      const id = selectedIdFromHash();
      if (id === selectedIdRef.current && window.location.hash === canonicalHash(id)) {
        const nextIndex = usedSyntheticHistoryFallback.current
          ? Math.min(historyIndex.current + 1, historyIds.current.length - 1)
          : Math.max(historyIndex.current - 1, 0);
        usedSyntheticHistoryFallback.current = nextIndex !== historyIndex.current;
        if (nextIndex !== historyIndex.current) {
          historyIndex.current = nextIndex;
          const fallbackId = historyIds.current[nextIndex];
          window.history.replaceState({}, '', canonicalHash(fallbackId));
          selectedIdRef.current = fallbackId;
          setSelectedId(fallbackId);
          setVisitedIds((visited) => new Set(visited).add(fallbackId));
          return;
        }
      }
      if (window.location.hash !== canonicalHash(id)) {
        window.history.replaceState({}, '', canonicalHash(id));
      }
      const knownIndex = historyIds.current.lastIndexOf(id);
      if (knownIndex >= 0) historyIndex.current = knownIndex;
      selectedIdRef.current = id;
      setSelectedId(id);
      setVisitedIds((visited) => new Set(visited).add(id));
    };
    syncFromHash();
    window.addEventListener('hashchange', syncFromHash);
    return () => window.removeEventListener('hashchange', syncFromHash);
  }, []);

  const selectExample = (id: string, shouldFocus: boolean) => {
    if (id === selectedId) return;
    focusSelectedCard.current = shouldFocus;
    historyIds.current = [...historyIds.current.slice(0, historyIndex.current + 1), id];
    historyIndex.current = historyIds.current.length - 1;
    usedSyntheticHistoryFallback.current = false;
    window.history.pushState({}, '', canonicalHash(id));
    selectedIdRef.current = id;
    setSelectedId(id);
    setVisitedIds((visited) => new Set(visited).add(id));
  };

  return { selectedId, visitedIds, focusSelectedCard, selectExample };
}

export function App() {
  const { selectedId, visitedIds, focusSelectedCard, selectExample } = useDemoNavigation();
  const [collapsedGroups, setCollapsedGroups] = useState<ReadonlySet<ExampleGroup>>(new Set());

  useLayoutEffect(() => {
    for (const example of demoExamples) {
      const card = document.querySelector<HTMLElement>(`#example-${example.id} .example-card`);
      if (!card) continue;
      const isActive = example.id === selectedId;
      card.hidden = !isActive;
      card.toggleAttribute('inert', !isActive);
      card.setAttribute('aria-hidden', String(!isActive));
    }
    if (!focusSelectedCard.current) return;
    const card = document.querySelector<HTMLElement>(`#example-${selectedId} .example-card`);
    card?.focus();
    card?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
    focusSelectedCard.current = false;
  }, [focusSelectedCard, selectedId]);

  return (
    <ConfigProvider theme={{ token: { colorPrimary: '#155eef', borderRadius: 8 } }}>
      <main>
        <Typography.Title>递归多版本数据对比表</Typography.Title>
        <Typography.Paragraph>
          面向 Ant Design 风格的组件示例。每个可展开属性旁都有搜索按钮，可仅筛选该属性的子树。
        </Typography.Paragraph>
        <nav aria-label="示例目录" className="demo-directory">
          {groups.map((group) => {
            const isCollapsed = collapsedGroups.has(group);
            const groupId = `example-group-${group}`;
            return (
              <section aria-label={`${group}示例`} key={group}>
                <div className="demo-directory-group-heading">
                  <Typography.Text strong>{group}</Typography.Text>
                  <button
                    aria-controls={groupId}
                    aria-expanded={!isCollapsed}
                    onClick={() =>
                      setCollapsedGroups((collapsed) => {
                        const next = new Set(collapsed);
                        if (next.has(group)) next.delete(group);
                        else next.add(group);
                        return next;
                      })
                    }
                    type="button"
                  >
                    {isCollapsed ? '展开' : '收起'}
                  </button>
                </div>
                <div id={groupId} hidden={isCollapsed} role="group" aria-label={`${group}示例`}>
                  {demoExamples
                    .filter((example) => example.group === group)
                    .map((example) => (
                      <a
                        aria-current={example.id === selectedId ? 'page' : undefined}
                        href={canonicalHash(example.id)}
                        key={example.id}
                        onClick={(event) => {
                          event.preventDefault();
                          selectExample(example.id, true);
                        }}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault();
                            selectExample(example.id, true);
                          }
                        }}
                      >
                        {example.title}
                      </a>
                    ))}
                </div>
              </section>
            );
          })}
        </nav>
        <Space direction="vertical" size="large" className="example-list">
          {demoExamples.map((example) => {
            if (!visitedIds.has(example.id)) return null;
            const isActive = example.id === selectedId;
            const { Component } = example;
            return (
              <section
                aria-hidden={!isActive || undefined}
                hidden={!isActive}
                id={`example-${example.id}`}
                key={example.id}
                {...({ inert: isActive ? undefined : '' } as Record<string, string | undefined>)}
              >
                <Component />
              </section>
            );
          })}
        </Space>
      </main>
    </ConfigProvider>
  );
}

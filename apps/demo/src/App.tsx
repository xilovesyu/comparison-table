import { ConfigProvider, Space, Typography } from 'antd';
import {
  AdvancedExample,
  BaselineExample,
  BasicExample,
  ControlledExample,
  DiffExample,
  FlattenedExample,
  PresentationControlsExample,
  RegistryExample,
  RendererExample,
  SelectionExample,
} from './examples';

export function App() {
  return (
    <ConfigProvider theme={{ token: { colorPrimary: '#155eef', borderRadius: 8 } }}>
      <main>
        <Typography.Title>递归多版本数据对比表</Typography.Title>
        <Typography.Paragraph>
          面向 Ant Design 风格的组件示例。每个可展开属性旁都有搜索按钮，可仅筛选该属性的子树。
        </Typography.Paragraph>
        <Space direction="vertical" size="large" className="example-list">
          <BasicExample />
          <SelectionExample />
          <RendererExample />
          <ControlledExample />
          <FlattenedExample />
          <RegistryExample />
          <DiffExample />
          <BaselineExample />
          <PresentationControlsExample />
          <AdvancedExample />
        </Space>
      </main>
    </ConfigProvider>
  );
}

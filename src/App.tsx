import { Card, ConfigProvider, Typography } from 'antd';
import { RecursiveComparisonTable } from './components/RecursiveComparisonTable';

const versions = [
  { id: 'draft', label: '草稿', data: { user: { name: 'John', age: 20, address: { city: 'Beijing', country: 'China' } }, money: { amount: 100, currency: 'USD' }, enabled: true } },
  { id: 'review', label: '审核版', data: { user: { name: 'Jack', age: 21, address: { city: 'Shanghai', country: 'China' } }, money: { amount: 200, currency: 'USD' }, enabled: false } },
  { id: 'final', label: '最终版', data: { user: { name: 'John', age: 22, address: { city: 'Shenzhen', country: 'China' } }, money: { amount: 300, currency: 'USD' }, enabled: true } },
];
export function App() {
  return <ConfigProvider theme={{ token: { colorPrimary: '#155eef' } }}><main><Typography.Title>递归多版本数据对比表</Typography.Title><Typography.Paragraph>搜索属性或任意版本值；展开树节点以查看递归数据结构。</Typography.Paragraph><Card><RecursiveComparisonTable versions={versions} rules={[{ path: 'money', expand: false, label: '金额' }, { path: 'user', label: '用户信息' }]} /></Card></main></ConfigProvider>;
}

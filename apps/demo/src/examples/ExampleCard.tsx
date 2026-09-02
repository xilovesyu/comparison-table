import { Button, Card, Typography } from 'antd';
import { useContext, useState } from 'react';
import { DemoExampleIdContext } from '../demoContext';

interface ExampleCardProps {
  title: string;
  description: string;
  code: string;
  children: React.ReactNode;
}

export function ExampleCard({ title, description, code, children }: ExampleCardProps) {
  const [open, setOpen] = useState(false);
  const exampleId = useContext(DemoExampleIdContext);
  const headingId = exampleId ? `example-${exampleId}-heading` : undefined;

  return (
    <Card aria-labelledby={headingId} className="example-card">
      <Typography.Title id={headingId} level={2} tabIndex={-1}>
        {title}
      </Typography.Title>
      <Typography.Paragraph type="secondary">{description}</Typography.Paragraph>
      {children}
      <div className="source-actions">
        <Button type="link" onClick={() => setOpen((value) => !value)}>
          {open ? '隐藏源代码' : '查看源代码'}
        </Button>
      </div>
      {open && (
        <div className="source-panel">
          <Button size="small" onClick={() => navigator.clipboard?.writeText(code)}>
            复制源代码
          </Button>
          <pre>
            <code>{code}</code>
          </pre>
        </div>
      )}
    </Card>
  );
}

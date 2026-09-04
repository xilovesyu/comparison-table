import { Button, Card, Typography } from 'antd';
import { useContext, useEffect, useState } from 'react';
import { DemoExampleIdContext } from '../demoContext';

interface ExampleCardProps {
  title: string;
  description: string;
  code: string;
  children: React.ReactNode;
  sourceResetKey?: unknown;
}

export function ExampleCard({
  title,
  description,
  code,
  children,
  sourceResetKey,
}: ExampleCardProps) {
  const [open, setOpen] = useState(false);
  const exampleId = useContext(DemoExampleIdContext);
  const headingId = exampleId ? `example-${exampleId}-heading` : undefined;

  useEffect(() => setOpen(false), [sourceResetKey]);

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

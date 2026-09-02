import { Button, Card, Typography } from 'antd';
import { useState } from 'react';

interface ExampleCardProps {
  title: string;
  description: string;
  code: string;
  children: React.ReactNode;
}

export function ExampleCard({ title, description, code, children }: ExampleCardProps) {
  const [open, setOpen] = useState(false);
  const headingId = `example-heading-${title}`;

  return (
    <Card aria-labelledby={headingId} className="example-card" tabIndex={-1}>
      <Typography.Title id={headingId} level={2}>
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

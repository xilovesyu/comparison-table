import { Button, Card, Typography } from 'antd';
import { useState } from 'react';

interface ExampleCardProps {
  title: string;
  description: string;
  code: string;
  children: React.ReactNode;
  sourceOnlyWhenOpen?: boolean;
}

export function ExampleCard({
  title,
  description,
  code,
  children,
  sourceOnlyWhenOpen = false,
}: ExampleCardProps) {
  const [open, setOpen] = useState(false);

  return (
    <Card className="example-card">
      <Typography.Title level={2}>{title}</Typography.Title>
      <Typography.Paragraph type="secondary">{description}</Typography.Paragraph>
      {(!open || !sourceOnlyWhenOpen) && children}
      <div className="source-actions">
        <Button type="link" onClick={() => setOpen((value) => !value)}>
          {open ? '收起源代码' : '查看源代码'}
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

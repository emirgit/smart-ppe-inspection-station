import { Badge } from '@/components/ui/badge';

const RESULT_CONFIG = {
  PASS: { label: 'Pass', variant: 'success' },
  FAIL: { label: 'Fail', variant: 'destructive' },
  UNKNOWN_CARD: { label: 'Unknown', variant: 'warning' },
};

export function ResultBadge({ result }) {
  const config = RESULT_CONFIG[result] || { label: result, variant: 'secondary' };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}

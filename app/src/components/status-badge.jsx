import { Badge } from '@/components/ui/badge';

export function StatusBadge({ active }) {
  return (
    <Badge variant={active ? 'success' : 'secondary'}>
      {active ? 'Active' : 'Inactive'}
    </Badge>
  );
}

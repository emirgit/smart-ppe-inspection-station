import { createFileRoute } from '@tanstack/react-router'
import { Workers } from '@/features/workers'
export const Route = createFileRoute('/_authenticated/workers/')({ component: Workers })

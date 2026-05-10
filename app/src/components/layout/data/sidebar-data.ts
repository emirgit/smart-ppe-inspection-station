import {
  LayoutDashboard,
  Users,
  Shield,
  ClipboardList,
  BarChart3,
  HardHat,
  Settings,
  Palette,
} from 'lucide-react'
import { type SidebarData } from '../types'

export const sidebarData: SidebarData = {
  user: {
    name: 'PPE Admin',
    email: 'admin@gebze.edu.tr',
    avatar: '',
  },
  teams: [
    {
      name: 'PPE Admin',
      logo: HardHat,
      plan: 'Inspection Station',
    },
  ],
  navGroups: [
    {
      title: 'Yönetim',
      items: [
        { title: 'Dashboard',   url: '/',          icon: LayoutDashboard },
        { title: 'Çalışanlar',  url: '/workers',   icon: Users },
        { title: 'Roller & PPE', url: '/roles',    icon: Shield },
        { title: 'Kayıtlar',    url: '/logs',      icon: ClipboardList },
        { title: 'Analitik',    url: '/analytics', icon: BarChart3 },
      ],
    },
    {
      title: 'Sistem',
      items: [
        {
          title: 'Ayarlar',
          icon: Settings,
          items: [
            { title: 'Görünüm', url: '/settings/appearance', icon: Palette },
          ],
        },
      ],
    },
  ],
}

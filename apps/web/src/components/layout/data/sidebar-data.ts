import { FolderKanban, Settings, Users } from 'lucide-react'
import { type SidebarData } from '../types'

export const sidebarData: SidebarData = {
  user: {
    name: '',
    email: '',
    avatar: '',
  },
  teams: [],
  navGroups: [
    {
      title: '组织空间',
      items: [
        { title: '家族', url: '/projects', icon: FolderKanban },
        { title: '成员', url: '/members', icon: Users },
        { title: '组织设置', url: '/settings', icon: Settings },
      ],
    },
  ],
}

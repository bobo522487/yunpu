import {
  BookOpenText,
  FolderKanban,
  GitBranch,
  LayoutDashboard,
  LibraryBig,
  Settings2,
  Settings,
  Users,
} from 'lucide-react'
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
      title: '工作区',
      items: [
        { title: '工作台', url: '/home', icon: LayoutDashboard },
        { title: '项目概览', url: '/projects', icon: FolderKanban },
        { title: '成员', url: '/members', icon: Users },
        { title: '工作区设置', url: '/settings', icon: Settings },
      ],
    },
    {
      title: '当前项目',
      items: [
        {
          title: '项目首页',
          url: '/projects/:projectId',
          icon: LayoutDashboard,
        },
        { title: '谱系', url: '/projects/:projectId/lineage', icon: GitBranch },
        {
          title: '谱文',
          url: '/projects/:projectId/articles',
          icon: BookOpenText,
        },
        { title: '谱书', url: '/projects/:projectId/books', icon: LibraryBig },
        {
          title: '项目设置',
          url: '/projects/:projectId/settings',
          icon: Settings2,
        },
      ],
    },
  ],
}

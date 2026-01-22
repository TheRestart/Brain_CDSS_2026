import { useState } from 'react';
import { useAuth } from '@/pages/auth/AuthProvider';
import SidebarItem from './SidebarItem';
import '@/assets/style/sidebarStyle.css'

export default function Sidebar() {
  const { menus, isAuthReady } = useAuth();
  const [openGroup, setOpenGroup] = useState<string | null>(null);

  const handleToggle = (menuId: string) => {
    setOpenGroup(prev => (prev === menuId ? null : menuId));
  };

  if (!isAuthReady) return null;

  return (
    <nav className="sidebar-nav">
      <ul className="menu-list">
        {menus.map(menu => (
          <SidebarItem
            key={menu.id}
            menu={menu}
            isOpen={openGroup === menu.code}
            onToggle={()=> handleToggle(menu.code)}
          />
        ))}
      </ul>
    </nav>
  );
}
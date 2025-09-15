import { FC } from 'react';
import { Menu } from 'lucide-react';

interface SidebarToggleProps {
  onClick: () => void;
  isZenMode: boolean;
  sidebarPinned: boolean;
}

export const SidebarToggle: FC<SidebarToggleProps> = ({
  onClick,
  isZenMode,
  sidebarPinned
}) => {
  if (sidebarPinned || isZenMode) return null;

  return (
    <button 
      className="sidebar-toggle" 
      onClick={onClick}
    >
      <Menu className="h-4 w-4" />
    </button>
  );
};
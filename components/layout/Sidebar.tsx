
import React from 'react';
import { NavLink } from 'react-router-dom';
import { NAV_LINKS, CloseIcon } from '../../constants';
import { useAuth } from '../../hooks/useAuth';

interface SidebarProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, setIsOpen }) => {
  const { user } = useAuth();
  // Check app_metadata first, then user_metadata
  const userRole = user?.app_metadata?.role || user?.user_metadata?.role;
  const activeLinkClass = 'bg-primary-600 text-white shadow-md';
  const inactiveLinkClass = 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700';
  
  const getInitials = (email: string | undefined) => {
    if (!email) return '?';
    return email.charAt(0).toUpperCase();
  };

  const sidebarContent = (
    <div className="flex flex-col h-full">
      <div className="flex-shrink-0 flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="flex-shrink-0 flex items-center justify-center h-10 w-10 rounded-full bg-primary-500 text-white font-bold text-lg">
            {getInitials(user?.email)}
          </div>
          <div className="flex flex-col overflow-hidden">
              <span className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate" title={user?.email}>
                  {user?.email}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400 capitalize">{userRole}</span>
          </div>
        </div>
        <button onClick={() => setIsOpen(false)} className="lg:hidden text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 flex-shrink-0">
          <CloseIcon className="h-6 w-6"/>
        </button>
      </div>
      <nav className="flex-1 overflow-y-auto py-4 min-h-0">
        <ul>
          {NAV_LINKS.filter(link => userRole && link.roles.includes(userRole)).map((link) => (
            <li key={link.href}>
              <NavLink
                to={link.href}
                onClick={() => setIsOpen(false)}
                className={({ isActive }) => 
                  `flex items-center px-4 py-3 mx-2 my-1 rounded-lg transition-all duration-200 ${isActive ? activeLinkClass : inactiveLinkClass}`
                }
              >
                <link.icon className="h-6 w-6 flex-shrink-0" />
                <span className="ml-4 font-medium">{link.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );

  return (
    <>
      {/* Mobile Sidebar */}
      <div
        className={`fixed inset-0 z-30 bg-black bg-opacity-50 transition-opacity lg:hidden ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setIsOpen(false)}
      ></div>
      <div
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-white dark:bg-slate-900 transform transition-transform lg:hidden ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {sidebarContent}
      </div>

      {/* Desktop Sidebar */}
      <div className="hidden lg:flex lg:flex-shrink-0 h-full">
        <div className="flex flex-col w-64 h-full bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800">
          {sidebarContent}
        </div>
      </div>
    </>
  );
};

export default Sidebar;
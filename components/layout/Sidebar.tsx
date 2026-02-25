
import React from 'react';
import { NavLink } from 'react-router-dom';
import { NAV_LINKS, CloseIcon, MenuIcon, ChevronLeftIcon, ChevronRightIcon } from '../../constants';
import { useAuth } from '../../hooks/useAuth';
import { useSidebar } from '../../context/SidebarContext';

interface SidebarProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, setIsOpen }) => {
  const { user } = useAuth();
  const { isCollapsed, toggleSidebar } = useSidebar();
  // Check app_metadata first, then user_metadata
  const userRole = user?.app_metadata?.role || user?.user_metadata?.role;
  const activeLinkClass = 'bg-primary-600 text-white shadow-md';
  const inactiveLinkClass = 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700';

  const getInitials = (email: string | undefined) => {
    if (!email) return '?';
    return email.charAt(0).toUpperCase();
  };

  const sidebarWidth = isCollapsed ? 'w-20' : 'w-64';

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Header with user info and collapse button */}
      <div className={`flex-shrink-0 flex items-center border-b border-slate-200 dark:border-slate-800 transition-all duration-300 ease-in-out ${isCollapsed ? 'flex-col gap-2 py-3 px-2' : 'justify-between px-4 py-4'}`}>
        {/* User info section */}
        <div className={`flex items-center ${isCollapsed ? 'justify-center w-full' : 'gap-3'} overflow-hidden`}>
          <div className="flex-shrink-0 flex items-center justify-center h-10 w-10 rounded-full bg-primary-500 text-white font-bold text-lg">
            {getInitials(user?.email)}
          </div>
          {!isCollapsed && (
            <div className="flex flex-col overflow-hidden transition-opacity duration-300 ease-in-out opacity-100">
                <span className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate" title={user?.email}>
                    {user?.email}
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400 capitalize">{userRole}</span>
            </div>
          )}
        </div>

        {/* Buttons section */}
        <div className={`flex items-center ${isCollapsed ? 'justify-center w-full' : 'gap-2'}`}>
          {/* Desktop collapse button */}
          <button
            onClick={toggleSidebar}
            className="hidden lg:block text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 flex-shrink-0 p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-all duration-200"
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? <ChevronRightIcon className="h-5 w-5" /> : <ChevronLeftIcon className="h-5 w-5" />}
          </button>
          {/* Mobile close button */}
          <button onClick={() => setIsOpen(false)} className="lg:hidden text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 flex-shrink-0">
            <CloseIcon className="h-6 w-6"/>
          </button>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 overflow-y-auto py-4 min-h-0">
        <ul>
          {NAV_LINKS.filter(link => userRole && link.roles.includes(userRole)).map((link) => (
            <li key={link.href}>
              <NavLink
                to={link.href}
                onClick={() => setIsOpen(false)}
                className={({ isActive }) =>
                  `flex items-center ${isCollapsed ? 'justify-center px-2 mx-1' : 'px-4 mx-2'} py-3 my-1 rounded-lg transition-all duration-200 group ${isActive ? activeLinkClass : inactiveLinkClass}`
                }
                title={isCollapsed ? link.label : undefined}
              >
                <link.icon className="h-6 w-6 flex-shrink-0" />
                <span className={`ml-4 font-medium transition-all duration-300 ease-in-out ${isCollapsed ? 'opacity-0 hidden' : 'opacity-100'}`}>{link.label}</span>
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
        <div
          className={`flex flex-col h-full bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 overflow-hidden transition-[width] duration-300 ease-in-out ${sidebarWidth}`}
        >
          {sidebarContent}
        </div>
      </div>
    </>
  );
};

export default Sidebar;
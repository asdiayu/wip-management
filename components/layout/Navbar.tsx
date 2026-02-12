
import React from 'react';
import { useAuth } from '../../hooks/useAuth';
import { MenuIcon, LogoutIcon } from '../../constants';
import ThemeToggle from '../ui/ThemeToggle';

interface NavbarProps {
    toggleSidebar: () => void;
}

const Navbar: React.FC<NavbarProps> = ({ toggleSidebar }) => {
    const { user, signOut } = useAuth();

    return (
        <header className="flex justify-between items-center p-4 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center">
                <button onClick={toggleSidebar} className="text-slate-500 focus:outline-none lg:hidden">
                    <MenuIcon className="h-6 w-6" />
                </button>
                <h1 className="text-xl font-semibold text-slate-700 dark:text-slate-200 ml-2 lg:ml-0">
                  Storage Management
                </h1>
            </div>
            <div className="flex items-center gap-4">
                <ThemeToggle />
                <button onClick={signOut} className="flex items-center text-slate-500 hover:text-red-600 dark:hover:text-red-400 transition-colors duration-200">
                    <LogoutIcon className="h-5 w-5" />
                    <span className="ml-2 hidden sm:inline font-medium">Logout</span>
                </button>
            </div>
        </header>
    );
};

export default Navbar;
import React, { ReactNode, useEffect } from 'react';
import { useAuth } from '../App';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { LogOut, Menu, X, LayoutDashboard, Database, User, Moon, Sun } from 'lucide-react';
import { auth } from '../firebase';

interface LayoutProps {
  children: ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { profile, theme, toggleTheme } = useAuth();
  const [sidebarOpen, setSidebarOpen] = React.useState(false); // Collapsed by default
  const navigate = useNavigate();
  const location = useLocation();

  // Save last visited path for persistence
  useEffect(() => {
    if (location.pathname !== '/login') {
      localStorage.setItem('sheetPrep_lastPath', location.pathname);
    }
  }, [location]);

  const handleLogout = () => {
    auth.signOut();
    localStorage.removeItem('sheetPrep_lastPath');
    navigate('/login');
  };

  const isAdmin = profile?.role === 'admin';

  const NavItem = ({ to, icon: Icon, label }: { to: string, icon: any, label: string }) => {
    const isActive = location.pathname === to;
    return (
      <Link
        to={to}
        onClick={() => setSidebarOpen(false)}
        className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
          isActive 
          ? 'bg-primary-600 text-white shadow-md' 
          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
        }`}
      >
        <Icon size={20} />
        <span className="font-medium">{label}</span>
      </Link>
    );
  };

  return (
    <div className="min-h-screen flex bg-gray-50 dark:bg-dark-surface text-slate-900 dark:text-slate-100 transition-colors duration-200">
      
      {/* Top Navigation Bar */}
      <div className="fixed top-0 w-full z-20 bg-white dark:bg-dark-card border-b border-gray-200 dark:border-dark-border px-4 py-3 flex items-center justify-between shadow-sm h-16">
        <div className="flex items-center space-x-4">
          <button 
            onClick={() => setSidebarOpen(true)} 
            className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-dark-border transition-colors text-slate-600 dark:text-slate-200"
            aria-label="Open Menu"
          >
            <Menu size={24} />
          </button>
          <span className="font-bold text-xl tracking-tight text-primary-600 dark:text-primary-500">MSquare</span>
        </div>
        <div className="flex items-center space-x-3">
           {/* Profile Bubble - Navigate to Account */}
           <Link to="/account" className="hidden sm:flex items-center space-x-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-primary-600 transition-colors">
              <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-primary-700 dark:text-primary-400 font-bold">
                  {profile?.displayName?.[0] || 'U'}
              </div>
              <span className="hidden md:inline">{profile?.displayName || 'User'}</span>
           </Link>
           <button onClick={toggleTheme} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-dark-border text-slate-500 dark:text-slate-400">
            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
          </button>
        </div>
      </div>

      {/* Sidebar Drawer */}
      <aside className={`
        fixed inset-y-0 left-0 z-30 w-72 bg-white dark:bg-dark-card border-r border-gray-200 dark:border-dark-border shadow-2xl transform transition-transform duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="h-full flex flex-col">
          <div className="h-16 flex items-center justify-between px-6 border-b border-gray-200 dark:border-dark-border">
            <span className="font-extrabold text-2xl tracking-tight text-primary-600 dark:text-primary-400">MSquare</span>
            <button onClick={() => setSidebarOpen(false)} className="p-1 rounded-md hover:bg-gray-100 dark:hover:bg-dark-border text-slate-500">
              <X size={20} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto py-6 px-3 space-y-2">
            <NavItem to="/" icon={LayoutDashboard} label="Dashboard" />
            
            {isAdmin && (
              <>
                <div className="pt-6 pb-2 px-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Admin</div>
                <NavItem to="/admin" icon={Database} label="Manage Content" />
                <NavItem to="/admin/users" icon={User} label="User Oversight" />
              </>
            )}
          </div>

          {/* User Section (Bottom) */}
          <div className="p-4 border-t border-gray-200 dark:border-dark-border space-y-4 bg-gray-50 dark:bg-dark-surface/50">
            <Link 
                to="/account" 
                onClick={() => setSidebarOpen(false)}
                className="flex items-center space-x-3 px-2 py-2 rounded-lg hover:bg-gray-200 dark:hover:bg-dark-border transition-colors group"
            >
              <div className="bg-gradient-to-br from-primary-500 to-purple-600 text-white rounded-full w-10 h-10 flex items-center justify-center font-bold text-base shadow-sm ring-2 ring-white dark:ring-dark-card">
                {profile?.displayName?.[0] || profile?.email?.[0] || 'U'}
              </div>
              <div className="overflow-hidden flex-1">
                <p className="text-sm font-bold truncate text-slate-800 dark:text-slate-100 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">{profile?.displayName || 'User'}</p>
                <p className="text-xs text-slate-500 truncate">{profile?.email}</p>
              </div>
            </Link>

            <button 
              onClick={handleLogout}
              className="w-full flex items-center justify-center space-x-2 p-2 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors border border-red-100 dark:border-red-900/30"
            >
              <LogOut size={18} />
              <span className="font-medium text-sm">Sign Out</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Backdrop Overlay - Closes Sidebar on click */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/40 z-20 backdrop-blur-sm transition-opacity"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <main className="flex-1 min-w-0 overflow-y-auto pt-16 scroll-smooth">
        <div className="max-w-[1600px] mx-auto p-4 sm:p-6 lg:p-10">
          {children}
        </div>
      </main>
    </div>
  );
};
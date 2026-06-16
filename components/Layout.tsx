import React, { ReactNode, useEffect, useState } from 'react';
import { useAuth } from '../App';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { LogOut, Menu, X, LayoutDashboard, Database, User, Moon, Sun, Repeat, Search as SearchIcon, Trophy, MessageCircle } from 'lucide-react';
import { db, auth } from '../firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { COLLECTIONS } from '../constants';
import { FocusTimer } from './FocusTimer';
import { GlobalSearch } from './GlobalSearch';

interface LayoutProps {
  children: ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { user, profile, theme, toggleTheme } = useAuth();
  const [sidebarOpen, setSidebarOpen] = React.useState(false); // Collapsed by default
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState<{ id: string; senderName: string; content: string; senderId: string }[]>([]);
  const [showNotifs, setShowNotifs] = useState(false);
  const notifRef = React.useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const location = useLocation();

  const [uiStyle, setUiStyle] = React.useState<'classic' | 'glass'>(() => (localStorage.getItem('uiStyle') as any) || 'classic');

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setShowNotifs(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (uiStyle === 'glass') {
      document.documentElement.classList.add('theme-glass');
    } else {
      document.documentElement.classList.remove('theme-glass');
    }
    localStorage.setItem('uiStyle', uiStyle);
  }, [uiStyle]);

  // Save last visited path for persistence
  useEffect(() => {
    if (location.pathname !== '/login') {
      localStorage.setItem('sheetPrep_lastPath', location.pathname);
    }
  }, [location]);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, COLLECTIONS.MESSAGES),
      where('receiverId', '==', user.uid),
      where('read', '==', false)
    );
    const unsub = onSnapshot(q, (snap) => {
      setUnreadCount(snap.docs.length);
      setUnreadMessages(snap.docs.map(d => ({ id: d.id, senderName: d.data().senderName, content: d.data().content, senderId: d.data().senderId })));
    }, error => {
      console.error("Error fetching unread count:", error);
    });
    return () => unsub();
  }, [user]);

  const handleLogout = () => {
    auth.signOut();
    localStorage.removeItem('sheetPrep_lastPath');
    navigate('/login');
  };

  const isAdmin = profile?.role === 'admin';

  const pendingRevisionsCount = React.useMemo(() => {
    if (!profile?.revisions) return 0;
    const TODAY_MS = new Date().setHours(0, 0, 0, 0);
    return Object.values(profile.revisions).filter(r => !r.revisionCycleCompleted && r.nextRevisionDate && r.nextRevisionDate <= TODAY_MS).length;
  }, [profile?.revisions]);

  const NavItem = ({ to, icon: Icon, label, badge, isBadgeDot }: { to: string, icon: any, label: string, badge?: number, isBadgeDot?: boolean }) => {
    const isActive = location.pathname === to;
    return (
      <Link
        to={to}
        onClick={() => setSidebarOpen(false)}
        className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors group ${
          isActive 
          ? 'bg-primary-600 text-white shadow-md' 
          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
        }`}
      >
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center space-x-3">
            <Icon size={20} />
            <span className="font-medium">{label}</span>
          </div>
          {badge !== undefined && badge > 0 && (
            isBadgeDot ? (
              <div className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse shadow-sm shadow-red-500/50"></div>
            ) : (
              <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${isActive ? 'bg-white text-primary-600' : 'bg-red-500 text-white group-hover:bg-red-600'}`}>
                {badge}
              </span>
            )
          )}
        </div>
      </Link>
    );
  };

  return (
    <div className="min-h-screen flex bg-gray-50 dark:bg-dark-surface text-slate-900 dark:text-slate-100 transition-colors duration-200">
      
      {/* Animated Background for Glass Theme */}
      {uiStyle === 'glass' && (
        <div className="fixed inset-0 overflow-hidden pointer-events-none z-[0]">
           <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500/10 dark:bg-blue-500/20 rounded-full blur-[100px] animate-blob"></div>
           <div className="absolute top-[20%] right-[-10%] w-[35%] h-[35%] bg-purple-500/10 dark:bg-purple-500/20 rounded-full blur-[100px] animate-blob animation-delay-2000"></div>
           <div className="absolute bottom-[-10%] left-[20%] w-[40%] h-[40%] bg-emerald-500/10 dark:bg-emerald-500/20 rounded-full blur-[80px] animate-blob animation-delay-4000"></div>
           <div className="absolute bottom-[20%] right-[20%] w-[30%] h-[40%] bg-pink-500/10 dark:bg-pink-500/20 rounded-full blur-[90px] animate-blob"></div>
        </div>
      )}
      
      {/* Top Navigation Bar */}
      <div className="fixed top-0 w-full z-20 bg-white dark:bg-dark-card glass-panel border-b border-gray-200 dark:border-dark-border px-4 py-3 flex items-center justify-between shadow-sm h-16">
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
           <button 
             onClick={() => setUiStyle(uiStyle === 'classic' ? 'glass' : 'classic')} 
             className="px-3 py-1.5 rounded-full bg-gradient-to-r gap-2 from-indigo-500/10 to-purple-500/10 hover:from-indigo-500/20 hover:to-purple-500/20 text-indigo-600 dark:text-indigo-400 font-bold text-xs transition-colors border border-indigo-500/20 hidden sm:flex items-center"
           >
             {uiStyle === 'classic' ? '💎 Glass UI' : '🎨 Classic UI'}
           </button>
           <button 
             onClick={() => {
                const event = new KeyboardEvent('keydown', { key: 'k', metaKey: true });
                window.dispatchEvent(event);
             }}
             className="hidden sm:flex px-3 py-1.5 rounded-full bg-gray-100 dark:bg-dark-border text-slate-500 dark:text-gray-400 font-bold text-xs items-center gap-2 hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"
           >
             <SearchIcon size={14} />
             <span>Search (Cmd+K)</span>
           </button>
           
           <div className="relative" ref={notifRef}>
             <button 
                onClick={() => setShowNotifs(!showNotifs)}
                className="relative p-2 rounded-full hover:bg-gray-100 dark:hover:bg-dark-border text-slate-500 dark:text-slate-400 transition-colors"
                aria-label="Notifications"
             >
                 <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>
                 {unreadCount > 0 && (
                     <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse ring-2 ring-white dark:ring-dark-card shadow-sm"></span>
                 )}
             </button>
             {showNotifs && (
                 <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-dark-card rounded-xl shadow-2xl border border-gray-200 dark:border-dark-border overflow-hidden z-50 animate-in fade-in slide-in-from-top-2">
                     <div className="p-3 border-b border-gray-100 dark:border-dark-border flex justify-between items-center bg-gray-50 dark:bg-dark-surface">
                         <span className="font-bold text-slate-800 dark:text-white">Notifications</span>
                         {unreadCount > 0 && <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-bold">{unreadCount} New</span>}
                     </div>
                     <div className="max-h-[300px] overflow-y-auto">
                         {unreadMessages.length > 0 ? (
                             unreadMessages.map(msg => (
                                 <Link 
                                     key={msg.id}
                                     to={`/inbox?user=${msg.senderId}`}
                                     onClick={() => setShowNotifs(false)}
                                     className="block p-3 border-b border-gray-50 dark:border-dark-border/50 hover:bg-primary-50 dark:hover:bg-primary-900/10 transition-colors group"
                                  >
                                      <div className="flex gap-3 items-start">
                                          <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 flex items-center justify-center shrink-0 font-bold mt-0.5">
                                               {msg.senderName[0].toUpperCase()}
                                          </div>
                                          <div className="flex-1 min-w-0">
                                              <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">New message from {msg.senderName}</p>
                                              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{msg.content}</p>
                                          </div>
                                      </div>
                                  </Link>
                             ))
                         ) : (
                             <div className="p-6 text-center text-gray-400 text-sm">
                                 No new notifications.
                             </div>
                         )}
                     </div>
                     <Link to="/inbox" onClick={() => setShowNotifs(false)} className="block p-3 text-center text-xs font-bold text-primary-600 hover:bg-gray-50 dark:hover:bg-dark-surface dark:text-primary-400 transition-colors border-t border-gray-100 dark:border-dark-border">
                         View All Messages
                     </Link>
                 </div>
             )}
           </div>

           <button onClick={toggleTheme} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-dark-border text-slate-500 dark:text-slate-400 transition-colors">
            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
          </button>
        </div>
      </div>

      {/* Sidebar Drawer */}
      <aside className={`
        fixed inset-y-0 left-0 z-30 w-72 bg-white dark:bg-dark-card glass-panel border-r border-gray-200 dark:border-dark-border shadow-2xl transform transition-transform duration-300 ease-in-out
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
            <NavItem to="/revision" icon={Repeat} label="Revision" badge={pendingRevisionsCount} />
            <NavItem to="/leaderboard" icon={Trophy} label="Rankings" />
            <NavItem to="/inbox" icon={MessageCircle} label="Inbox" badge={unreadCount} isBadgeDot={true} />
            
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

      <FocusTimer />
      <GlobalSearch />
    </div>
  );
};
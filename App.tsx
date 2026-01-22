import React, { useEffect, useState, useContext, createContext, ReactNode } from 'react';
import { HashRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import firebase from 'firebase/compat/app';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './firebase';
import { UserProfile, Role } from './types';
import { COLLECTIONS, ADMIN_EMAILS } from './constants';
import { Layout } from './components/Layout';
import Login from './pages/Login';
import UserDashboard from './pages/UserDashboard';
import SheetView from './pages/SheetView';
import AdminDashboard from './pages/AdminDashboard';
import UserOversight from './pages/UserOversight';
import Account from './pages/Account';

// --- Auth Context ---

interface AuthContextType {
  user: firebase.User | null;
  profile: UserProfile | null;
  loading: boolean;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  theme: 'light',
  toggleTheme: () => {},
  refreshProfile: async () => {},
});

export const useAuth = () => useContext(AuthContext);

const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<firebase.User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  // Theme Logic
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null;
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    if (savedTheme) {
      setTheme(savedTheme);
      document.documentElement.classList.toggle('dark', savedTheme === 'dark');
    } else if (systemPrefersDark) {
      setTheme('dark');
      document.documentElement.classList.add('dark');
    }
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    document.documentElement.classList.toggle('dark', newTheme === 'dark');
  };

  const fetchProfile = async (uid: string) => {
    const docRef = doc(db, COLLECTIONS.USERS, uid);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      setProfile(docSnap.data() as UserProfile);
    }
  };

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        
        const userRef = doc(db, COLLECTIONS.USERS, firebaseUser.uid);
        const userSnap = await getDoc(userRef);

        // Check if this user is a designated admin based on email
        const isAdminEmail = firebaseUser.email && ADMIN_EMAILS.includes(firebaseUser.email);
        
        if (!userSnap.exists()) {
          // Initialize new user
          const newProfile: UserProfile = {
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            displayName: firebaseUser.displayName,
            role: isAdminEmail ? 'admin' : 'user', // Set role based on email list
            createdAt: Date.now(),
            lastActive: Date.now(),
            completedProblems: {},
            streakStart: Date.now(),
            currentStreak: 0,
            maxStreak: 0,
            lastSolvedDate: null
          };
          
          await setDoc(userRef, newProfile);
          setProfile(newProfile);
        } else {
          const userData = userSnap.data() as UserProfile;
          
          // Auto-promote to admin if email is in the list but role is not admin (fixes existing users)
          if (isAdminEmail && userData.role !== 'admin') {
            await setDoc(userRef, { role: 'admin' }, { merge: true });
            userData.role = 'admin';
          }
          
          setProfile(userData);
          // Update last active
          setDoc(userRef, { lastActive: Date.now() }, { merge: true });
        }
      } else {
        setUser(null);
        setProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ 
      user, 
      profile, 
      loading, 
      theme, 
      toggleTheme,
      refreshProfile: async () => { if(user) await fetchProfile(user.uid); } 
    }}>
      {children}
    </AuthContext.Provider>
  );
};

// --- Protected Routes ---

const RequireAuth: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <div className="min-h-screen flex items-center justify-center dark:bg-gray-900"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div></div>;

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
};

const RequireAdmin: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const { profile, loading } = useAuth();
  if (loading) return <div>Loading...</div>;
  if (profile?.role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center p-8 bg-white dark:bg-gray-800 rounded-lg shadow-md max-w-md">
          <h2 className="text-2xl font-bold text-red-600 mb-2">Access Denied</h2>
          <p className="text-gray-600 dark:text-gray-300 mb-4">You do not have permission to view the Admin Dashboard.</p>
          <p className="text-sm text-gray-500">Current Role: {profile?.role}</p>
        </div>
      </div>
    );
  }
  return children;
};

// --- Main App ---

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          
          {/* Admin Routes */}
          <Route path="/admin/users" element={<RequireAuth><RequireAdmin><Layout><UserOversight /></Layout></RequireAdmin></RequireAuth>} />
          <Route path="/admin" element={<RequireAuth><RequireAdmin><Layout><AdminDashboard /></Layout></RequireAdmin></RequireAuth>} />

          {/* User Routes */}
          <Route path="/account" element={<RequireAuth><Layout><Account /></Layout></RequireAuth>} />
          <Route path="/sheet/:sheetId" element={<RequireAuth><Layout><SheetView /></Layout></RequireAuth>} />
          <Route path="/" element={<RequireAuth><Layout><UserDashboard /></Layout></RequireAuth>} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}
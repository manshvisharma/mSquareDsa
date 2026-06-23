import React, { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../App';
import { Code, Database, LayoutDashboard, Zap, Trophy, LogIn } from 'lucide-react';
import { auth } from '../firebase';

function GridBackground() {
  const [columns, setColumns] = useState(0);
  const [rows, setRows] = useState(0);
  const [scrollingCol, setScrollingCol] = useState(0);
  
  useEffect(() => {
    const calculateGrid = () => {
      const size = 60; // Size of each box
      setColumns(Math.floor(window.innerWidth / size));
      setRows(Math.floor(window.innerHeight / size));
    };
    
    calculateGrid();
    window.addEventListener('resize', calculateGrid);
    return () => window.removeEventListener('resize', calculateGrid);
  }, []);

  useEffect(() => {
    if (columns === 0) return;
    const interval = setInterval(() => {
      setScrollingCol((prev) => (prev + 1) % columns);
    }, 150); // Move scanner every 150ms
    return () => clearInterval(interval);
  }, [columns]);

  return (
    <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none flex flex-wrap" style={{ opacity: 0.4 }}>
       {Array.from({ length: columns * rows }).map((_, i) => {
         const col = i % columns;
         const isScanned = col === scrollingCol;
         
         return (
           <div
             key={i}
             className="border border-white/5 dark:border-white/5 transition-colors duration-1000 ease-out pointer-events-auto"
             style={{
               width: '60px',
               height: '60px',
               backgroundColor: isScanned ? 'rgba(255,255,255,0.05)' : 'transparent',
             }}
             onMouseEnter={(e) => {
               const target = e.currentTarget;
               target.style.transitionDuration = '0s';
               target.style.backgroundColor = 'rgba(255,255,255,0.15)';
               setTimeout(() => {
                 target.style.transitionDuration = '2s';
                 target.style.backgroundColor = 'transparent';
               }, 50);
             }}
           />
         );
       })}
    </div>
  );
}

export default function Home() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0f1117] text-slate-900 dark:text-slate-100 font-sans selection:bg-indigo-500/30">
      {/* Top Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-white/70 dark:bg-[#0f1117]/70 backdrop-blur-md border-b border-gray-200 dark:border-dark-border">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-2xl tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 to-purple-600">
              MSquare
            </span>
          </div>
          <div className="flex items-center gap-4 hover:scale-[1.02] transition-transform">
            {user ? (
              <div className="flex items-center gap-4">
                 <Link to="/dashboard" className="text-sm font-semibold hover:text-indigo-500 transition-colors">Go to Dashboard</Link>
                 <button onClick={() => auth.signOut()} className="px-4 py-1.5 text-sm font-semibold rounded-full bg-red-50 text-red-600 hover:bg-red-100 outline-none transition-colors dark:bg-red-900/20 dark:hover:bg-red-900/40">Log out</button>
              </div>
            ) : (
               <Link to="/login" className="flex items-center gap-2 px-5 py-2 text-sm font-bold rounded-full bg-indigo-600 text-white hover:bg-indigo-700 hover:shadow-lg hover:shadow-indigo-500/25 transition-all">
                  <LogIn size={16} /> Sign In
               </Link>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 px-6 overflow-hidden min-h-[80vh] flex flex-col justify-center bg-slate-950 text-white">
        <GridBackground />
        {/* Animated Glow in Background */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-to-tr from-indigo-500/20 to-purple-500/20 rounded-full blur-3xl opacity-50 pointer-events-none mix-blend-screen animate-pulse" style={{ animationDuration: '4s' }}></div>

        <div className="max-w-5xl mx-auto text-center relative z-10 pointer-events-none">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-500/10 text-indigo-300 rounded-full font-bold text-xs uppercase tracking-wide mb-8 border border-indigo-500/20 pointer-events-auto">
             <Zap size={14} className="fill-indigo-500 text-indigo-500" />
             The ultimate learning tracker
          </div>
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-8 leading-[1.1]">
            Master your
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 to-purple-600 px-3">Coding Journey</span>
          </h1>
          <p className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed pointer-events-auto">
            Track your progress through Data Structures, execute SQL queries instantly, and build a lasting streak. Your definitive platform to land your dream tech role.
          </p>

          <div className="flex items-center justify-center gap-4 pointer-events-auto">
             {user ? (
               <Link to="/dashboard" className="px-8 py-3.5 bg-indigo-600 text-white rounded-xl font-bold shadow-xl shadow-indigo-500/20 hover:bg-indigo-700 hover:-translate-y-1 transition-all">
                  Access Dashboard
               </Link>
             ) : (
                <Link to="/login" className="px-8 py-3.5 bg-indigo-600 text-white rounded-xl font-bold shadow-xl shadow-indigo-500/20 hover:bg-indigo-700 hover:-translate-y-1 transition-all">
                  Get Started for Free
                </Link>
             )}
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-24 px-6 bg-white dark:bg-[#151722] relative z-20">
         <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
               <h2 className="text-3xl font-bold mb-4">Everything you need to succeed</h2>
               <p className="text-slate-500 dark:text-slate-400">Streamline your preparation and focus exactly on what matters.</p>
            </div>
            <div className="grid md:grid-cols-3 gap-8">
               <FeatureCard 
                  icon={Code} 
                  title="DSA Tracking" 
                  desc="Comprehensive progress logging through top algorithmic patterns and problem sheets."
               />
               <FeatureCard 
                  icon={Database} 
                  title="Interactive SQL" 
                  desc="Solve database challenges directly in-browser using our custom SQL evaluator."
               />
               <FeatureCard 
                  icon={Trophy} 
                  title="Spaced Repetition" 
                  desc="Intelligent revision tracking ensures you never forget past algorithms you've solved."
               />
            </div>
         </div>
      </section>

      {/* Upcoming Tiers */}
      <section className="py-24 px-6 border-t border-gray-100 dark:border-dark-border relative overflow-hidden text-center z-10 bg-slate-50 dark:bg-transparent">
         <div className="max-w-4xl mx-auto">
            <h2 className="text-4xl font-extrabold mb-6 tracking-tight">Expand Your Horizons</h2>
            <p className="text-xl text-slate-500 dark:text-slate-400 mb-12">We're expanding beyond algorithms. The ultimate full-stack learning experience is on the horizon.</p>
            
            <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
               <div className="p-8 rounded-2xl bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border relative group overflow-hidden opacity-80 shadow-sm">
                  <div className="absolute top-4 right-4 bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 text-xs font-bold px-2 py-1 rounded">Upcoming</div>
                  <LayoutDashboard className="text-slate-400 dark:text-slate-500 mb-4" size={40} />
                  <h3 className="text-2xl font-bold mb-2 text-left">Frontend Path</h3>
                  <p className="text-slate-500 dark:text-slate-400 text-left text-sm leading-relaxed">
                     Master React, DOM manipulation, and modern CSS architecture in an immersive interactive sandbox environment.
                  </p>
               </div>
               
               <div className="p-8 rounded-2xl bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border relative group overflow-hidden opacity-80 shadow-sm">
                  <div className="absolute top-4 right-4 bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 text-xs font-bold px-2 py-1 rounded">Upcoming</div>
                  <Database className="text-slate-400 dark:text-slate-500 mb-4" size={40} />
                  <h3 className="text-2xl font-bold mb-2 text-left">Backend Path</h3>
                  <p className="text-slate-500 dark:text-slate-400 text-left text-sm leading-relaxed">
                     Design scalable APIs, master database schemas, and deploy containerized services effectively.
                  </p>
               </div>
            </div>
         </div>
      </section>

      <footer className="py-12 border-t border-gray-200 dark:border-dark-border bg-white dark:bg-dark-card text-center text-sm text-slate-500">
         <p>© {new Date().getFullYear()} MSquare. Built for developers.</p>
      </footer>
    </div>
  );
}

function FeatureCard({ icon: Icon, title, desc }: any) {
   return (
      <div className="p-8 rounded-2xl bg-slate-50 dark:bg-dark-surface border border-gray-100 dark:border-dark-border hover:-translate-y-2 transition-transform duration-300 group">
         <div className="w-14 h-14 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
            <Icon size={24} />
         </div>
         <h3 className="text-xl font-bold mb-3">{title}</h3>
         <p className="text-slate-500 dark:text-slate-400 leading-relaxed text-sm">
            {desc}
         </p>
      </div>
   )
}

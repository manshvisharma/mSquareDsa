import React, { useEffect, useState, useMemo, useRef, useLayoutEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../App';
import { getSheetsWithStats } from '../services/dataService';
import { Sheet } from '../types';
import { Award, Zap, ChevronRight, Activity, Flame, CheckCircle2, Trophy, Target, Quote as QuoteIcon, Info, Moon, Sun, Coffee, Calendar, X } from 'lucide-react';

// --- Creative Feature: User Ranks ---
const RANKS = [
  { name: 'Novice', threshold: 0, color: 'text-gray-500', bg: 'bg-gray-100 dark:bg-gray-800' },
  { name: 'Script Kiddie', threshold: 10, color: 'text-emerald-500', bg: 'bg-emerald-100 dark:bg-emerald-900/30' },
  { name: 'Byte Juggler', threshold: 25, color: 'text-blue-500', bg: 'bg-blue-100 dark:bg-blue-900/30' },
  { name: 'Algorithmist', threshold: 50, color: 'text-indigo-500', bg: 'bg-indigo-100 dark:bg-indigo-900/30' },
  { name: 'Code Ninja', threshold: 100, color: 'text-purple-500', bg: 'bg-purple-100 dark:bg-purple-900/30' },
  { name: 'Master Architect', threshold: 200, color: 'text-pink-500', bg: 'bg-pink-100 dark:bg-pink-900/30' },
  { name: 'Grandmaster', threshold: 500, color: 'text-orange-500', bg: 'bg-orange-100 dark:bg-orange-900/30' }
];

const QUOTES = [
  "First, solve the problem. Then, write the code.",
  "Make it work, make it right, make it fast.",
  "Simplicity is the soul of efficiency.",
  "Code is like humor. When you have to explain it, it’s bad.",
  "Optimism is an occupational hazard of programming."
];

// Helper to get local date string YYYY-MM-DD
const getLocalDateStr = (date: Date) => {
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - (offset * 60 * 1000));
  return local.toISOString().split('T')[0];
};

const ContributionGraph = ({ completedDates }: { completedDates: Record<string, number> }) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Auto-Scroll to the end (Current Date) on mount
  useLayoutEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollLeft = scrollContainerRef.current.scrollWidth;
    }
  }, [completedDates]);

  // Logic: Segmented Month Blocks (Image 2 Style)
  const monthsData = useMemo(() => {
    const today = new Date();
    const result = [];
    
    // Generate last 12 months (including current)
    for (let i = 11; i >= 0; i--) {
        const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
        const year = d.getFullYear();
        const month = d.getMonth();
        const monthName = d.toLocaleString('default', { month: 'short' });
        
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const startDayOffset = d.getDay(); // 0 = Sunday
        
        const days = [];
        
        // 1. Padding for days before the 1st (Invisible cells)
        for(let k=0; k<startDayOffset; k++) {
            days.push({ id: `pad-start-${month}-${k}`, invisible: true });
        }
        
        // 2. Actual Days
        for(let day=1; day<=daysInMonth; day++) {
            const currentDayDate = new Date(year, month, day);
            const dateStr = currentDayDate.toLocaleDateString('en-CA');
            
            let isSolved = false;
            if (Object.keys(completedDates).length > 0) {
                 if (completedDates[dateStr]) isSolved = true;
                 else {
                     isSolved = Object.values(completedDates).some(ts => {
                         if (!ts) return false;
                         const tsDate = new Date(ts);
                         return tsDate.toLocaleDateString('en-CA') === dateStr;
                     });
                 }
            }

            days.push({
                id: dateStr,
                date: dateStr,
                isSolved,
                invisible: false,
                isToday: dateStr === new Date().toLocaleDateString('en-CA')
            });
        }
        
        result.push({ name: monthName, days });
    }
    return result;
  }, [completedDates]);

  return (
    <div ref={scrollContainerRef} className="w-full overflow-x-auto pb-2 custom-scrollbar scroll-smooth">
      <div className="flex gap-4 min-w-max px-1">
          {monthsData.map((month, idx) => (
              <div key={idx} className="flex flex-col gap-2">
                  <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider h-4">{month.name}</span>
                  <div className="grid grid-rows-7 grid-flow-col gap-[3px]">
                      {month.days.map((day) => (
                          <div 
                            key={day.id}
                            title={day.invisible ? '' : `${day.date}${day.isSolved ? ': Solved' : ''}`}
                            className={`
                                w-3 h-3 rounded-[2px] 
                                ${day.invisible ? 'opacity-0 pointer-events-none' : ''}
                                ${!day.invisible && day.isSolved 
                                    ? 'bg-emerald-500 dark:bg-emerald-500 shadow-[0_0_4px_rgba(16,185,129,0.4)]' 
                                    : !day.invisible 
                                        ? 'bg-gray-200 dark:bg-slate-700' 
                                        : ''
                                }
                                ${day.isToday && !day.isSolved && !day.invisible ? 'ring-1 ring-emerald-400 dark:ring-emerald-600' : ''}
                            `}
                          />
                      ))}
                  </div>
              </div>
          ))}
      </div>
       {/* Legend */}
       <div className="flex items-center gap-2 mt-4 text-xs text-gray-400 justify-end pr-2 border-t border-gray-100 dark:border-gray-800 pt-3">
            <span>Less</span>
            <div className="w-3 h-3 bg-gray-200 dark:bg-slate-700 rounded-[2px]"></div>
            <div className="w-3 h-3 bg-emerald-500 rounded-[2px]"></div>
            <span>More</span>
      </div>
    </div>
  );
};

// --- Rank Guide Modal ---
const RankModal = ({ isOpen, onClose, currentRankName }: { isOpen: boolean, onClose: () => void, currentRankName: string }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-dark-card w-full max-w-md rounded-2xl shadow-2xl border border-gray-200 dark:border-dark-border overflow-hidden">
                <div className="p-4 border-b border-gray-100 dark:border-dark-border flex justify-between items-center bg-gray-50 dark:bg-dark-surface">
                    <h3 className="font-bold text-lg dark:text-white flex items-center gap-2"><Trophy size={18} className="text-yellow-500"/> Rank Guide</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20}/></button>
                </div>
                <div className="p-4 space-y-3 max-h-[60vh] overflow-y-auto">
                    {RANKS.map((r) => (
                        <div key={r.name} className={`flex items-center justify-between p-3 rounded-xl border ${currentRankName === r.name ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20' : 'border-transparent hover:bg-gray-50 dark:hover:bg-dark-surface'}`}>
                            <div className="flex items-center gap-3">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${r.bg} ${r.color}`}>
                                    {r.threshold > 0 ? r.name[0] : 'N'}
                                </div>
                                <div>
                                    <div className={`font-bold text-sm ${r.color}`}>{r.name}</div>
                                    <div className="text-xs text-gray-400">Title</div>
                                </div>
                            </div>
                            <div className="text-right">
                                <div className="font-mono font-bold text-slate-700 dark:text-slate-300">{r.threshold}+</div>
                                <div className="text-xs text-gray-400 uppercase">Solved</div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default function UserDashboard() {
  const { profile } = useAuth();
  const [sheets, setSheets] = useState<(Sheet & { total: number, solved: number })[]>([]);
  const [loading, setLoading] = useState(true);
  const [quote, setQuote] = useState(QUOTES[0]);
  const [isRankModalOpen, setIsRankModalOpen] = useState(false);

  useEffect(() => {
    setQuote(QUOTES[Math.floor(Math.random() * QUOTES.length)]);
    const load = async () => {
        if(profile) {
            const userSolvedIds = new Set(Object.keys(profile.completedProblems));
            const data = await getSheetsWithStats(userSolvedIds);
            setSheets(data);
            setLoading(false);
        }
    };
    load();
  }, [profile]);

  const totalSolved = Object.keys(profile?.completedProblems || {}).length;

  // Rank Logic
  const currentRankIndex = RANKS.slice().reverse().findIndex(r => totalSolved >= r.threshold);
  const rank = currentRankIndex !== -1 ? RANKS[RANKS.length - 1 - currentRankIndex] : RANKS[0];
  const nextRank = RANKS[RANKS.length - 1 - currentRankIndex + 1];
  const progressToNext = nextRank 
    ? Math.min(100, Math.round(((totalSolved - rank.threshold) / (nextRank.threshold - rank.threshold)) * 100))
    : 100;

  // --- New Feature: Badges Logic ---
  const badges = useMemo(() => {
      // FIX: Filter out any null/undefined values to prevent errors
      const timestamps = (Object.values(profile?.completedProblems || {}) as (number|null|undefined)[])
        .filter((ts): ts is number => typeof ts === 'number');
      
      const earlyBird = timestamps.some(ts => {
          const h = new Date(ts).getHours();
          return h >= 4 && h < 9;
      });
      
      const nightOwl = timestamps.some(ts => {
          const h = new Date(ts).getHours();
          return h >= 22 || h < 4;
      });

      const weekendWarrior = timestamps.some(ts => {
          const d = new Date(ts).getDay();
          return d === 0 || d === 6; // Sun or Sat
      });

      return [
          { id: 'early', icon: Sun, label: 'Early Bird', earned: earlyBird, desc: 'Solved a problem before 9 AM' },
          { id: 'night', icon: Moon, label: 'Night Owl', earned: nightOwl, desc: 'Solved a problem after 10 PM' },
          { id: 'weekend', icon: Coffee, label: 'Weekender', earned: weekendWarrior, desc: 'Solved on a weekend' },
          { id: 'streak', icon: Flame, label: 'Marathoner', earned: (profile?.maxStreak || 0) >= 7, desc: '7+ day streak' },
      ];
  }, [profile]);


  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good Morning' : hour < 18 ? 'Good Afternoon' : 'Good Evening';

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      
      {/* 1. Header with Rank & Quote */}
      <div className="flex flex-col md:flex-row justify-between items-end gap-6 pb-6 border-b border-gray-200 dark:border-dark-border">
          <div>
              <h1 className="text-4xl font-extrabold text-slate-900 dark:text-white mb-2">
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-600 to-violet-600 dark:from-primary-400 dark:to-violet-400">
                      {greeting}, {profile?.displayName?.split(' ')[0] || 'Coder'}
                  </span>
              </h1>
              <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-gray-400 italic">
                  <QuoteIcon size={14} className="transform scale-x-[-1]" />
                  {quote}
              </div>
          </div>
          
          <div className="flex items-center gap-4 bg-white dark:bg-dark-card px-5 py-3 rounded-xl shadow-sm border border-gray-100 dark:border-dark-border relative group">
               <div className={`p-3 rounded-full bg-gray-50 dark:bg-dark-surface ${rank.color}`}>
                   <Trophy size={24} />
               </div>
               <div>
                   <div className="flex items-center gap-2">
                        <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">Current Rank</div>
                        <button onClick={() => setIsRankModalOpen(true)} className="text-gray-400 hover:text-primary-500 transition-colors" title="View Rank Guide">
                            <Info size={14} />
                        </button>
                   </div>
                   <div className={`text-xl font-black ${rank.color}`}>{rank.name}</div>
                   {nextRank && (
                       <div className="w-32 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full mt-1.5 overflow-hidden">
                           <div className="h-full bg-primary-500 transition-all duration-1000" style={{width: `${progressToNext}%`}}></div>
                       </div>
                   )}
                   {nextRank && <div className="text-[10px] text-gray-400 mt-1">{totalSolved} / {nextRank.threshold} to next level</div>}
               </div>
          </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* LEFT COLUMN: Stats & Graph */}
          <div className="lg:col-span-8 space-y-8">
             {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white dark:bg-dark-card rounded-xl p-5 shadow-sm border border-gray-200 dark:border-dark-border flex items-center gap-4 hover:shadow-md transition-all">
                    <div className="p-3 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg">
                        <Activity size={24} />
                    </div>
                    <div>
                        <div className="text-2xl font-bold text-slate-900 dark:text-white">{totalSolved}</div>
                        <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Problems Solved</div>
                    </div>
                </div>
                <div className="bg-white dark:bg-dark-card rounded-xl p-5 shadow-sm border border-gray-200 dark:border-dark-border flex items-center gap-4 hover:shadow-md transition-all">
                    <div className="p-3 bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 rounded-lg">
                        <Flame size={24} fill="currentColor" />
                    </div>
                    <div>
                        <div className="text-2xl font-bold text-slate-900 dark:text-white">{profile?.currentStreak || 0}</div>
                        <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Day Streak</div>
                    </div>
                </div>
                <div className="bg-white dark:bg-dark-card rounded-xl p-5 shadow-sm border border-gray-200 dark:border-dark-border flex items-center gap-4 hover:shadow-md transition-all">
                    <div className="p-3 bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 rounded-lg">
                        <Target size={24} />
                    </div>
                    <div>
                        <div className="text-2xl font-bold text-slate-900 dark:text-white">{profile?.maxStreak || 0}</div>
                        <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Max Streak</div>
                    </div>
                </div>
            </div>

            {/* Segmented Graph */}
            <div className="bg-white dark:bg-dark-card rounded-xl shadow-sm border border-gray-200 dark:border-dark-border p-6">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-lg font-bold text-slate-800 dark:text-white">Activity Log</h2>
                    <span className="text-xs font-medium px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-gray-500 dark:text-gray-300">Last 12 Months</span>
                </div>
                <ContributionGraph completedDates={profile?.completedProblems || {}} />
            </div>

            {/* Sheets List */}
            <div>
                <h2 className="text-2xl font-bold mb-6 text-slate-900 dark:text-white">Your Sheets</h2>
                {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {[1,2].map(i => <div key={i} className="h-40 bg-gray-200 dark:bg-dark-border rounded-xl animate-pulse"></div>)}
                </div>
                ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {sheets.map(sheet => {
                    const progress = sheet.total > 0 ? Math.round((sheet.solved / sheet.total) * 100) : 0;
                    return (
                    <Link 
                        key={sheet.id} 
                        to={`/sheet/${sheet.id}`}
                        className="group flex flex-col bg-white dark:bg-dark-card rounded-xl shadow-sm border border-gray-200 dark:border-dark-border overflow-hidden hover:shadow-lg transition-all hover:border-primary-300 dark:hover:border-primary-700"
                    >
                        <div className="p-6 flex-1">
                            <div className="flex justify-between items-start mb-4">
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">{sheet.title}</h3>
                                {progress === 100 && <CheckCircle2 className="text-emerald-500" size={20} />}
                            </div>
                            
                            <div className="space-y-3">
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-500 dark:text-gray-400">Progress</span>
                                    <span className="font-bold text-slate-800 dark:text-white">{progress}%</span>
                                </div>
                                <div className="w-full h-2 bg-gray-100 dark:bg-dark-border rounded-full overflow-hidden">
                                    <div className="h-full bg-gradient-to-r from-primary-500 to-violet-500 dark:from-violet-600 dark:to-fuchsia-500" style={{ width: `${progress}%` }}></div>
                                </div>
                                <div className="text-xs text-slate-400 dark:text-gray-500 pt-1">
                                    {sheet.solved} out of {sheet.total} problems solved
                                </div>
                            </div>
                        </div>
                        <div className="px-6 py-3 bg-gray-50 dark:bg-dark-surface/50 border-t border-gray-100 dark:border-dark-border flex justify-between items-center">
                            <span className="text-xs font-semibold text-slate-500 dark:text-gray-400">Continue Practice</span>
                            <ChevronRight size={16} className="text-slate-400 group-hover:translate-x-1 transition-transform" />
                        </div>
                    </Link>
                    )})}
                    {sheets.length === 0 && (
                        <div className="col-span-full py-12 text-center text-slate-400 bg-white dark:bg-dark-card rounded-xl border border-dashed border-gray-200 dark:border-dark-border">
                            No sheets available.
                        </div>
                    )}
                </div>
                )}
            </div>
          </div>

          {/* RIGHT COLUMN: Creative Features (Badges) */}
          <div className="lg:col-span-4 space-y-6">
             
             {/* New Creative Feature: Badges/Trophies */}
             <div className="bg-white dark:bg-dark-card rounded-xl shadow-sm border border-gray-200 dark:border-dark-border p-6">
                 <h3 className="font-bold text-lg text-slate-800 dark:text-white mb-4 flex items-center gap-2">
                     <Award className="text-yellow-500" /> Habits & Badges
                 </h3>
                 <div className="space-y-3">
                     {badges.map(b => (
                         <div key={b.id} className={`flex items-center gap-4 p-3 rounded-lg border transition-all ${b.earned ? 'bg-primary-50 border-primary-100 dark:bg-primary-900/10 dark:border-primary-900/30' : 'bg-gray-50 border-transparent dark:bg-dark-surface grayscale opacity-60'}`}>
                             <div className={`p-2 rounded-full ${b.earned ? 'bg-white text-primary-600 dark:bg-dark-card dark:text-primary-400 shadow-sm' : 'bg-gray-200 text-gray-400 dark:bg-dark-card'}`}>
                                 <b.icon size={18} />
                             </div>
                             <div>
                                 <div className={`font-bold text-sm ${b.earned ? 'text-slate-900 dark:text-white' : 'text-gray-500'}`}>{b.label}</div>
                                 <div className="text-xs text-gray-500 dark:text-gray-400">{b.desc}</div>
                             </div>
                             {b.earned && <CheckCircle2 size={16} className="text-primary-500 ml-auto" />}
                         </div>
                     ))}
                 </div>
                 {badges.filter(b => b.earned).length === 0 && (
                     <p className="text-xs text-center text-gray-400 mt-4 italic">Start solving to unlock badges!</p>
                 )}
             </div>

             <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
                 <div className="relative z-10">
                     <h3 className="font-bold text-xl mb-2">Platform Stats</h3>
                     <p className="text-indigo-100 text-sm mb-4">Track where you solve most often.</p>
                     {/* Placeholder for platform stats visualization if we had the data pre-calculated */}
                     <div className="flex gap-2">
                         <span className="text-xs bg-white/20 px-2 py-1 rounded">LeetCode</span>
                         <span className="text-xs bg-white/20 px-2 py-1 rounded">GFG</span>
                     </div>
                 </div>
                 <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-white opacity-10 rounded-full blur-3xl"></div>
             </div>
          </div>

      </div>

      <RankModal isOpen={isRankModalOpen} onClose={() => setIsRankModalOpen(false)} currentRankName={rank.name} />
    </div>
  );
}
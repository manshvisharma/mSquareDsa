import React, { useEffect, useState, useMemo, useRef, useLayoutEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../App';
import { getSheetsWithStats } from '../services/dataService';
import { Sheet } from '../types';
import { Award, Zap, ChevronRight, Activity, Flame, CheckCircle2, Trophy, Target, Quote as QuoteIcon, Info, Moon, Sun, Coffee, Calendar, X, Rocket, BarChart3 } from 'lucide-react';

// --- Creative Feature: User Ranks ---
const RANKS = [
  { name: 'Novice', threshold: 0, color: 'text-gray-500', bg: 'bg-gray-100 dark:bg-gray-800', border: 'border-gray-200' },
  { name: 'Script Kiddie', threshold: 10, color: 'text-emerald-500', bg: 'bg-emerald-100 dark:bg-emerald-900/30', border: 'border-emerald-200' },
  { name: 'Byte Juggler', threshold: 25, color: 'text-blue-500', bg: 'bg-blue-100 dark:bg-blue-900/30', border: 'border-blue-200' },
  { name: 'Algorithmist', threshold: 50, color: 'text-indigo-500', bg: 'bg-indigo-100 dark:bg-indigo-900/30', border: 'border-indigo-200' },
  { name: 'Code Ninja', threshold: 100, color: 'text-purple-500', bg: 'bg-purple-100 dark:bg-purple-900/30', border: 'border-purple-200' },
  { name: 'Master Architect', threshold: 200, color: 'text-pink-500', bg: 'bg-pink-100 dark:bg-pink-900/30', border: 'border-pink-200' },
  { name: 'Grandmaster', threshold: 500, color: 'text-orange-500', bg: 'bg-orange-100 dark:bg-orange-900/30', border: 'border-orange-200' }
];

const QUOTES = [
  "First, solve the problem. Then, write the code.",
  "Make it work, make it right, make it fast.",
  "Simplicity is the soul of efficiency.",
  "Code is like humor. When you have to explain it, it’s bad.",
  "Optimism is an occupational hazard of programming."
];

const ContributionGraph = ({ completedProblems }: { completedProblems: Record<string, number> }) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Aggregated problem count per date
  const activityMap = useMemo(() => {
    const counts: Record<string, number> = {};
    Object.values(completedProblems).forEach(ts => {
      if (!ts) return;
      const dateStr = new Date(ts).toLocaleDateString('en-CA'); // YYYY-MM-DD
      counts[dateStr] = (counts[dateStr] || 0) + 1;
    });
    return counts;
  }, [completedProblems]);

  // Generate 12 months of squares, clipping exactly at today
  const monthsData = useMemo(() => {
    const today = new Date();
    const todayStr = today.toLocaleDateString('en-CA');
    const result = [];
    
    for (let i = 11; i >= 0; i--) {
        const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
        const year = d.getFullYear();
        const month = d.getMonth();
        const monthName = d.toLocaleString('default', { month: 'short' });
        
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const startDayOffset = d.getDay(); 
        
        const days = [];
        
        // 1. Padding for days before the 1st
        for(let k=0; k<startDayOffset; k++) {
            days.push({ id: `pad-start-${month}-${k}`, invisible: true });
        }
        
        // 2. Actual Days up to today
        for(let day=1; day<=daysInMonth; day++) {
            const currentDayDate = new Date(year, month, day);
            const dateStr = currentDayDate.toLocaleDateString('en-CA');
            
            // STOP if this day is tomorrow
            if (currentDayDate > today) break;

            const solvedCount = activityMap[dateStr] || 0;

            days.push({
                id: dateStr,
                date: currentDayDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }),
                solvedCount,
                isToday: dateStr === todayStr
            });
        }
        
        // Only add month if it has at least one day
        if (days.length > startDayOffset) {
            result.push({ name: monthName, days });
        }
    }
    return result;
  }, [activityMap]);

  // Smooth Auto-Scroll to Right
  useLayoutEffect(() => {
    const timer = setTimeout(() => {
        if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollLeft = scrollContainerRef.current.scrollWidth;
        }
    }, 150);
    return () => clearTimeout(timer);
  }, [monthsData]);

  return (
    <div ref={scrollContainerRef} className="w-full overflow-x-auto pb-4 custom-scrollbar scroll-smooth">
      <div className="flex gap-4 min-w-max px-1">
          {monthsData.map((month, idx) => (
              <div key={idx} className="flex flex-col gap-2">
                  <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest h-4">{month.name}</span>
                  <div className="grid grid-rows-7 grid-flow-col gap-[4px]">
                      {month.days.map((day) => (
                          <div 
                            key={day.id}
                            title={day.invisible ? '' : `${day.date}: ${day.solvedCount} problems solved`}
                            className={`
                                w-3.5 h-3.5 rounded-[2px] transition-all duration-300 relative group
                                ${day.invisible ? 'opacity-0 pointer-events-none' : ''}
                                ${!day.invisible && day.solvedCount > 0
                                    ? day.solvedCount >= 3 
                                        ? 'bg-emerald-600 shadow-[0_0_6px_rgba(5,150,105,0.4)] scale-110' 
                                        : 'bg-emerald-400'
                                    : !day.invisible 
                                        ? 'bg-gray-200 dark:bg-slate-700 hover:bg-gray-300 dark:hover:bg-slate-600' 
                                        : ''
                                }
                                ${day.isToday && day.solvedCount === 0 ? 'ring-2 ring-primary-500 ring-offset-1 dark:ring-offset-dark-card' : ''}
                            `}
                          >
                             {/* Small dot for today */}
                             {day.isToday && <div className="absolute inset-0 m-auto w-1 h-1 bg-white rounded-full opacity-50"></div>}
                          </div>
                      ))}
                  </div>
              </div>
          ))}
      </div>
       <div className="flex items-center gap-2 mt-4 text-[10px] text-gray-400 justify-end pr-2 border-t border-gray-100 dark:border-gray-800 pt-3 uppercase font-black tracking-widest">
            <span>Less</span>
            <div className="w-3 h-3 bg-gray-200 dark:bg-slate-700 rounded-[2px]"></div>
            <div className="w-3 h-3 bg-emerald-400 rounded-[2px]"></div>
            <div className="w-3 h-3 bg-emerald-600 rounded-[2px]"></div>
            <span>More</span>
      </div>
    </div>
  );
};

const RankModal = ({ isOpen, onClose, currentRankName }: { isOpen: boolean, onClose: () => void, currentRankName: string }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-dark-card w-full max-w-md rounded-2xl shadow-2xl border border-gray-200 dark:border-dark-border overflow-hidden">
                <div className="p-4 border-b border-gray-100 dark:border-dark-border flex justify-between items-center bg-gray-50 dark:bg-dark-surface">
                    <h3 className="font-bold text-lg dark:text-white flex items-center gap-2"><Trophy size={18} className="text-yellow-500"/> Mastery Ranks</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20}/></button>
                </div>
                <div className="p-4 space-y-3 max-h-[60vh] overflow-y-auto custom-scrollbar">
                    {RANKS.map((r) => (
                        <div key={r.name} className={`flex items-center justify-between p-3 rounded-xl border transition-all ${currentRankName === r.name ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 shadow-sm' : 'border-transparent hover:bg-gray-50 dark:hover:bg-dark-surface'}`}>
                            <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shadow-inner ${r.bg} ${r.color}`}>
                                    {r.name[0]}
                                </div>
                                <div>
                                    <div className={`font-bold text-sm ${r.color}`}>{r.name}</div>
                                    <div className="text-[10px] text-gray-400 uppercase font-bold">Requirement</div>
                                </div>
                            </div>
                            <div className="text-right">
                                <div className="font-mono font-black text-slate-800 dark:text-slate-200">{r.threshold}+</div>
                                <div className="text-[10px] text-gray-400 uppercase font-bold tracking-tighter">Solved</div>
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

  const currentRankIndex = RANKS.slice().reverse().findIndex(r => totalSolved >= r.threshold);
  const rank = currentRankIndex !== -1 ? RANKS[RANKS.length - 1 - currentRankIndex] : RANKS[0];
  const nextRank = RANKS[RANKS.length - 1 - currentRankIndex + 1];
  const progressToNext = nextRank 
    ? Math.min(100, Math.round(((totalSolved - rank.threshold) / (nextRank.threshold - rank.threshold)) * 100))
    : 100;

  // Daily Mission Logic
  const dailyTarget = 3;
  const todayStr = new Date().toLocaleDateString('en-CA');
  const problemsToday = useMemo(() => {
    return Object.values(profile?.completedProblems || {}).filter(ts => {
        return ts && new Date(ts).toLocaleDateString('en-CA') === todayStr;
    }).length;
  }, [profile, todayStr]);
  const dailyProgress = Math.min(100, Math.round((problemsToday / dailyTarget) * 100));

  const badges = useMemo(() => {
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
          return d === 0 || d === 6;
      });

      return [
          { id: 'early', icon: Sun, label: 'Early Bird', earned: earlyBird, desc: 'Solved before 9 AM' },
          { id: 'night', icon: Moon, label: 'Night Owl', earned: nightOwl, desc: 'Solved after 10 PM' },
          { id: 'weekend', icon: Coffee, label: 'Weekender', earned: weekendWarrior, desc: 'Solved on a weekend' },
          { id: 'streak', icon: Flame, label: 'Marathoner', earned: (profile?.maxStreak || 0) >= 7, desc: '7+ day streak' },
      ];
  }, [profile]);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good Morning' : hour < 18 ? 'Good Afternoon' : 'Good Evening';

  // Stats Card data
  const statsList = [
    { label: 'Solved', value: totalSolved, icon: Activity, bg: 'bg-blue-50 dark:bg-blue-900/20', text: 'text-blue-600 dark:text-blue-400' },
    { label: 'Streak', value: profile?.currentStreak || 0, icon: Flame, bg: 'bg-orange-50 dark:bg-orange-900/20', text: 'text-orange-600 dark:text-orange-400', fill: true },
    { label: 'Best', value: profile?.maxStreak || 0, icon: Target, bg: 'bg-purple-50 dark:bg-purple-900/20', text: 'text-purple-600 dark:text-purple-400' },
    { label: 'Today', value: problemsToday, icon: BarChart3, bg: 'bg-emerald-50 dark:bg-emerald-900/20', text: 'text-emerald-600 dark:text-emerald-400' }
  ];

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-10">
      
      {/* 1. Enhanced Header */}
      <div className="flex flex-col md:flex-row justify-between items-center md:items-end gap-6 pb-6 border-b border-gray-200 dark:border-dark-border">
          <div className="text-center md:text-left">
              <div className="flex items-center justify-center md:justify-start gap-3 mb-1">
                <h1 className="text-4xl font-black tracking-tight text-slate-900 dark:text-white">
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-600 to-violet-600 dark:from-primary-400 dark:to-violet-400">
                        {greeting}, {profile?.displayName?.split(' ')[0] || 'Coder'}
                    </span>
                </h1>
                <div className={`hidden sm:flex items-center px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border shadow-sm ${rank.bg} ${rank.color} ${rank.border}`}>
                    <Trophy size={10} className="mr-1.5" /> {rank.name}
                </div>
              </div>
              <div className="flex items-center justify-center md:justify-start gap-2 text-sm text-slate-400 dark:text-gray-500 italic">
                  <QuoteIcon size={14} className="transform scale-x-[-1]" />
                  {quote}
              </div>
          </div>
          
          <div className="flex items-center gap-4 bg-white dark:bg-dark-card px-5 py-3 rounded-2xl shadow-sm border border-gray-100 dark:border-dark-border">
               <div className={`p-3 rounded-xl shadow-inner ${rank.bg} ${rank.color}`}>
                   <Rocket size={24} />
               </div>
               <div>
                   <div className="flex items-center gap-2">
                        <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Mastery Level</div>
                        <button onClick={() => setIsRankModalOpen(true)} className="text-gray-400 hover:text-primary-500 transition-colors">
                            <Info size={14} />
                        </button>
                   </div>
                   <div className={`text-xl font-black ${rank.color}`}>{rank.name}</div>
                   {nextRank && (
                       <div className="w-36 h-2 bg-gray-100 dark:bg-slate-800 rounded-full mt-2 overflow-hidden border border-gray-200 dark:border-slate-700">
                           <div className="h-full bg-gradient-to-r from-primary-500 to-violet-500 transition-all duration-1000 shadow-[0_0_8px_rgba(99,102,241,0.4)]" style={{width: `${progressToNext}%`}}></div>
                       </div>
                   )}
               </div>
          </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          <div className="lg:col-span-8 space-y-8">
             {/* Main Stats Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {statsList.map((stat, i) => (
                    <div key={i} className="bg-white dark:bg-dark-card rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-dark-border group hover:border-primary-200 transition-all hover:-translate-y-1">
                        <div className={`mb-3 p-2 w-fit rounded-lg ${stat.bg} ${stat.text} group-hover:scale-110 transition-transform`}>
                            <stat.icon size={20} fill={stat.fill ? "currentColor" : "none"} />
                        </div>
                        <div className="text-2xl font-black text-slate-800 dark:text-white leading-none">{stat.value}</div>
                        <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1.5">{stat.label}</div>
                    </div>
                ))}
            </div>

            {/* Smart Activity Log (Dynamic clipping applied) */}
            <div className="bg-white dark:bg-dark-card rounded-2xl shadow-sm border border-gray-100 dark:border-dark-border p-6">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h2 className="text-lg font-black text-slate-800 dark:text-white">Activity Log</h2>
                        <p className="text-xs text-gray-400 font-medium italic">Hover squares for details • Last box is Today</p>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1 bg-gray-50 dark:bg-dark-surface rounded-full text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-tighter">
                        <Calendar size={12} /> Live Tracking
                    </div>
                </div>
                <ContributionGraph completedProblems={profile?.completedProblems || {}} />
            </div>

            {/* Sheets List */}
            <div>
                <div className="flex items-center justify-between mb-6 px-1">
                    <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight uppercase">Your Roadmap</h2>
                    <span className="text-xs font-bold text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20 px-3 py-1 rounded-full">{sheets.length} Sheets</span>
                </div>
                {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {[1,2].map(i => <div key={i} className="h-44 bg-gray-200 dark:bg-dark-border rounded-2xl animate-pulse"></div>)}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {sheets.map(sheet => {
                            const progress = sheet.total > 0 ? Math.round((sheet.solved / sheet.total) * 100) : 0;
                            return (
                                <Link 
                                    key={sheet.id} 
                                    to={`/sheet/${sheet.id}`}
                                    className="group flex flex-col bg-white dark:bg-dark-card rounded-2xl shadow-sm border border-gray-100 dark:border-dark-border overflow-hidden hover:shadow-xl transition-all hover:border-primary-400"
                                >
                                    <div className="p-6 flex-1">
                                        <div className="flex justify-between items-start mb-4">
                                            <h3 className="text-xl font-bold text-slate-900 dark:text-white group-hover:text-primary-600 transition-colors">{sheet.title}</h3>
                                            {progress === 100 ? (
                                                <div className="bg-emerald-100 dark:bg-emerald-900/30 p-1.5 rounded-full text-emerald-600">
                                                    <CheckCircle2 size={18} />
                                                </div>
                                            ) : (
                                                <div className="text-slate-300 dark:text-slate-600 group-hover:text-primary-300 transition-colors">
                                                    <ChevronRight size={22} />
                                                </div>
                                            )}
                                        </div>
                                        <div className="space-y-4">
                                            <div className="flex justify-between items-end">
                                                <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Mastery</div>
                                                <div className="font-mono font-black text-primary-600 text-lg">{progress}%</div>
                                            </div>
                                            <div className="w-full h-3 bg-gray-100 dark:bg-dark-border rounded-full overflow-hidden p-[2px] border border-gray-50 dark:border-slate-800">
                                                <div 
                                                    className="h-full bg-gradient-to-r from-primary-500 to-violet-600 rounded-full transition-all duration-700 shadow-[0_0_10px_rgba(99,102,241,0.3)] shimmer-bg" 
                                                    style={{ width: `${progress}%` }}
                                                />
                                            </div>
                                            <div className="flex justify-between text-[11px] font-bold text-slate-400">
                                                <span>{sheet.solved} Solved</span>
                                                <span>{sheet.total - sheet.solved} Remaining</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="px-6 py-3 bg-gray-50 dark:bg-dark-surface/50 border-t border-gray-100 dark:border-dark-border flex justify-center">
                                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 group-hover:text-primary-600 transition-colors">Open Practice Sheet</span>
                                    </div>
                                </Link>
                            )
                        })}
                    </div>
                )}
            </div>
          </div>

          <div className="lg:col-span-4 space-y-6">
             {/* 2. Daily Mission Card */}
             <div className="bg-gradient-to-br from-slate-900 to-indigo-900 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden group">
                 <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-2.5 bg-white/10 rounded-xl backdrop-blur-md">
                            <Target size={24} className="text-orange-400" />
                        </div>
                        <div>
                            <h3 className="font-black text-lg">Daily Mission</h3>
                            <p className="text-[10px] text-indigo-300 font-bold uppercase tracking-widest">Target: {dailyTarget} Problems</p>
                        </div>
                    </div>
                    <div className="space-y-4">
                        <div className="flex justify-between items-end px-1">
                            <span className="text-3xl font-black">{problemsToday} <span className="text-indigo-400 text-sm font-bold">/ {dailyTarget}</span></span>
                            <span className="text-xs font-bold text-indigo-300">{dailyProgress}% Done</span>
                        </div>
                        <div className="h-3 w-full bg-white/10 rounded-full overflow-hidden p-[2px]">
                            <div 
                                className={`h-full bg-gradient-to-r from-orange-400 to-rose-500 rounded-full shadow-[0_0_15px_rgba(251,146,60,0.4)] transition-all duration-1000 ${dailyProgress === 100 ? 'animate-pulse-slow' : ''}`}
                                style={{ width: `${dailyProgress}%` }}
                            />
                        </div>
                        <p className="text-[11px] text-indigo-200/70 font-medium italic text-center pt-2">
                            {problemsToday >= dailyTarget ? "Goal achieved! You're crushing it." : "Small steps every day lead to giant leaps."}
                        </p>
                    </div>
                 </div>
                 <div className="absolute -bottom-10 -right-10 w-44 h-44 bg-primary-500/20 rounded-full blur-3xl group-hover:scale-125 transition-transform duration-700"></div>
             </div>
             
             {/* 3. Mastery Badges */}
             <div className="bg-white dark:bg-dark-card rounded-2xl shadow-sm border border-gray-100 dark:border-dark-border p-6">
                 <h3 className="font-black text-lg text-slate-800 dark:text-white mb-6 flex items-center gap-2 uppercase tracking-tight">
                     <Award className="text-yellow-500" /> Mastery Badges
                 </h3>
                 <div className="space-y-4">
                     {badges.map(b => (
                         <div key={b.id} className={`flex items-center gap-4 p-3 rounded-xl border transition-all duration-300 ${b.earned ? 'bg-primary-50 border-primary-100 dark:bg-primary-900/10 dark:border-primary-900/30' : 'bg-gray-50 border-transparent dark:bg-dark-surface grayscale opacity-50'}`}>
                             <div className={`p-2.5 rounded-xl ${b.earned ? 'bg-white text-primary-600 dark:bg-dark-card dark:text-primary-400 shadow-sm border border-primary-100' : 'bg-gray-200 text-gray-400 dark:bg-dark-card'}`}>
                                 <b.icon size={20} />
                             </div>
                             <div className="flex-1">
                                 <div className={`font-black text-sm tracking-tight ${b.earned ? 'text-slate-900 dark:text-white' : 'text-gray-500'}`}>{b.label}</div>
                                 <div className="text-[10px] text-gray-500 dark:text-gray-400 font-bold uppercase">{b.desc}</div>
                             </div>
                             {b.earned && (
                                <div className="p-1 bg-emerald-100 dark:bg-emerald-900/30 rounded-full text-emerald-600">
                                    <CheckCircle2 size={14} />
                                </div>
                             )}
                         </div>
                     ))}
                 </div>
             </div>
          </div>
      </div>
      <RankModal isOpen={isRankModalOpen} onClose={() => setIsRankModalOpen(false)} currentRankName={rank.name} />
    </div>
  );
}
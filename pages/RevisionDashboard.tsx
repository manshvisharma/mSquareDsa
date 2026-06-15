import React, { useMemo, useState } from 'react';
import { useAuth } from '../App';
import { RevisionData } from '../types';
import { Link } from 'react-router-dom';
import { CheckCircle, Clock, RotateCcw, AlertTriangle, Play, CheckSquare, FastForward, CalendarDays, ExternalLink, Calendar as CalendarIcon, RefreshCw, ChevronLeft, ChevronRight, X, Search, Flame, Trophy, Undo, Folder } from 'lucide-react';
import confetti from 'canvas-confetti';
import { doc, getDoc, setDoc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { COLLECTIONS } from '../constants';
import { PlatformIcon } from '../components/PlatformIcon';

const REVISION_SCHEDULE = [1, 3, 7, 15, 30];

export default function RevisionDashboard() {
  const { profile, user, refreshProfile } = useAuth();
  const [activeTab, setActiveTab] = useState<'pending' | 'upcoming' | 'missed' | 'completed' | 'calendar'>('pending');

  const [activeConfirmResetRev, setActiveConfirmResetRev] = useState<RevisionData | null>(null);
  const [activeConfirmMarkRev, setActiveConfirmMarkRev] = useState<RevisionData | null>(null);
  const [showStreakModal, setShowStreakModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const streakInfo = useMemo(() => {
    if (!profile) return { current: 0, max: 0, weekData: [] };
    const current = profile.currentStreak || 0;
    const max = profile.maxStreak || 0;

    const completedDates = new Set<number>();
    
    Object.values(profile.completedProblems || {}).forEach(ts => {
      completedDates.add(new Date(ts).setHours(0,0,0,0));
    });

    Object.values(profile.revisions || {}).forEach(rev => {
      rev.revisionHistory?.forEach(ts => {
        completedDates.add(new Date(ts).setHours(0,0,0,0));
      });
    });

    const weekData = [];
    const today = new Date().setHours(0,0,0,0);
    const startOfWeek = new Date();
    startOfWeek.setDate(startOfWeek.getDate() - new Date().getDay()); // Sunday
    
    for(let i=0; i<7; i++) {
        const d = new Date(startOfWeek);
        d.setDate(d.getDate() + i);
        const dMs = d.setHours(0,0,0,0);
        
        let status = 'upcoming'; 
        if (dMs < today) {
            status = completedDates.has(dMs) ? 'success' : 'fail';
        } else if (dMs === today) {
            status = completedDates.has(dMs) ? 'success' : 'today';
        }

        weekData.push({
            name: ['S','M','T','W','T','F','S'][i],
            status: status
        });
    }

    return { current, max, weekData };
  }, [profile]);

  const handleShiftDay = async (rev: RevisionData) => {
    if (!user || !rev.nextRevisionDate) return;
    
    const updatedRev: RevisionData = {
      ...rev,
      nextRevisionDate: rev.nextRevisionDate + 24 * 60 * 60 * 1000
    };
    
    const userRef = doc(db, COLLECTIONS.USERS, user.uid);
    await setDoc(userRef, {
      revisions: {
        [rev.problemId]: updatedRev
      }
    }, { merge: true });

    refreshProfile();
  };

  const revisions = useMemo(() => {
    return Object.values(profile?.revisions || {});
  }, [profile?.revisions]);

  const todayMidnight = new Date();
  todayMidnight.setHours(0, 0, 0, 0);
  const TODAY_MS = todayMidnight.getTime();
  const TOMORROW_MS = TODAY_MS + 24 * 60 * 60 * 1000;

  const [activeCustomScheduleRev, setActiveCustomScheduleRev] = useState<RevisionData | null>(null);
  const [customDays, setCustomDays] = useState<number>(30);

  const handleCustomSchedule = async () => {
    if (!user || !activeCustomScheduleRev) return;
    const baseDate = activeCustomScheduleRev.lastRevisionDate || Date.now();
    const nextDate = baseDate + customDays * 24 * 60 * 60 * 1000;
    
    const updatedRev: RevisionData = {
      ...activeCustomScheduleRev,
      futureReviewScheduled: true,
      futureReviewDate: nextDate,
      nextRevisionDate: nextDate,
      revisionCycleCompleted: false // To bring it back to pending/upcoming
    };
    
    const userRef = doc(db, COLLECTIONS.USERS, user.uid);
    await setDoc(userRef, {
      revisions: {
        [activeCustomScheduleRev.problemId]: updatedRev
      }
    }, { merge: true });

    refreshProfile();
    setActiveCustomScheduleRev(null);
  };

  const { pending, upcoming, missed, completed } = useMemo(() => {
    const p: RevisionData[] = [];
    const u: RevisionData[] = [];
    const m: RevisionData[] = [];
    const c: RevisionData[] = [];

    revisions.forEach(rev => {
      if (rev.revisionCycleCompleted && !rev.futureReviewScheduled) {
        c.push(rev);
      } else if (rev.nextRevisionDate) {
        const nextRevDate = new Date(rev.nextRevisionDate);
        nextRevDate.setHours(0,0,0,0);
        const nextRevMS = nextRevDate.getTime();
        
        if (nextRevMS < TODAY_MS) {
          m.push(rev);
        } else if (nextRevMS === TODAY_MS) {
          p.push(rev);
        } else {
          u.push(rev);
        }
      }
    });

    p.sort((a, b) => (a.nextRevisionDate || 0) - (b.nextRevisionDate || 0));
    m.sort((a, b) => (a.nextRevisionDate || 0) - (b.nextRevisionDate || 0));
    u.sort((a, b) => (a.nextRevisionDate || 0) - (b.nextRevisionDate || 0));
    c.sort((a, b) => (b.lastRevisionDate || 0) - (a.lastRevisionDate || 0));

    return { pending: p, upcoming: u, missed: m, completed: c };
  }, [revisions, TODAY_MS]);

  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  const firstDayOfWeek = startOfMonth.getDay();

  const revsByDate = useMemo(() => {
      const map = new Map<string, RevisionData[]>();
      revisions.forEach(rev => {
          if (rev.nextRevisionDate && !rev.revisionCycleCompleted) {
              const dateObj = new Date(rev.nextRevisionDate);
              const dateKey = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
              if (!map.has(dateKey)) map.set(dateKey, []);
              map.get(dateKey)!.push(rev);
          }
      });
      return map;
  }, [revisions]);

  const todayDateObj = new Date();
  const todayISO = `${todayDateObj.getFullYear()}-${String(todayDateObj.getMonth() + 1).padStart(2, '0')}-${String(todayDateObj.getDate()).padStart(2, '0')}`;
  
  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const handleMarkRevised = async (rev: RevisionData) => {
    if (!user) return;
    const now = Date.now();
    const userRef = doc(db, COLLECTIONS.USERS, user.uid);
    
    let isCompleted = false;
    let nextDate: number | null = null;

    if (rev.revisionStage + 1 >= REVISION_SCHEDULE.length) {
      isCompleted = true;
    } else {
      const daysToAdd = REVISION_SCHEDULE[rev.revisionStage + 1];
      nextDate = now + daysToAdd * 24 * 60 * 60 * 1000;
    }

    const updatedRev: RevisionData = {
      ...rev,
      revisionStage: rev.revisionStage + 1,
      revisionHistory: [...(rev.revisionHistory || []), now],
      lastRevisionDate: now,
      nextRevisionDate: nextDate,
      timesRevised: (rev.timesRevised || 0) + 1,
      revisionCycleCompleted: isCompleted,
      futureReviewScheduled: false
    };

    await setDoc(userRef, {
      revisions: {
        [rev.problemId]: updatedRev
      }
    }, { merge: true });

    refreshProfile();
    confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.6 },
        colors: ['#10b981', '#3b82f6', '#f59e0b']
    });
  };

  const handleResetRevision = async (rev: RevisionData) => {
    if (!user) return;
    
    const now = Date.now();
    const nextDate = now + REVISION_SCHEDULE[0] * 24 * 60 * 60 * 1000;
    
    const updatedRev: RevisionData = {
      ...rev,
      revisionStage: 0,
      nextRevisionDate: nextDate,
      timesReset: (rev.timesReset || 0) + 1,
      revisionCycleCompleted: false,
      futureReviewScheduled: false
    };
    
    const userRef = doc(db, COLLECTIONS.USERS, user.uid);
    await setDoc(userRef, {
      revisions: {
        [rev.problemId]: updatedRev
      }
    }, { merge: true });

    refreshProfile();
  };

  const RevisionCard = ({ rev }: { rev: RevisionData }) => {
    const nextDateStr = rev.nextRevisionDate ? new Date(rev.nextRevisionDate).toLocaleDateString(undefined, {month: 'short', day: 'numeric', year: 'numeric'}) : 'N/A';
    
    let statusColor = "text-gray-500 border-gray-200 bg-gray-50 dark:bg-dark-surface dark:border-dark-border";
    if (rev.revisionCycleCompleted) statusColor = "text-emerald-600 border-emerald-200 bg-emerald-50 dark:bg-emerald-900/20 dark:border-emerald-800";
    else if (rev.nextRevisionDate && rev.nextRevisionDate < TODAY_MS) statusColor = "text-red-500 border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800";
    else if (rev.nextRevisionDate && new Date(rev.nextRevisionDate).setHours(0,0,0,0) === TODAY_MS) statusColor = "text-blue-600 border-blue-200 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-800";
    else statusColor = "text-purple-600 border-purple-200 bg-purple-50 dark:bg-purple-900/20 dark:border-purple-800";

    const isFuture = rev.nextRevisionDate ? new Date(rev.nextRevisionDate).setHours(0,0,0,0) > TODAY_MS : false;

    return (
      <div className={`p-5 rounded-2xl border flex flex-col justify-between transition-all hover:shadow-md ${statusColor}`}>
        <div>
          <div className="flex justify-between items-start mb-2">
            <h3 className="font-bold text-lg dark:text-white line-clamp-2" title={rev.problemTitle}>{rev.problemTitle}</h3>
            {rev.platform && <PlatformIcon platform={rev.platform} className="w-5 h-5 flex-shrink-0 ml-2" />}
          </div>
          
          <div className="flex flex-wrap gap-2 mb-3">
             <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded bg-black/5 dark:bg-white/10 dark:text-gray-300">
               {rev.sheetName}
             </span>
             <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded bg-black/5 dark:bg-white/10 dark:text-gray-300">
               {rev.topicName}
             </span>
          </div>

          <div className="w-full bg-black/10 dark:bg-white/10 rounded-full h-1.5 mb-3 overflow-hidden">
            <div className={`h-1.5 rounded-full ${rev.revisionCycleCompleted ? 'bg-emerald-500' : 'bg-primary-500'}`} style={{ width: `${rev.revisionCycleCompleted ? 100 : (rev.revisionStage / REVISION_SCHEDULE.length) * 100}%` }}></div>
          </div>

          <div className="flex items-center gap-4 text-xs font-medium dark:text-gray-400 mb-4">
             {rev.revisionCycleCompleted ? (
               <div className="flex items-center text-emerald-600 dark:text-emerald-400">
                 <CheckCircle size={14} className="mr-1"/> Completed
               </div>
             ) : (
               <>
                 <div className="flex items-center">
                   <Clock size={14} className="mr-1"/> Stage {rev.revisionStage + 1}/{REVISION_SCHEDULE.length}
                 </div>
                 <div className="flex items-center">
                   <CalendarIcon size={14} className="mr-1"/> 
                   {rev.nextRevisionDate && rev.nextRevisionDate < TODAY_MS ? (
                     <span className="text-red-500 font-bold">Missed</span>
                   ) : (
                     nextDateStr
                   )}
                 </div>
               </>
             )}
          </div>
        </div>

        <div className="flex items-center gap-2 mt-auto pt-4 border-t border-black/5 dark:border-white/10">
           {rev.url && (
             <a href={rev.url} target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border hover:bg-gray-50 dark:hover:bg-dark-surface transition-colors flex-shrink-0" title="Open Problem">
               <ExternalLink size={16} className="text-gray-600 dark:text-gray-300" />
             </a>
           )}
           
           {!rev.revisionCycleCompleted && (
             <button 
               onClick={() => {
                   if(isFuture) {
                       window.alert("Cannot mark as revised before the due date!");
                   } else {
                       setActiveConfirmMarkRev(rev);
                   }
               }}
               title={isFuture ? "Too early to revise" : "Mark as Revised"}
               className={`flex-1 py-2 px-3 rounded-lg text-sm font-bold transition-colors flex items-center justify-center shadow-sm border ${isFuture ? 'bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-600 border-gray-200 dark:border-gray-700 cursor-not-allowed' : 'bg-white dark:bg-dark-card border-gray-200 dark:border-dark-border hover:border-emerald-500 hover:text-emerald-600 dark:text-gray-200 dark:hover:text-emerald-400 dark:hover:border-emerald-500 cursor-pointer'}`}
             >
               <CheckSquare size={16} className="mr-2" /> Mark Revised
             </button>
           )}

           {rev.revisionCycleCompleted && (
             <button 
               onClick={() => setActiveCustomScheduleRev(rev)}
               className="flex-1 py-2 px-3 bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border hover:border-blue-500 hover:text-blue-600 dark:text-gray-200 dark:hover:text-blue-400 dark:hover:border-blue-500 rounded-lg text-sm font-bold transition-colors flex items-center justify-center shadow-sm"
             >
               <CalendarDays size={16} className="mr-2" /> Schedule Review
             </button>
           )}

           {rev.nextRevisionDate && rev.nextRevisionDate < TODAY_MS && !rev.revisionCycleCompleted && (
             <button 
               onClick={() => handleShiftDay(rev)}
               className="p-2 rounded-lg bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border hover:bg-orange-50 hover:text-orange-600 hover:border-orange-200 dark:hover:bg-orange-900/40 dark:hover:border-orange-800 dark:text-gray-300 dark:hover:text-orange-400 transition-colors flex-shrink-0" title="Shift 1 Day Ahead"
             >
               <FastForward size={16} />
             </button>
           )}

           <button 
             onClick={() => setActiveConfirmResetRev(rev)}
             className="p-2 rounded-lg bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border hover:bg-red-50 hover:text-red-600 hover:border-red-200 dark:hover:bg-red-900/40 dark:hover:border-red-800 dark:text-gray-300 dark:hover:text-red-400 transition-colors flex-shrink-0" title="Reset Revision Cycle"
           >
             <RotateCcw size={16} />
           </button>
        </div>
      </div>
    );
  };

  const getTabClass = (tab: string) => {
    return activeTab === tab 
      ? 'bg-primary-600 text-white shadow-md border-primary-500' 
      : 'bg-white dark:bg-dark-card text-gray-500 hover:bg-gray-50 dark:hover:bg-dark-surface border-gray-200 dark:border-dark-border';
  };

  const filterBySearch = (list: RevisionData[]) => {
      if (!searchQuery) return list;
      const lower = searchQuery.toLowerCase();
      return list.filter(r => r.problemTitle.toLowerCase().includes(lower) || r.topicName.toLowerCase().includes(lower) || r.sheetName.toLowerCase().includes(lower));
  }

  const renderGroupedRevisions = (revList: RevisionData[], emptyMessage: React.ReactNode) => {
      const filtered = filterBySearch(revList);
      if (filtered.length === 0) return emptyMessage;

      const grouped: Record<string, Record<string, RevisionData[]>> = {};
      filtered.forEach(rev => {
        if (!grouped[rev.sheetName]) grouped[rev.sheetName] = {};
        if (!grouped[rev.sheetName][rev.topicName]) grouped[rev.sheetName][rev.topicName] = [];
        grouped[rev.sheetName][rev.topicName].push(rev);
      });

      return (
          <div className="col-span-full">
              {Object.entries(grouped).map(([sheetName, topics]) => (
                <div key={sheetName} className="mb-10 w-full animate-in fade-in slide-in-from-bottom-4 col-span-full bg-white dark:bg-dark-card p-6 rounded-2xl border border-gray-200 dark:border-dark-border shadow-sm">
                    <h2 className="text-xl font-black text-slate-800 dark:text-white mb-6 uppercase tracking-widest border-b border-gray-100 dark:border-dark-border pb-3 flex items-center gap-2">
                        <Folder size={20} className="text-primary-500" /> {sheetName}
                    </h2>
                    {Object.entries(topics).map(([topicName, problems]) => (
                        <div key={topicName} className="mb-8 last:mb-0">
                            <h3 className="text-sm font-bold text-slate-500 dark:text-gray-400 mb-4 flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600"></span> {topicName}
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                                {problems.map(rev => <RevisionCard key={rev.problemId} rev={rev} />)}
                            </div>
                        </div>
                    ))}
                </div>
              ))}
          </div>
      );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-300 pb-12">
      
      {/* Header Stats */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-white dark:bg-dark-card p-6 rounded-2xl border border-gray-200 dark:border-dark-border shadow-sm">
         <div>
            <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white mb-2 flex items-center gap-3">
              <RefreshCw className="text-primary-600" />
              Spaced Revision
            </h1>
            <p className="text-slate-500 dark:text-gray-400 font-medium max-w-2xl">
              Master what you've learned. The system schedules reviews at increasing intervals (Day 1, 3, 7, 15, 30) for optimal retention.
            </p>
         </div>

         <div className="flex gap-4 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
            <button onClick={() => setShowStreakModal(true)} className="bg-orange-50 hover:bg-orange-100 transition-colors dark:bg-orange-900/20 px-6 py-4 rounded-xl border border-orange-200 dark:border-orange-800/50 flex flex-col justify-center min-w-[120px] text-center items-center group">
              <div className="flex items-center text-[10px] font-black uppercase tracking-widest text-orange-600 dark:text-orange-400 mb-1">
                 <Flame size={12} className="mr-1 group-hover:scale-110 transition-transform"/> Streak
              </div>
              <div className="text-3xl font-black text-orange-600 dark:text-orange-400 leading-none">{streakInfo.current}</div>
            </button>
            <div className="bg-primary-50 dark:bg-primary-900/20 px-6 py-4 rounded-xl border border-primary-100 dark:border-primary-800/50 flex flex-col justify-center min-w-[120px] text-center items-center">
              <div className="text-[10px] font-black uppercase tracking-widest text-primary-600 dark:text-primary-400 mb-1 w-full text-center">Due Today</div>
              <div className="text-3xl font-black text-slate-900 dark:text-white leading-none">{pending.length}</div>
            </div>
            {(missed.length > 0) && (
              <div className="bg-red-50 dark:bg-red-900/20 px-6 py-4 rounded-xl border border-red-100 dark:border-red-800/50 flex flex-col justify-center min-w-[120px] text-center items-center">
                <div className="text-[10px] font-black uppercase tracking-widest text-red-600 dark:text-red-400 mb-1 w-full text-center">Missed</div>
                <div className="text-3xl font-black text-red-600 dark:text-red-400 leading-none">{missed.length}</div>
              </div>
            )}
         </div>
      </div>

      {/* Tabs and Search */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex flex-wrap gap-3 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
            <button onClick={() => setActiveTab('pending')} className={`px-5 py-2.5 rounded-xl text-sm font-black uppercase tracking-wider transition-all border shrink-0 ${getTabClass('pending')}`}>
              Due Today ({pending.length})
            </button>
            <button onClick={() => setActiveTab('missed')} className={`px-5 py-2.5 rounded-xl text-sm font-black uppercase tracking-wider transition-all border shrink-0 ${getTabClass('missed')}`}>
              Missed ({missed.length})
            </button>
            <button onClick={() => setActiveTab('upcoming')} className={`px-5 py-2.5 rounded-xl text-sm font-black uppercase tracking-wider transition-all border shrink-0 ${getTabClass('upcoming')}`}>
              Upcoming ({upcoming.length})
            </button>
            <button onClick={() => setActiveTab('completed')} className={`px-5 py-2.5 rounded-xl text-sm font-black uppercase tracking-wider transition-all border shrink-0 ${getTabClass('completed')}`}>
              Completed ({completed.length})
            </button>
            <button onClick={() => setActiveTab('calendar')} className={`px-5 py-2.5 rounded-xl text-sm font-black uppercase tracking-wider transition-all border shrink-0 ${getTabClass('calendar')}`}>
              Calendar
            </button>
          </div>
          
          {activeTab !== 'calendar' && (
              <div className="relative w-full md:w-64">
                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input 
                  type="text" 
                  placeholder="Search problem or topic..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-card text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-primary-500 transition-all font-medium"
                />
              </div>
          )}
      </div>

      {/* Selected Tab Content */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {activeTab === 'pending' && renderGroupedRevisions(pending, (
          <div className="col-span-full py-16 text-center text-slate-500 animate-in fade-in zoom-in-95">
             <CheckCircle size={48} className="mx-auto text-emerald-400 mb-4 opacity-50"/>
             <h3 className="text-xl font-bold dark:text-gray-300">You're all caught up!</h3>
             <p className="mt-2 text-sm max-w-sm mx-auto">No revisions scheduled for today. {searchQuery && "Or no pending problem matches your search."}</p>
          </div>
        ))}

        {activeTab === 'missed' && renderGroupedRevisions(missed, (
          <div className="col-span-full py-16 text-center text-slate-500 animate-in fade-in zoom-in-95">
             <h3 className="text-xl font-bold dark:text-gray-300">Great consistency!</h3>
             <p className="mt-2 text-sm max-w-sm mx-auto">You have zero missed revisions. Keep up the good momentum! {searchQuery && "Or no missed problem matches your search."}</p>
          </div>
        ))}

        {activeTab === 'upcoming' && renderGroupedRevisions(upcoming, (
          <div className="col-span-full py-16 text-center text-slate-500 animate-in fade-in zoom-in-95">
             <h3 className="text-xl font-bold dark:text-gray-300">No upcoming revisions</h3>
          </div>
        ))}

        {activeTab === 'completed' && renderGroupedRevisions(completed, (
          <div className="col-span-full py-16 text-center text-slate-500 animate-in fade-in zoom-in-95">
             <h3 className="text-xl font-bold dark:text-gray-300">No completed cycles yet</h3>
             <p className="mt-2 text-sm max-w-sm mx-auto">It takes about 30 days to complete a full revision cycle.</p>
          </div>
        ))}
      </div>

      {activeTab === 'calendar' && (
        <div className="bg-white dark:bg-dark-card rounded-2xl shadow-sm border border-gray-200 dark:border-dark-border p-6 mt-6 animate-in fade-in zoom-in-95">
            <div className="flex justify-between items-center mb-6">
                <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))} className="p-2 border rounded-xl hover:bg-gray-50 dark:hover:bg-dark-surface dark:border-dark-border text-gray-700 dark:text-gray-300 transition-colors">
                    <ChevronLeft size={20} />
                </button>
                <div className="text-lg font-bold text-slate-900 dark:text-white">
                    {currentDate.toLocaleDateString('default', { month: 'long', year: 'numeric' })}
                </div>
                <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))} className="p-2 border rounded-xl hover:bg-gray-50 dark:hover:bg-dark-surface dark:border-dark-border text-gray-700 dark:text-gray-300 transition-colors">
                    <ChevronRight size={20} />
                </button>
            </div>

            <div className="grid grid-cols-7 gap-2 mb-2">
                {daysOfWeek.map(d => (
                    <div key={d} className="text-center text-xs font-bold text-gray-500 uppercase">{d}</div>
                ))}
            </div>

            <div className="grid grid-cols-7 gap-2">
                {[...Array(firstDayOfWeek)].map((_, i) => <div key={`empty-${i}`} />)}
                {[...Array(daysInMonth)].map((_, i) => {
                    const day = i + 1;
                    const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
                    const dateISO = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
                    const items = revsByDate.get(dateISO) || [];
                    const isToday = dateISO === todayISO;
                    
                    const isPast = date < new Date(todayDateObj.getFullYear(), todayDateObj.getMonth(), todayDateObj.getDate());
                    
                    let bgClass = "bg-gray-50 dark:bg-dark-surface";
                    let textClass = "text-slate-700 dark:text-gray-300";

                    if (items.length > 0) {
                        if (isPast) {
                            bgClass = "bg-red-100 hover:bg-red-200 dark:bg-red-900/30 dark:hover:bg-red-900/50 cursor-pointer border border-red-200 dark:border-red-800/50";
                            textClass = "text-red-700 dark:text-red-400 font-bold";
                        } else {
                            bgClass = "bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:hover:bg-emerald-900/50 cursor-pointer border border-emerald-200 dark:border-emerald-800/50";
                            textClass = "text-emerald-700 dark:text-emerald-400 font-bold";
                        }
                    }

                    if (isToday) {
                        bgClass += " ring-2 ring-primary-500 ring-offset-2 dark:ring-offset-dark-card";
                    }

                    return (
                        <div 
                            key={day} 
                            onClick={() => { if (items.length > 0) setSelectedDate(date) }}
                            className={`h-24 p-2 rounded-xl flex flex-col justify-between transition-colors ${bgClass}`}
                        >
                            <span className={`text-sm ${textClass}`}>{day}</span>
                            {items.length > 0 && (
                                <span className={`text-xs px-2 py-0.5 rounded-md inline-block w-fit bg-black/5 dark:bg-white/10 ${textClass}`}>
                                    {items.length} items
                                </span>
                            )}
                        </div>
                    );
                })}
            </div>

            {selectedDate && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setSelectedDate(null)}>
                    <div className="bg-white dark:bg-dark-card rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
                        <div className="p-5 border-b border-gray-100 dark:border-dark-border flex justify-between items-center">
                            <h3 className="text-xl font-bold dark:text-white">
                                Revisions for {selectedDate.toLocaleDateString()}
                            </h3>
                            <button onClick={() => setSelectedDate(null)} className="p-2 border border-gray-200 dark:border-dark-border rounded-xl text-gray-500 hover:bg-gray-50 dark:hover:bg-dark-surface">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-5 overflow-y-auto space-y-4 custom-scrollbar">
                            {(revsByDate.get(`${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`) || []).map(rev => (
                                <RevisionCard key={rev.problemId} rev={rev} />
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
      )}

      {/* Confirm Reset Modal */}
      {activeConfirmResetRev && (
        <div className="fixed inset-0 bg-black/60 z-50 backdrop-blur-sm flex justify-center items-center p-4">
          <div className="bg-white dark:bg-dark-card w-full max-w-sm rounded-2xl shadow-2xl p-6 border border-gray-200 dark:border-dark-border animate-in zoom-in-95">
            <h3 className="text-xl font-bold mb-2 dark:text-white">Restart Revision?</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 font-medium">Are you sure you want to restart the scheduled cycle for <strong>{activeConfirmResetRev.problemTitle}</strong>? The next revision will be reset to tomorrow.</p>
            
            <div className="flex gap-3 pt-4 border-t border-gray-100 dark:border-dark-border">
              <button 
                onClick={() => setActiveConfirmResetRev(null)} 
                className="flex-1 py-2.5 rounded-xl font-bold bg-gray-100 dark:bg-dark-surface hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors dark:text-gray-300"
              >
                Cancel
              </button>
              <button 
                onClick={() => {
                   handleResetRevision(activeConfirmResetRev);
                   setActiveConfirmResetRev(null);
                }} 
                className="flex-1 py-2.5 rounded-xl font-bold bg-red-600 hover:bg-red-700 text-white shadow-md shadow-red-500/20 transition-all cursor-pointer"
              >
                Restart
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Mark Modal */}
      {activeConfirmMarkRev && (
        <div className="fixed inset-0 bg-black/60 z-50 backdrop-blur-sm flex justify-center items-center p-4">
          <div className="bg-white dark:bg-dark-card w-full max-w-sm rounded-2xl shadow-2xl p-6 border border-gray-200 dark:border-dark-border animate-in zoom-in-95">
            <h3 className="text-xl font-bold mb-2 dark:text-white">Confirm Revision</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 font-medium">Are you sure you have completely revised and understood <strong>{activeConfirmMarkRev.problemTitle}</strong>?</p>
            
            <div className="flex gap-3 pt-4 border-t border-gray-100 dark:border-dark-border">
              <button 
                onClick={() => setActiveConfirmMarkRev(null)} 
                className="flex-1 py-2.5 rounded-xl font-bold bg-gray-100 dark:bg-dark-surface hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors dark:text-gray-300"
              >
                Cancel
              </button>
              <button 
                onClick={() => {
                   handleMarkRevised(activeConfirmMarkRev);
                   setActiveConfirmMarkRev(null);
                }} 
                className="flex-1 py-2.5 rounded-xl font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-500/20 transition-all cursor-pointer"
              >
                Mark Revised
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Streak Modal */}
      {showStreakModal && (
        <div className="fixed inset-0 bg-black/60 z-50 backdrop-blur-sm flex justify-center items-center p-4" onClick={() => setShowStreakModal(false)}>
            <div className="bg-white dark:bg-dark-card w-full max-w-sm rounded-3xl shadow-2xl p-8 border border-gray-200 dark:border-dark-border animate-in zoom-in-95 text-center" onClick={e=>e.stopPropagation()}>
                <div className="flex justify-center mb-6">
                    <div className="relative">
                        <div className="absolute inset-0 bg-orange-500 blur-2xl opacity-30 rounded-full animate-pulse"></div>
                        <Flame className="w-20 h-20 text-orange-500 relative z-10" />
                    </div>
                </div>
                <h2 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-red-600 mb-2">
                    {streakInfo.current} Days
                </h2>
                <p className="text-gray-500 dark:text-gray-400 font-bold mb-6">Current Streak</p>

                <div className="bg-slate-50 dark:bg-dark-surface rounded-2xl p-4 flex justify-between items-center mb-6 border border-gray-100 dark:border-dark-border">
                    <span className="font-bold flex items-center dark:text-gray-300">
                        <Trophy className="w-5 h-5 mr-2 text-yellow-500"/> Max Streak
                    </span>
                    <span className="font-black text-xl dark:text-white">{streakInfo.max} Days</span>
                </div>

                <div className="grid grid-cols-7 gap-2">
                    {streakInfo.weekData.map((day, i) => (
                        <div key={i} className="flex flex-col items-center">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shadow-sm mb-1 
                                ${day.status === 'success' ? 'bg-emerald-100 text-emerald-600 border-2 border-emerald-500' :
                                  day.status === 'fail' ? 'bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-600 border-2 border-transparent' :
                                  day.status === 'today' ? 'bg-orange-100 text-orange-600 border-2 border-orange-500 animate-pulse' :
                                  'bg-gray-50 text-gray-300 dark:bg-white/5 border-2 border-transparent'}`}
                            >
                                {day.status === 'success' ? '✓' : day.status === 'fail' ? '×' : day.status === 'today' ? '?' : '-'}
                            </div>
                            <span className="text-[10px] font-bold text-gray-400">{day.name}</span>
                        </div>
                    ))}
                </div>
                
                <button onClick={() => setShowStreakModal(false)} className="mt-8 w-full py-3 bg-gray-100 dark:bg-dark-surface dark:text-white rounded-xl font-bold hover:bg-gray-200 transition-colors">
                    Close
                </button>
            </div>
        </div>
      )}

      {/* Custom Schedule Modal */}
      {activeCustomScheduleRev && (
        <div className="fixed inset-0 bg-black/60 z-50 backdrop-blur-sm flex justify-center items-center p-4">
          <div className="bg-white dark:bg-dark-card w-full max-w-sm rounded-2xl shadow-2xl p-6 border border-gray-200 dark:border-dark-border animate-in zoom-in-95">
            <h3 className="text-xl font-bold mb-2 dark:text-white">Schedule Review</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 font-medium">When would you like to review <strong>{activeCustomScheduleRev.problemTitle}</strong> again?</p>
            
            <div className="space-y-4">
              <label className="flex flex-col">
                <span className="text-xs font-bold text-gray-500 uppercase mb-2">Review after (days)</span>
                <select 
                  value={customDays}
                  onChange={(e) => setCustomDays(Number(e.target.value))}
                  className="bg-gray-50 dark:bg-dark-surface border border-gray-200 dark:border-dark-border text-slate-800 dark:text-white rounded-xl p-3 font-medium focus:ring-2 focus:ring-primary-500 outline-none"
                >
                  <option value={15}>15 Days</option>
                  <option value={30}>30 Days</option>
                  <option value={45}>45 Days</option>
                  <option value={60}>60 Days</option>
                  <option value={90}>90 Days</option>
                </select>
              </label>

              <div className="flex gap-3 pt-4">
                <button 
                  onClick={() => setActiveCustomScheduleRev(null)} 
                  className="flex-1 py-2.5 rounded-xl font-bold bg-gray-100 dark:bg-dark-surface hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors dark:text-gray-300"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleCustomSchedule} 
                  className="flex-1 py-2.5 rounded-xl font-bold bg-primary-600 hover:bg-primary-700 text-white shadow-md shadow-primary-500/20 transition-all"
                >
                  Schedule
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Floating Back to Sheet Button */}
      {localStorage.getItem('last_sheet_path') && (
          <Link to={localStorage.getItem('last_sheet_path') || '/'} className="fixed bottom-6 right-6 p-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-full shadow-2xl hover:-translate-y-1 hover:shadow-primary-500/20 hover:bg-primary-600 dark:hover:bg-primary-400 dark:hover:text-slate-900 transition-all z-40 group flex items-center gap-0 hover:gap-2 border border-slate-700 dark:border-gray-200">
              <ExternalLink size={24} />
              <span className="max-w-0 overflow-hidden group-hover:max-w-xs transition-all duration-300 font-bold whitespace-nowrap">
                  Back to Sheet
              </span>
          </Link>
      )}

    </div>
  );
}

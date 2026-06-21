import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getSheetFullStructure, toggleProblem, saveNote, getNotesForSheet } from '../services/dataService';
import { Sheet, Topic, SubPattern, Problem } from '../types';
import { useAuth } from '../App';
import { doc, getDoc, setDoc, updateDoc, deleteField } from 'firebase/firestore';
import { db } from '../firebase';
import { COLLECTIONS } from '../constants';
import { ChevronDown, ChevronUp, CheckCircle, Circle, ExternalLink, Filter, Zap, ArrowRight, StickyNote, X, Save, Shuffle, Search, Repeat, Share2, Users } from 'lucide-react';
import { PlatformIcon } from '../components/PlatformIcon';
import ReactMarkdown from 'react-markdown';
import confetti from 'canvas-confetti';
import { collection, query, getDocs, addDoc, where } from 'firebase/firestore';

interface FullProblem extends Problem {
  solved: boolean;
  solvedAt?: number;
  note?: string;
}

interface FullSubPattern extends SubPattern {
  problems: FullProblem[];
}

interface FullTopic extends Topic {
  subPatterns: FullSubPattern[];
  totalProblems: number;
  solvedProblems: number;
}

export default function SheetView() {
  const { sheetId } = useParams();
  const { user, profile, refreshProfile } = useAuth();
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [topics, setTopics] = useState<FullTopic[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [currentNoteProb, setCurrentNoteProb] = useState<{id: string, title: string, content: string} | null>(null);
  const [isEditingNote, setIsEditingNote] = useState(true);
  
  const [activeRevPopup, setActiveRevPopup] = useState<{ prob: FullProblem, rev: any } | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [showDeleteAction, setShowDeleteAction] = useState(false);
  
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [shareProb, setShareProb] = useState<FullProblem | null>(null);
  const [shareMessage, setShareMessage] = useState('');
  const [shareTargets, setShareTargets] = useState<{uid: string, username: string}[]>([]);
  const [selectedShareTarget, setSelectedShareTarget] = useState('');
  
  const [activeTopicId, setActiveTopicId] = useState<string | null>(() => {
    return localStorage.getItem(`sheet_${sheetId}_activeTopic`) || null;
  });
  
  const [expandedSubPatterns, setExpandedSubPatterns] = useState<Set<string>>(new Set());
  const hasInitializedScroll = useRef(false);

  useEffect(() => {
    if (sheetId) {
       localStorage.setItem('last_sheet_path', `/sheet/${sheetId}`);
    }
  }, [sheetId]);

  useEffect(() => {
    if (!sheetId || !user) return;

    const loadData = async () => {
      setLoading(true);
      try {
        const sheetSnap = await getDoc(doc(db, COLLECTIONS.SHEETS, sheetId));
        if (!sheetSnap.exists()) return;
        setSheet({ id: sheetSnap.id, ...sheetSnap.data() } as Sheet);

        const rawStructure = await getSheetFullStructure(sheetId);
        const userNotes = await getNotesForSheet(user.uid, []); 
        const userProgress = profile?.completedProblems || {};
        
        const mergedTopics: FullTopic[] = rawStructure.map((t: any) => {
           let tTotal = 0;
           let tSolved = 0;
           
           const mergedSubs = t.subPatterns.map((sp: any) => {
               const mergedProbs = sp.problems.map((p: any) => {
                   const ts = userProgress[p.id];
                   return { 
                       ...p, 
                       solved: !!ts, 
                       solvedAt: ts || undefined,
                       note: userNotes[p.id] || ''
                   };
               });
               
               const sSolved = mergedProbs.filter((p: any) => p.solved).length;
               tTotal += mergedProbs.length;
               tSolved += sSolved;
               
               return { ...sp, problems: mergedProbs };
           });
           
           return { ...t, subPatterns: mergedSubs, totalProblems: tTotal, solvedProblems: tSolved };
        });

        setTopics(mergedTopics);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [sheetId]);

  useEffect(() => {
    if (!profile || topics.length === 0 || loading) return;

    setTopics(prevTopics => {
      return prevTopics.map(t => {
        let tSolved = 0;
        const nextSubs = t.subPatterns.map(sp => {
          const nextProbs = sp.problems.map(p => {
            const solvedTimestamp = profile.completedProblems[p.id];
            if (p.solved === !!solvedTimestamp) return p; 
            return {
              ...p,
              solved: !!solvedTimestamp,
              solvedAt: solvedTimestamp || undefined
            };
          });
          tSolved += nextProbs.filter(p => p.solved).length;
          return { ...sp, problems: nextProbs };
        });
        return { ...t, subPatterns: nextSubs, solvedProblems: tSolved };
      });
    });
  }, [profile?.completedProblems]); 

  useEffect(() => {
    if (loading || topics.length === 0) return;

    let currentTopicId = activeTopicId;
    if (!currentTopicId || !topics.find(t => t.id === currentTopicId)) {
        currentTopicId = topics[0].id;
        setActiveTopicId(currentTopicId);
    }

    if (!hasInitializedScroll.current && currentTopicId) {
       const topic = topics.find(t => t.id === currentTopicId);
       if (topic) {
           const firstUnsolvedSub = topic.subPatterns.find(sp => sp.problems.some(p => !p.solved));
           if (firstUnsolvedSub) {
               setExpandedSubPatterns(new Set([firstUnsolvedSub.id]));
           } else if (topic.subPatterns.length > 0) {
               setExpandedSubPatterns(new Set([topic.subPatterns[0].id]));
           }
       }
       hasInitializedScroll.current = true;
    }
  }, [loading, topics]);

  const handleTopicChange = (tid: string) => {
      setActiveTopicId(tid);
      localStorage.setItem(`sheet_${sheetId}_activeTopic`, tid);
      setSearchQuery(''); 
  };

  const handleToggleProblem = async (problem: FullProblem) => {
    if (!user) return;
    const newStatus = !problem.solved;
    const now = Date.now();

    if (newStatus) {
        confetti({
            particleCount: 100,
            spread: 70,
            origin: { y: 0.6 },
            colors: ['#6366f1', '#10b981', '#f59e0b']
        });
    }

    let allNowSolved = false;

    setTopics(prev => {
        const updated = prev.map(t => {
            const updatedSubs = t.subPatterns.map(sp => {
                if(!sp.problems.find(p => p.id === problem.id)) return sp;
                const updatedProbs = sp.problems.map(p => {
                    if(p.id === problem.id) return { ...p, solved: newStatus, solvedAt: newStatus ? now : undefined };
                    return p;
                });
                return { ...sp, problems: updatedProbs };
            });
            const tSolved = updatedSubs.reduce((acc, s) => acc + s.problems.filter(p => p.solved).length, 0);
            return { ...t, subPatterns: updatedSubs, solvedProblems: tSolved };
        });

        // Check if global sheet is 100% complete
        const total = updated.reduce((acc, t) => acc + t.totalProblems, 0);
        const solved = updated.reduce((acc, t) => acc + t.solvedProblems, 0);
        if (newStatus && solved === total && total > 0) allNowSolved = true;

        return updated;
    });

    if (allNowSolved) {
        // MEGA CONFETTI
        const duration = 5 * 1000;
        const animationEnd = Date.now() + duration;
        const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };
        const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

        const interval: any = setInterval(function() {
          const timeLeft = animationEnd - Date.now();
          if (timeLeft <= 0) return clearInterval(interval);
          const particleCount = 50 * (timeLeft / duration);
          confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } });
          confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } });
        }, 250);
    }

    try {
        await toggleProblem(user.uid, problem.id, newStatus);
        refreshProfile(); 
    } catch (e) {
        console.error("Failed to save", e);
    }
  };

  const toggleSubPattern = (id: string) => {
    const newSet = new Set(expandedSubPatterns);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setExpandedSubPatterns(newSet);
  };

  const handleOpenShare = async (p: FullProblem, e: React.MouseEvent) => {
    e.stopPropagation();
    setShareProb(p);
    setShareMessage(`Hey! I need some help or want to discuss this problem:\n\n**${p.title}**\n${p.url}`);
    
    // Fetch followers/following users to populate the target dropdown
    if (user && profile) {
        // Find users we have chatted with
        const [q1, q2] = await Promise.all([
          getDocs(query(collection(db, COLLECTIONS.MESSAGES), where('receiverId', '==', user.uid))),
          getDocs(query(collection(db, COLLECTIONS.MESSAGES), where('senderId', '==', user.uid)))
        ]);
        const userIds = new Set<string>();
        q1.docs.forEach(d => userIds.add(d.data().senderId));
        q2.docs.forEach(d => userIds.add(d.data().receiverId));
        userIds.delete(user.uid);

        const snap = await getDocs(query(collection(db, COLLECTIONS.USERS)));
        const options = snap.docs
             .filter(d => userIds.has(d.id))
             .map(d => ({ uid: d.id, username: d.data().displayName || d.data().username || d.data().email?.split('@')[0] || 'Coder' }));
        setShareTargets(options);
    }
    
    setIsShareModalOpen(true);
  };

  const handleShare = async () => {
      if (!user || !profile || !selectedShareTarget || !shareProb) return;
      try {
          await addDoc(collection(db, COLLECTIONS.MESSAGES), {
              senderId: user.uid,
              senderName: profile.username || profile.displayName || profile.email?.split('@')[0] || 'Anonymous',
              receiverId: selectedShareTarget,
              content: shareMessage,
              timestamp: Date.now(),
              read: false
          });
          setIsShareModalOpen(false);
          // Show a silent success without alerting, or maybe alert is okay here since it closes the modal.
          // Better: just close it and let the user know via a small UI bump or nothing (it sent).
      } catch (err) {
          console.error(err);
      }
  };

  const handleOpenNote = (p: FullProblem, e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentNoteProb({ id: p.id, title: p.title, content: p.note || '' });
    setIsNoteModalOpen(true);
  };

  const handleSaveNote = async () => {
    if(!user || !currentNoteProb) return;
    
    setTopics(prev => prev.map(t => {
        const updatedSubs = t.subPatterns.map(sp => {
            const updatedProbs = sp.problems.map(p => {
                if(p.id === currentNoteProb.id) return { ...p, note: currentNoteProb.content };
                return p;
            });
            return { ...sp, problems: updatedProbs };
        });
        return { ...t, subPatterns: updatedSubs };
    }));

    await saveNote(user.uid, currentNoteProb.id, currentNoteProb.content);
    setIsNoteModalOpen(false);
  };

  const handleAddToRevision = async (prob: FullProblem, topicTitle: string, subPatternName?: string) => {
    if (!user || !sheet) return;

    const now = Date.now();
    const nextDate = now + 1 * 24 * 60 * 60 * 1000; // Day 1

    const newRevision = {
      problemId: prob.id,
      sheetId: sheet.id,
      sheetName: sheet.title,
      topicName: topicTitle,
      subPatternName: subPatternName || '',
      problemTitle: prob.title,
      platform: prob.platform,
      url: prob.url,
      isInRevision: true,
      revisionStage: 0,
      revisionHistory: [],
      nextRevisionDate: nextDate,
      lastRevisionDate: null,
      timesRevised: 0,
      timesReset: 0,
      missedCount: 0,
      revisionCycleCompleted: false,
      futureReviewScheduled: false,
      futureReviewDate: null,
      createdRevisionDate: now
    };

    const userRef = doc(db, COLLECTIONS.USERS, user.uid);
    await setDoc(userRef, {
      revisions: {
        [prob.id]: newRevision
      }
    }, { merge: true });
    
    refreshProfile();
  };

  const handleRandomPick = () => {
      const currentTopic = topics.find(t => t.id === activeTopicId);
      if(!currentTopic) return;

      const unsolved: { pid: string, spid: string }[] = [];
      currentTopic.subPatterns.forEach(sp => {
          sp.problems.forEach(p => {
              if(!p.solved) unsolved.push({ pid: p.id, spid: sp.id });
          });
      });

      if(unsolved.length === 0) {
          alert("All problems in this topic are solved! Great job!");
          return;
      }

      const random = unsolved[Math.floor(Math.random() * unsolved.length)];
      setExpandedSubPatterns(prev => new Set(prev).add(random.spid));
      
      setTimeout(() => {
          const el = document.getElementById(`problem-${random.pid}`);
          if(el) {
              el.scrollIntoView({ behavior: 'smooth', block: 'center' });
              el.classList.add('ring-2', 'ring-primary-500', 'ring-offset-2');
              setTimeout(() => el.classList.remove('ring-2', 'ring-primary-500', 'ring-offset-2'), 2000);
          }
      }, 100);
  };

  const filteredTopics = useMemo(() => {
      if (!searchQuery) return topics.filter(t => t.id === activeTopicId);
      return topics.map(t => {
          const matchingSubs = t.subPatterns.map(sp => {
              const matchingProbs = sp.problems.filter(p => p.title.toLowerCase().includes(searchQuery.toLowerCase()));
              return { ...sp, problems: matchingProbs };
          }).filter(sp => sp.problems.length > 0);
          return { ...t, subPatterns: matchingSubs };
      }).filter(t => t.subPatterns.length > 0);
  }, [topics, activeTopicId, searchQuery]);

  const totalProblems = useMemo(() => topics.reduce((acc, t) => acc + t.totalProblems, 0), [topics]);
  const totalSolved = useMemo(() => topics.reduce((acc, t) => acc + t.solvedProblems, 0), [topics]);
  const globalProgress = totalProblems === 0 ? 0 : Math.round((totalSolved / totalProblems) * 100);

  const revisionStats = useMemo(() => {
    let inRev = 0, dueToday = 0, missed = 0, upcoming = 0, completed = 0;
    const todayMidnight = new Date();
    todayMidnight.setHours(0,0,0,0);
    const TODAY_MS = todayMidnight.getTime();
    
    if (profile?.revisions) {
      Object.values(profile.revisions).forEach(rev => {
        if (rev.sheetId === sheetId) {
          inRev++;
          if (rev.revisionCycleCompleted && !rev.futureReviewScheduled) completed++;
          else if (rev.nextRevisionDate) {
            const nextDate = new Date(rev.nextRevisionDate);
            nextDate.setHours(0,0,0,0);
            if (nextDate.getTime() < TODAY_MS) missed++;
            else if (nextDate.getTime() === TODAY_MS) dueToday++;
            else upcoming++;
          }
        }
      });
    }
    const progress = inRev > 0 ? Math.round((completed / inRev) * 100) : 0;
    return { inRev, dueToday, missed, upcoming, completed, progress };
  }, [profile?.revisions, sheetId]);

  if (loading) return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-dark-bg">
          <div className="text-center">
             <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-600 mb-4 mx-auto"></div>
             <p className="text-slate-500 font-medium animate-pulse">Loading Sheet Content...</p>
          </div>
      </div>
  );
  
  if (!sheet) return <div className="p-8 text-center text-red-500">Sheet not found</div>;

  return (
    <div className="max-w-[1400px] mx-auto pb-12 px-2 lg:px-4">
      
      <div className="bg-white dark:bg-dark-card glass-container rounded-2xl shadow-sm p-6 mb-8 border border-gray-200 dark:border-dark-border">
        <div className="flex flex-col md:flex-row justify-between items-start gap-6">
            <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                    <h1 className="text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">{sheet.title}</h1>
                </div>
                <p className="text-lg text-slate-500 dark:text-gray-300 max-w-2xl leading-relaxed">{sheet.description}</p>
                
                <div className="mt-6 max-w-xl">
                    <div className="flex justify-between text-base font-bold mb-2">
                        <span className="text-slate-700 dark:text-gray-200">Total Progress</span>
                        <span className="text-primary-600 dark:text-primary-300">{globalProgress}% <span className="text-slate-400 font-normal">({totalSolved} / {totalProblems})</span></span>
                    </div>
                    <div className="h-4 w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden border border-gray-300 dark:border-gray-600">
                        <div 
                            style={{ width: `${globalProgress}%` }} 
                            className="h-full bg-primary-600 dark:bg-primary-500 shadow-md transition-all duration-700 ease-out"
                        ></div>
                    </div>
                </div>
            </div>
            
            <div className="flex gap-4">
                <button 
                    onClick={handleRandomPick}
                    className="flex flex-col items-center justify-center bg-indigo-50 dark:bg-indigo-900/20 px-6 py-4 rounded-xl border-2 border-indigo-100 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors group shadow-sm"
                    title="Pick a random unsolved problem"
                >
                    <Shuffle className="text-indigo-600 dark:text-indigo-400 group-hover:rotate-180 transition-transform duration-500" size={24} />
                    <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300 mt-1 uppercase tracking-wide">Random</span>
                </button>

                <div className="flex-shrink-0 bg-orange-50 dark:bg-gray-800 px-6 py-4 rounded-xl border-2 border-orange-100 dark:border-gray-700 flex flex-col items-center justify-center min-w-[100px] shadow-sm">
                    <div className="flex items-center gap-2 mb-1">
                        <Zap className="text-orange-500 fill-orange-500" size={20} />
                        <div className="text-sm text-orange-700 dark:text-orange-400 font-bold uppercase tracking-wider">Streak</div>
                    </div>
                    <div className="text-2xl font-black text-slate-900 dark:text-white leading-none">{profile?.currentStreak || 0}d</div>
                </div>
            </div>
        </div>
      </div>

      <div className="bg-white dark:bg-dark-card glass-panel rounded-2xl shadow-sm p-5 pb-6 mb-8 border border-gray-200 dark:border-dark-border">
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-100 dark:border-dark-border">
              <h3 className="font-bold text-lg dark:text-white flex items-center">
                  <Repeat className="mr-2 text-primary-600" size={20} />
                  Revision Overview
              </h3>
              <Link to="/revision" className="text-xs font-bold bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 px-3 py-1.5 rounded-lg hover:bg-primary-100 dark:hover:bg-primary-900/50 transition-colors uppercase tracking-widest">
                  Go to Dashboard
              </Link>
          </div>
          <div className="flex flex-wrap gap-4 items-center">
              <div className="flex-1 min-w-[200px]">
                  <div className="flex justify-between text-xs font-bold mb-1">
                      <span className="text-slate-600 dark:text-gray-400">Sheet Revision Progress</span>
                      <span className="text-primary-600 dark:text-primary-400">{revisionStats.progress}%</span>
                  </div>
                  <div className="h-2 w-full bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                      <div style={{ width: `${revisionStats.progress}%` }} className="h-full bg-primary-500"></div>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1 uppercase font-bold tracking-widest">
                      {revisionStats.inRev} Questions In Revision
                  </div>
              </div>

              <div className="flex gap-3">
                  <div className="flex flex-col items-center px-4 py-2 bg-gray-50 dark:bg-dark-surface rounded-xl border border-gray-100 dark:border-dark-border min-w-[80px]">
                      <span className="text-[10px] font-black uppercase text-gray-500 mb-1">Due</span>
                      <span className="text-xl font-black text-slate-800 dark:text-white">{revisionStats.dueToday}</span>
                  </div>
                  <div className="flex flex-col items-center px-4 py-2 bg-red-50 dark:bg-red-900/10 rounded-xl border border-red-100 dark:border-red-900/30 min-w-[80px]">
                      <span className="text-[10px] font-black uppercase text-red-500 mb-1">Missed</span>
                      <span className="text-xl font-black text-red-600 dark:text-red-400">{revisionStats.missed}</span>
                  </div>
                  <div className="flex flex-col items-center px-4 py-2 bg-gray-50 dark:bg-dark-surface rounded-xl border border-gray-100 dark:border-dark-border min-w-[80px]">
                      <span className="text-[10px] font-black uppercase text-gray-500 mb-1">Upcoming</span>
                      <span className="text-xl font-black text-slate-800 dark:text-white">{revisionStats.upcoming}</span>
                  </div>
                  <div className="flex flex-col items-center px-4 py-2 bg-emerald-50 dark:bg-emerald-900/10 rounded-xl border border-emerald-100 dark:border-emerald-900/30 min-w-[80px]">
                      <span className="text-[10px] font-black uppercase text-emerald-600 mb-1">Completed</span>
                      <span className="text-xl font-black text-emerald-600 dark:text-emerald-400">{revisionStats.completed}</span>
                  </div>
              </div>
          </div>
      </div>

      <div className="flex flex-col lg:flex-row-reverse gap-4 items-start relative">
        <div className="w-full lg:w-[320px] flex-shrink-0">
          <div className="lg:sticky lg:top-4 bg-white dark:bg-dark-card glass-panel rounded-xl shadow-sm border border-gray-200 dark:border-dark-border overflow-hidden flex flex-col max-h-[85vh]">
             <div className="p-3 bg-gray-50 dark:bg-dark-surface/50 border-b border-gray-200 dark:border-dark-border">
                <div className="flex items-center font-extrabold text-lg text-slate-800 dark:text-white mb-2">
                    <Filter size={18} className="mr-2 text-primary-600" /> 
                    Topics
                </div>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={14} />
                    <input 
                        type="text"
                        placeholder="Search problems..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 bg-white dark:bg-dark-bg border border-gray-200 dark:border-dark-border rounded-md text-sm focus:ring-2 focus:ring-primary-500 outline-none dark:text-white"
                    />
                </div>
             </div>
             <div className="overflow-y-auto custom-scrollbar flex-1 p-2 space-y-1">
                {topics.map((topic, idx) => (
                    <button
                        key={topic.id}
                        onClick={() => handleTopicChange(topic.id)}
                        className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-semibold transition-all flex justify-between items-center group ${
                            activeTopicId === topic.id && !searchQuery
                            ? 'bg-primary-600 text-white shadow-md' 
                            : 'text-slate-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-border/50'
                        }`}
                    >
                        <span className="truncate mr-2 flex-1"><span className={`mr-2 text-[10px] ${activeTopicId === topic.id ? 'opacity-70' : 'opacity-40'}`}>{idx + 1}.</span> {topic.title}</span>
                        {topic.totalProblems > 0 && (
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${
                                activeTopicId === topic.id && !searchQuery
                                ? 'bg-white/20 text-white'
                                : 'bg-gray-200 dark:bg-slate-700 text-slate-700 dark:text-white'
                            }`}>
                                {topic.solvedProblems}/{topic.totalProblems}
                            </span>
                        )}
                    </button>
                ))}
             </div>
          </div>
        </div>

        <div className="flex-1 w-full min-w-0">
          {filteredTopics.map(topic => (
             <div key={topic.id} className="animate-in fade-in slide-in-from-bottom-2 duration-300 mb-10">
                 <div className="flex items-end justify-between mb-8 pb-4 border-b-2 border-gray-200 dark:border-dark-border">
                     <h2 className="text-4xl font-extrabold text-slate-900 dark:text-white flex items-center">
                        {topic.title}
                     </h2>
                     <div className="text-lg font-bold text-slate-500 dark:text-gray-300 pb-1">
                        <span className="text-primary-600 dark:text-primary-400">{topic.solvedProblems}</span> / {topic.totalProblems} Solved
                     </div>
                 </div>
                 
                 <div className="space-y-8">
                    {topic.subPatterns.map(sp => {
                        const spSolved = sp.problems.filter(p => p.solved).length;
                        const spTotal = sp.problems.length;
                        const isExpanded = searchQuery ? true : expandedSubPatterns.has(sp.id); 
                        const isComplete = spSolved === spTotal && spTotal > 0;

                        return (
                            <div key={sp.id} className={`bg-white dark:bg-dark-card rounded-xl shadow-sm border overflow-hidden transition-all duration-300 ${
                                isComplete 
                                ? 'border-success-500 dark:border-success-700' 
                                : 'border-gray-200 dark:border-dark-border'
                            }`}>
                                <button 
                                    onClick={() => toggleSubPattern(sp.id)}
                                    className={`w-full flex items-center justify-between p-6 transition-colors ${
                                        isExpanded ? 'bg-gray-50 dark:bg-dark-surface' : 'hover:bg-gray-50 dark:hover:bg-dark-surface/50'
                                    }`}
                                >
                                    <div className="flex items-center gap-5">
                                        <div className={`p-2 rounded-lg ${isExpanded ? 'bg-white dark:bg-dark-card shadow-sm' : 'bg-transparent'}`}>
                                            {isExpanded ? <ChevronUp size={24} className="text-slate-600 dark:text-slate-300"/> : <ChevronDown size={24} className="text-slate-400"/>}
                                        </div>
                                        <div className="flex flex-col items-start text-left">
                                            <span className={`font-bold text-2xl leading-tight ${isComplete ? 'text-success-700 dark:text-success-400' : 'text-slate-900 dark:text-white'}`}>
                                                {sp.title}
                                            </span>
                                            {isComplete && <span className="text-xs uppercase font-extrabold text-success-600 tracking-wider mt-1 bg-success-50 dark:bg-success-900/30 px-2 py-0.5 rounded">Completed</span>}
                                        </div>
                                    </div>
                                    
                                    <div className="flex items-center gap-4">
                                        <div className="w-32 h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden hidden sm:block border border-gray-300 dark:border-gray-600">
                                            <div 
                                                className={`h-full ${isComplete ? 'bg-success-500' : 'bg-primary-600 dark:bg-violet-500'}`} 
                                                style={{ width: `${(spSolved/spTotal)*100}%` }}
                                            />
                                        </div>
                                        <span className="text-base font-mono font-bold text-slate-600 dark:text-gray-300 min-w-[3rem] text-right">
                                            {spSolved}/{spTotal}
                                        </span>
                                    </div>
                                </button>
                                
                                {isExpanded && (
                                    <div className="border-t border-gray-100 dark:border-dark-border">
                                        {sp.problems.map((prob, pIdx) => {
                                            const isNextUp = !prob.solved && sp.problems.slice(0, pIdx).every(p => p.solved);

                                            return (
                                            <div 
                                                key={prob.id}
                                                id={`problem-${prob.id}`} 
                                                className={`p-2 pl-3 flex flex-col md:flex-row md:items-center justify-between group transition-all duration-200 border-b border-gray-100 dark:border-dark-border last:border-0 relative
                                                    ${prob.solved 
                                                        ? 'bg-success-50 dark:bg-success-900/10 border-l-[4px] border-l-success-500' 
                                                        : 'bg-white dark:bg-dark-card hover:bg-gray-50 dark:hover:bg-dark-surface/50 border-l-[4px] border-l-transparent hover:border-l-primary-300 dark:hover:border-l-violet-500'
                                                    }
                                                    ${isNextUp && !prob.solved ? 'border-l-yellow-400 bg-yellow-50/50 dark:bg-yellow-900/10' : ''}
                                                `}
                                            >
                                                <div className="flex items-start gap-4 flex-1 mb-2 md:mb-0">
                                                    <span className={`font-mono text-sm pt-0.5 w-6 text-right ${prob.solved ? 'text-success-700/70 font-bold' : 'text-slate-400 dark:text-slate-600 font-bold'}`}>
                                                        {String(pIdx + 1).padStart(2, '0')}
                                                    </span>
                                                    
                                                    <div className="flex-1">
                                                        <a 
                                                            href={prob.url} 
                                                            target="_blank" 
                                                            rel="noopener noreferrer"
                                                            className={`text-[15px] font-semibold flex items-center gap-2 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors ${
                                                                prob.solved ? 'text-slate-600 dark:text-slate-400' : 'text-slate-900 dark:text-gray-100'
                                                            }`}
                                                        >
                                                            {prob.title}
                                                            <ExternalLink size={14} className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400" />
                                                        </a>
                                                        
                                                        <div className="flex items-center mt-1 gap-2 flex-wrap">
                                                            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-dark-surface text-[10px] uppercase font-bold text-slate-600 dark:text-slate-300 shadow-sm">
                                                                <PlatformIcon platform={prob.platform} className="w-3 h-3" />
                                                                <span>{prob.platform}</span>
                                                            </div>
                                                            
                                                            <button 
                                                                onClick={(e) => handleOpenNote(prob, e)}
                                                                className={`flex items-center gap-1.5 px-2 py-0.5 rounded border text-[10px] uppercase font-bold transition-colors ${
                                                                    prob.note 
                                                                    ? 'bg-amber-100 border-amber-200 text-amber-800 dark:bg-amber-900/30 dark:border-amber-800 dark:text-amber-400 shadow-sm'
                                                                    : 'border-transparent text-slate-400 hover:bg-gray-100 dark:hover:bg-dark-surface hover:text-slate-600'
                                                                }`}
                                                            >
                                                                <StickyNote size={12} fill={prob.note ? "currentColor" : "none"} />
                                                                {prob.note ? "Note" : "Add Note"}
                                                            </button>

                                                            {/* Share Toggle */}
                                                            <button 
                                                                onClick={(e) => handleOpenShare(prob, e)}
                                                                className="p-1 rounded text-slate-400 hover:text-blue-500 transition-colors"
                                                                title="Share Problem"
                                                            >
                                                                <Share2 size={14} />
                                                            </button>

                                                            {/* Bookmark Toggle */}
                                                            <button 
                                                                onClick={async () => {
                                                                    if (!user) return;
                                                                    const isBookmarked = profile?.bookmarks?.[prob.id];
                                                                    const ref = doc(db, 'users', user.uid);
                                                                    await setDoc(ref, {
                                                                        bookmarks: {
                                                                            [prob.id]: !isBookmarked ? true : false
                                                                        }
                                                                    }, { merge: true });
                                                                    refreshProfile();
                                                                }}
                                                                className={`p-1 rounded text-slate-400 hover:text-yellow-500 transition-colors ${profile?.bookmarks?.[prob.id] ? 'text-yellow-500' : ''}`}
                                                                title="Bookmark Problem"
                                                            >
                                                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill={profile?.bookmarks?.[prob.id] ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
                                                            </button>

                                                            {(() => {
                                                              if (!profile) return null;
                                                              const rev = profile.revisions?.[prob.id];
                                                              if (!rev) {
                                                                return (
                                                                  <button
                                                                      onClick={() => handleAddToRevision(prob, topic.title, sp.title)}
                                                                      className="flex items-center gap-1.5 px-2 py-0.5 rounded border border-purple-200 text-purple-600 dark:border-purple-800 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/30 text-[10px] uppercase font-bold transition-colors shadow-sm bg-white dark:bg-dark-surface"
                                                                  >
                                                                      <Repeat size={12} /> Add to Revision
                                                                  </button>
                                                                );
                                                              }
                                                              
                                                              let statusText = "";
                                                              let colorClass = "";
                                                              
                                                              const TODAY_MS = new Date().setHours(0,0,0,0);
                                                              
                                                              if (rev.revisionCycleCompleted) {
                                                                  if (rev.futureReviewScheduled) {
                                                                      statusText = "Scheduled For Future Review";
                                                                      colorClass = "border-blue-200 bg-blue-50 text-blue-600 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-400";
                                                                  } else {
                                                                      statusText = "Completed Revision Cycle";
                                                                      colorClass = "border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-400";
                                                                  }
                                                              } else if (rev.nextRevisionDate) {
                                                                  const nextDate = new Date(rev.nextRevisionDate).setHours(0,0,0,0);
                                                                  if (nextDate < TODAY_MS) {
                                                                      statusText = "Missed";
                                                                      colorClass = "border-red-200 bg-red-50 text-red-600 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400";
                                                                  } else {
                                                                      const stages = [1, 3, 7, 15, 30];
                                                                      const stageDay = stages[rev.revisionStage] || 1;
                                                                      statusText = `Day ${stageDay} Pending`;
                                                                      colorClass = "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-400";
                                                                  }
                                                              }
                                                              
                                                              return (
                                                                <button
                                                                    onClick={() => setActiveRevPopup({ prob, rev })}
                                                                    className={`flex items-center gap-2 px-2 py-0.5 rounded-md border text-xs font-bold shadow-sm transition-colors cursor-pointer hover:opacity-80 ${colorClass}`}
                                                                >
                                                                    <Repeat size={12} /> {statusText}
                                                                </button>
                                                              );
                                                            })()}

                                                            {prob.solved && prob.solvedAt && (
                                                                <div className="flex items-center text-xs font-bold text-success-700 dark:text-success-400 ml-2">
                                                                    <CheckCircle size={12} className="mr-1" />
                                                                    {new Date(prob.solvedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                                                </div>
                                                            )}
                                                            {isNextUp && (
                                                                <span className="text-[10px] font-black uppercase tracking-wider text-yellow-800 bg-yellow-100 px-2 py-0.5 rounded-md dark:bg-yellow-900/50 dark:text-yellow-300 border border-yellow-200 dark:border-yellow-800/50">
                                                                    Next Up
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>

                                                <button 
                                                    onClick={() => handleToggleProblem(prob)}
                                                    className={`self-end md:self-center flex-shrink-0 p-2 rounded-full transition-all duration-200 transform active:scale-95 shadow-sm
                                                        ${prob.solved 
                                                            ? 'bg-success-100 text-success-600 dark:bg-success-900/50 dark:text-success-400 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/30' 
                                                            : 'bg-white border-2 border-gray-200 text-gray-300 hover:border-primary-500 hover:text-primary-500 dark:bg-dark-surface dark:border-gray-700 dark:hover:border-primary-400 dark:text-slate-600'
                                                        }
                                                    `}
                                                    title={prob.solved ? "Mark as unsolved" : "Mark as solved"}
                                                >
                                                    {prob.solved ? <CheckCircle size={28} className="fill-current" /> : <Circle size={28} strokeWidth={2.5} />}
                                                </button>
                                            </div>
                                        )})}
                                        {sp.problems.length === 0 && <div className="p-8 text-sm text-slate-400 italic text-center">No problems added to this pattern yet.</div>}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                    {topic.subPatterns.length === 0 && (
                        <div className="text-center py-16 px-4 bg-gray-50 dark:bg-dark-card/50 rounded-xl border-2 border-dashed border-gray-200 dark:border-dark-border">
                            <p className="text-lg text-slate-500 dark:text-gray-400 font-medium">No patterns in this topic yet.</p>
                        </div>
                    )}
                 </div>
             </div>
          ))}
          
          {filteredTopics.length === 0 && (
              <div className="text-center py-20">
                  <p className="text-xl text-slate-400 font-medium">No problems found for "{searchQuery}"</p>
              </div>
          )}
        </div>
      </div>

      {isShareModalOpen && shareProb && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-dark-card w-full max-w-md rounded-xl shadow-2xl overflow-hidden border border-gray-200 dark:border-dark-border animate-in zoom-in-95 duration-200">
                <div className="p-4 bg-gray-50 dark:bg-dark-surface border-b border-gray-200 dark:border-dark-border flex justify-between items-center">
                    <h3 className="font-bold text-lg dark:text-white flex items-center gap-2">
                        <Share2 className="text-primary-500" /> Share Problem
                    </h3>
                    <button onClick={() => setIsShareModalOpen(false)} className="text-gray-400 hover:text-slate-800 dark:hover:text-white transition-colors">
                        <X size={20} />
                    </button>
                </div>
                <div className="p-6 space-y-4">
                    <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800/20 p-3 rounded-lg flex items-start gap-3">
                        <div className="text-blue-500 mt-0.5"><Zap size={16} /></div>
                        <div>
                            <div className="text-sm font-bold text-slate-800 dark:text-white">{shareProb.title}</div>
                            <div className="text-xs text-slate-500 dark:text-gray-400 mt-1">Sharing this problem will send a direct message.</div>
                        </div>
                    </div>
                    
                    <div>
                        <label className="block text-sm font-bold text-slate-700 dark:text-gray-300 mb-2">Select User</label>
                        <select 
                            value={selectedShareTarget} 
                            onChange={(e) => setSelectedShareTarget(e.target.value)}
                            className="w-full p-3 bg-gray-50 dark:bg-dark-surface border border-gray-200 dark:border-dark-border rounded-lg text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-primary-500"
                        >
                            <option value="">-- Choose someone --</option>
                            {shareTargets.map(t => (
                                <option key={t.uid} value={t.uid}>@{t.username}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-slate-700 dark:text-gray-300 mb-2">Message (Optional)</label>
                        <textarea 
                            value={shareMessage}
                            onChange={(e) => setShareMessage(e.target.value)}
                            className="w-full h-24 p-3 bg-gray-50 dark:bg-dark-surface border border-gray-200 dark:border-dark-border rounded-lg text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-primary-500 resize-none font-mono text-sm"
                        />
                    </div>
                </div>
                <div className="p-4 bg-gray-50 dark:bg-dark-surface border-t border-gray-200 dark:border-dark-border flex gap-3">
                     <button onClick={() => setIsShareModalOpen(false)} className="flex-1 py-2 rounded-lg font-bold bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border hover:bg-gray-50 dark:hover:bg-dark-surface text-slate-700 dark:text-gray-300 transition-colors">
                         Cancel
                     </button>
                     <button 
                         onClick={handleShare} 
                         disabled={!selectedShareTarget}
                         className="flex-1 py-2 rounded-lg font-bold bg-primary-600 hover:bg-primary-700 text-white transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                     >
                         <Share2 size={16} /> Send
                     </button>
                </div>
            </div>
        </div>
      )}

      {isNoteModalOpen && currentNoteProb && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-dark-card w-full max-w-lg rounded-xl shadow-2xl overflow-hidden border border-gray-200 dark:border-dark-border animate-in zoom-in-95 duration-200">
                <div className="p-4 bg-gray-50 dark:bg-dark-surface border-b border-gray-200 dark:border-dark-border flex justify-between items-center">
                    <h3 className="font-bold text-lg dark:text-white flex items-center gap-2">
                        <StickyNote className="text-amber-500" />
                        Note: <span className="text-primary-600 truncate max-w-[200px]">{currentNoteProb.title}</span>
                    </h3>
                    <button onClick={() => setIsNoteModalOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                        <X size={24} />
                    </button>
                </div>
                <div className="bg-gray-100 dark:bg-dark-surface border-b border-gray-200 dark:border-dark-border flex">
                    <button 
                        onClick={() => setIsEditingNote(true)} 
                        className={`px-6 py-2 text-sm font-bold transition-colors ${isEditingNote ? 'bg-white dark:bg-dark-card text-primary-600 dark:text-primary-400 border-b-2 border-primary-500' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-200/50 dark:hover:bg-dark-border/50'}`}
                    >
                        Edit
                    </button>
                    <button 
                        onClick={() => setIsEditingNote(false)} 
                        className={`px-6 py-2 text-sm font-bold transition-colors ${!isEditingNote ? 'bg-white dark:bg-dark-card text-primary-600 dark:text-primary-400 border-b-2 border-primary-500' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-200/50 dark:hover:bg-dark-border/50'}`}
                    >
                        Preview
                    </button>
                    {isEditingNote && (
                        <div className="flex-1 flex justify-end items-center pr-2">
                             <button
                                 onClick={() => setCurrentNoteProb({ ...currentNoteProb, content: currentNoteProb.content + `\n\n### Approach 2\n\`\`\`javascript\n// Your code here\n\`\`\`\n`})}
                                 className="text-[10px] font-bold text-primary-600 bg-primary-50 dark:bg-primary-900/30 dark:text-primary-400 px-3 py-1.5 rounded-lg hover:bg-primary-100 transition-colors"
                             >
                                 + Add Approach
                             </button>
                        </div>
                    )}
                </div>
                <div className="p-0">
                    {isEditingNote ? (
                        <textarea 
                            className="w-full h-[300px] p-6 bg-yellow-50 dark:bg-dark-surface border-0 rounded-b-lg text-slate-800 dark:text-gray-200 placeholder-slate-400 focus:ring-0 outline-none resize-none font-mono text-sm"
                            placeholder="Write your thoughts, approach, or complexity analysis here...\n\nSupports **Markdown**, you can easily document multiple approaches!"
                            value={currentNoteProb.content}
                            onChange={(e) => setCurrentNoteProb({...currentNoteProb, content: e.target.value})}
                            autoFocus
                        />
                    ) : (
                        <div className="w-full h-[250px] p-6 bg-white dark:bg-dark-card overflow-y-auto prose dark:prose-invert max-w-none text-sm text-slate-800 dark:text-gray-300">
                            {currentNoteProb.content ? (
                                <ReactMarkdown>{currentNoteProb.content}</ReactMarkdown>
                            ) : (
                                <p className="text-gray-400 italic mt-0">Nothing to preview yet.</p>
                            )}
                        </div>
                    )}
                </div>
                <div className="p-4 border-t border-gray-100 dark:border-dark-border flex justify-end gap-3 bg-gray-50 dark:bg-dark-surface">
                    <button onClick={() => setIsNoteModalOpen(false)} className="px-5 py-2 rounded-lg text-slate-600 hover:bg-gray-200 dark:text-gray-400 dark:hover:bg-dark-card font-semibold">Cancel</button>
                    <button onClick={handleSaveNote} className="px-5 py-2 rounded-lg bg-primary-600 text-white hover:bg-primary-700 font-semibold flex items-center gap-2 shadow-sm">
                        <Save size={18} /> Save Note
                    </button>
                </div>
            </div>
        </div>
      )}

      {activeRevPopup && (
        <div className="fixed inset-0 bg-black/60 z-50 backdrop-blur-sm flex justify-center items-center p-4 overflow-y-auto" onClick={(e) => {
            if (e.target === e.currentTarget) {
                setActiveRevPopup(null);
                setShowDeleteAction(false);
                setDeleteConfirmText("");
            }
        }}>
          <div className="bg-white dark:bg-dark-card w-full max-w-md rounded-2xl shadow-2xl p-6 border border-gray-200 dark:border-dark-border animate-in zoom-in-95 my-8">
            <h3 className="text-xl font-bold mb-4 dark:text-white break-words pr-8 leading-tight">
              Revision Status:<br/>
              <span className="text-primary-600 dark:text-primary-400 text-lg leading-tight">{activeRevPopup.prob.title}</span>
            </h3>
            
            <div className="space-y-4 mb-6">
              <div className="flex justify-between items-center text-sm font-medium border-b border-gray-100 dark:border-dark-border pb-2">
                  <span className="text-gray-500 dark:text-gray-400">Current Stage</span>
                  <span className="dark:text-white font-bold">{activeRevPopup.rev.revisionCycleCompleted ? 'Completed' : `Stage ${activeRevPopup.rev.revisionStage + 1} of 5`}</span>
              </div>
              <div className="flex justify-between items-center text-sm font-medium border-b border-gray-100 dark:border-dark-border pb-2">
                  <span className="text-gray-500 dark:text-gray-400">Next Revision</span>
                  <span className="dark:text-white font-bold">
                      {activeRevPopup.rev.nextRevisionDate 
                          ? new Date(activeRevPopup.rev.nextRevisionDate).toLocaleDateString(undefined, {month: 'short', day: 'numeric', year: 'numeric'})
                          : 'N/A'}
                  </span>
              </div>

              {/* Revision Timeline */}
              <div className="bg-gray-50 dark:bg-dark-surface p-4 rounded-xl border border-gray-100 dark:border-dark-border mt-4">
                  <h4 className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3">Revision Timeline</h4>
                  <div className="space-y-3 relative before:absolute before:inset-0 before:ml-[11px] before:-translate-x-px before:h-full before:w-0.5 before:bg-gradient-to-b before:from-emerald-300 before:via-gray-200 dark:before:via-gray-700 before:to-transparent">
                       {[1, 3, 7, 15, 30].map((days, idx) => {
                           const isCompleted = idx < activeRevPopup.rev.revisionStage || activeRevPopup.rev.revisionCycleCompleted;
                           const isCurrent = idx === activeRevPopup.rev.revisionStage && !activeRevPopup.rev.revisionCycleCompleted;
                           
                           let expectedDate = "";
                           if (isCompleted) {
                                expectedDate = activeRevPopup.rev.revisionHistory?.[idx] ? new Date(activeRevPopup.rev.revisionHistory[idx]).toLocaleDateString(undefined, {month: 'short', day: 'numeric'}) : "Done";
                           } else if (isCurrent && activeRevPopup.rev.nextRevisionDate) {
                                expectedDate = new Date(activeRevPopup.rev.nextRevisionDate).toLocaleDateString(undefined, {month: 'short', day: 'numeric'});
                           } else {
                                expectedDate = `Interval: ${days}d`;
                           }

                           return (
                               <div key={idx} className="relative flex items-center justify-between">
                                    <div className={`flex items-center gap-3 z-10 w-full`}>
                                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border-2 
                                            ${isCompleted ? 'bg-emerald-500 border-emerald-500 text-white' : isCurrent ? 'bg-white dark:bg-dark-card border-primary-500 text-primary-500' : 'bg-gray-100 dark:bg-dark-surface border-gray-300 dark:border-gray-600 text-gray-400'}`}>
                                            {isCompleted ? '✓' : idx + 1}
                                        </div>
                                        <div className={`flex-1 flex justify-between items-center ${isCurrent ? 'bg-white dark:bg-dark-card shadow-sm border-gray-200 dark:border-gray-600' : 'bg-transparent border-transparent'} px-3 py-1.5 rounded-lg border transition-all`}>
                                            <span className={`text-xs font-bold ${isCompleted ? 'text-gray-400 line-through' : isCurrent ? 'text-slate-800 dark:text-white' : 'text-gray-400'}`}>
                                                Day {days} {isCurrent && '(Next)'}
                                            </span>
                                            <span className={`text-[10px] font-bold ${isCompleted ? 'text-emerald-600 dark:text-emerald-400' : isCurrent ? 'text-primary-600 dark:text-primary-400' : 'text-gray-400'}`}>
                                                {expectedDate}
                                            </span>
                                        </div>
                                    </div>
                               </div>
                           );
                       })}
                  </div>
              </div>
            </div>

            {!showDeleteAction ? (
                <button 
                    onClick={() => setShowDeleteAction(true)}
                    className="w-full py-3 rounded-xl font-bold border-2 border-red-100 text-red-600 hover:bg-red-50 dark:border-red-900/40 dark:text-red-400 dark:hover:bg-red-900/20 transition-colors text-sm"
                >
                    Remove from Spaced Revision
                </button>
            ) : (
                <div className="bg-red-50 dark:bg-red-900/10 p-5 rounded-xl border border-red-100 dark:border-red-900/30">
                    <p className="text-sm text-red-600 dark:text-red-400 font-bold mb-3">Type "DELETE" to confirm removal:</p>
                    <input 
                        type="text" 
                        value={deleteConfirmText}
                        onChange={(e) => setDeleteConfirmText(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl border border-red-200 dark:border-red-800 bg-white dark:bg-dark-surface text-slate-900 dark:text-white font-bold text-sm mb-4 outline-none focus:ring-2 focus:ring-red-500 shadow-inner"
                        placeholder="DELETE"
                    />
                    <div className="flex gap-3">
                        <button 
                            onClick={() => { setShowDeleteAction(false); setDeleteConfirmText(""); }}
                            className="flex-1 py-2.5 text-sm font-bold rounded-xl bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors hover:bg-gray-300 dark:hover:bg-gray-600"
                        >
                            Cancel
                        </button>
                        <button 
                            disabled={deleteConfirmText !== "DELETE"}
                            onClick={async () => {
                                if (user && deleteConfirmText === "DELETE") {
                                    const userRef = doc(db, COLLECTIONS.USERS, user.uid);
                                    await updateDoc(userRef, {
                                        [`revisions.${activeRevPopup.prob.id}`]: deleteField()
                                    });
                                    refreshProfile();
                                    setActiveRevPopup(null);
                                    setShowDeleteAction(false);
                                    setDeleteConfirmText("");
                                }
                            }}
                            className="flex-1 py-2.5 text-sm font-bold rounded-xl bg-red-600 text-white disabled:opacity-50 transition-all hover:bg-red-700 disabled:hover:bg-red-600 shadow-md"
                        >
                            Confirm
                        </button>
                    </div>
                </div>
            )}

            <button 
                onClick={() => { setActiveRevPopup(null); setShowDeleteAction(false); setDeleteConfirmText(""); }}
                className="w-full mt-4 py-3 rounded-xl font-bold bg-gray-100 dark:bg-dark-surface hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors dark:text-gray-300 text-sm"
            >
                Close
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
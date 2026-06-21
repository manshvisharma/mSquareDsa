import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { collection, query, getDocs, where, doc, getDoc } from 'firebase/firestore';
import { COLLECTIONS } from '../constants';
import { SQLProblem, SQLSubmission, SQLTopicBatch } from '../types';
import { useAuth } from '../App';
import { ArrowLeft, CheckCircle2, Circle } from 'lucide-react';

export default function SQLTopicView() {
  const { topicId } = useParams<{topicId: string}>();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [problems, setProblems] = useState<SQLProblem[]>([]);
  const [submissions, setSubmissions] = useState<SQLSubmission[]>([]);
  const [batch, setBatch] = useState<SQLTopicBatch | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setErrorMsg('');
      try {
          if (!topicId) return;

          let loaded = (window as any).__SQL_PROBLEMS_CACHE__;
          if (!loaded) {
            const q = query(collection(db, COLLECTIONS.SQL_PROBLEMS), where('published', '==', true));
            const snap = await getDocs(q);
            loaded = snap.docs.map(d => d.data() as SQLProblem);
            (window as any).__SQL_PROBLEMS_CACHE__ = loaded;
          }
          
          // Check if this topicId is a Batch
          const bRef = doc(db, COLLECTIONS.SQL_TOPIC_BATCHES, topicId);
          const bSnap = await getDoc(bRef);
          let matchBatch: SQLTopicBatch | null = null;
          if (bSnap.exists()) {
             matchBatch = { id: bSnap.id, ...bSnap.data() } as SQLTopicBatch;
             setBatch(matchBatch);
          }

          let topicProblems = [];
          if (matchBatch) {
               topicProblems = loaded.filter((p: SQLProblem) => (p.problemNumber || 0) >= matchBatch.startRange && (p.problemNumber || 0) <= matchBatch.endRange);
          } else {
               topicProblems = loaded.filter((p: SQLProblem) => p.tags && p.tags.includes(topicId));
          }
          
          if (user) {
             const subQ = query(collection(db, COLLECTIONS.SQL_SUBMISSIONS), where('userId', '==', user.uid));
             const subSnap = await getDocs(subQ);
             const loadedSubs = subSnap.docs.map(d => d.data() as SQLSubmission);
             setSubmissions(loadedSubs);
          }
    
          setProblems(topicProblems.sort((a: any, b: any) => (a.problemNumber || 0) - (b.problemNumber || 0)));
      } catch (err: any) {
          setErrorMsg(err.message || 'Error fetching data.');
      }
      setLoading(false);
    };
    fetchData();
  }, [user, topicId]);

  if (loading) return <div className="p-8 text-center text-gray-500">Loading topic...</div>;
  if (!topicId) return <div className="p-8 text-center text-red-500">Topic not found</div>;

  const validDiffs = ['Easy', 'Medium', 'Hard'];

  const getStats = (diff: string) => {
      const diffProbs = problems.filter(p => diff === 'All' || p.difficulty === diff);
      const total = diffProbs.length;
      const solved = diffProbs.filter(p => submissions.some(s => s.problemId === p.id && s.status === 'Accepted')).length;
      return { total, solved };
  };

  const allStats = getStats('All');
  
  const colors = {
      Easy: 'text-emerald-500',
      Medium: 'text-amber-500',
      Hard: 'text-red-500',
      All: 'text-primary-500'
  };

  const ringColors = {
      Easy: 'stroke-emerald-500',
      Medium: 'stroke-amber-500',
      Hard: 'stroke-red-500',
      All: 'stroke-primary-500'
  };

  const bgRings = {
      Easy: 'stroke-emerald-100 dark:stroke-emerald-900/30',
      Medium: 'stroke-amber-100 dark:stroke-amber-900/30',
      Hard: 'stroke-red-100 dark:stroke-red-900/30',
      All: 'stroke-primary-100 dark:stroke-primary-900/30'
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 mt-2">
          <button onClick={() => navigate('/sql')} className="p-2 bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border text-gray-500 hover:text-slate-800 dark:text-gray-400 dark:hover:text-white rounded-xl shadow-sm transition-colors">
              <ArrowLeft size={20} />
          </button>
          <div>
              <h1 className="text-3xl font-extrabold text-slate-800 dark:text-white">Topic: {batch ? batch.name : topicId}</h1>
              <p className="text-slate-500 dark:text-slate-400 mt-1">Track your progress and solve problems related to {batch ? batch.name : topicId}.</p>
          </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {['All', 'Easy', 'Medium', 'Hard'].map(diff => {
              const stats = getStats(diff);
              if (stats.total === 0 && diff !== 'All') return null; // Don't show empty difficulties
              
              const pct = stats.total > 0 ? (stats.solved / stats.total) : 0;
              const radius = 30;
              const circumference = 2 * Math.PI * radius;
              const offset = circumference - (pct * circumference);
              
              return (
                  <div key={diff} className="bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border p-4 rounded-2xl shadow-sm flex items-center justify-between">
                      <div>
                          <p className="text-sm font-bold text-gray-500 dark:text-gray-400">{diff === 'All' ? 'Overall' : diff}</p>
                          <p className="text-2xl font-black text-slate-800 dark:text-white mt-1">
                              {stats.solved} <span className="text-sm font-medium text-gray-400">/ {stats.total}</span>
                          </p>
                          <p className="text-xs text-gray-400 font-medium mt-1">{stats.total - stats.solved} left</p>
                      </div>
                      <div className="relative w-16 h-16">
                          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 80 80">
                              <circle cx="40" cy="40" r={radius} strokeWidth="8" fill="transparent" className={bgRings[diff as keyof typeof bgRings]} />
                              <circle 
                                  cx="40" cy="40" r={radius} 
                                  strokeWidth="8" fill="transparent" 
                                  strokeLinecap="round"
                                  strokeDasharray={circumference} 
                                  strokeDashoffset={offset} 
                                  className={`${ringColors[diff as keyof typeof ringColors]} transition-all duration-1000 ease-out`} 
                              />
                          </svg>
                      </div>
                  </div>
              )
          })}
      </div>

      <div className="bg-white dark:bg-dark-card rounded-2xl shadow-sm border border-gray-200 dark:border-dark-border overflow-hidden">
        <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-gray-50 dark:bg-dark-surface border-b border-gray-200 dark:border-dark-border">
                    <tr>
                        <th className="px-6 py-4 font-semibold text-slate-600 dark:text-slate-300">Status</th>
                        <th className="px-6 py-4 font-semibold text-slate-600 dark:text-slate-300">Problem</th>
                        <th className="px-6 py-4 font-semibold text-slate-600 dark:text-slate-300">Difficulty</th>
                        <th className="px-6 py-4 font-semibold text-slate-600 dark:text-slate-300">Category</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-dark-border">
                    {problems.map(prob => {
                        const isSolved = submissions.some(s => s.problemId === prob.id && s.status === 'Accepted');
                        const isAttempted = submissions.some(s => s.problemId === prob.id);
                        
                        return (
                            <tr key={prob.id} className="hover:bg-gray-50 dark:hover:bg-dark-surface/50 transition-colors">
                                <td className="px-6 py-4">
                                    {isSolved ? (
                                        <CheckCircle2 size={18} className="text-emerald-500" />
                                    ) : isAttempted ? (
                                        <Circle size={18} className="text-amber-500 fill-amber-100 dark:fill-amber-900/30" />
                                    ) : (
                                        <Circle size={18} className="text-gray-300 dark:text-dark-border" />
                                    )}
                                </td>
                                <td className="px-6 py-4">
                                    <Link to={`/sql/problem/${prob.slug}`} className="font-bold text-slate-800 dark:text-white hover:text-primary-600 dark:hover:text-primary-400 transition-colors block">
                                        <span className="text-gray-400 dark:text-gray-500 mr-2">{prob.problemNumber}.</span>
                                        {prob.title}
                                    </Link>
                                </td>
                                <td className="px-6 py-4">
                                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                                        prob.difficulty === 'Easy' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                                        prob.difficulty === 'Medium' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                                        'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                    }`}>
                                        {prob.difficulty}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-gray-500 dark:text-gray-400 font-medium">
                                    {prob.category || 'Basic'}
                                </td>
                            </tr>
                        );
                    })}
                    {problems.length === 0 && (
                        <tr>
                            <td colSpan={4} className="p-8 text-center text-gray-500 dark:text-gray-400">
                                No problems found for this topic.
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
      </div>
    </div>
  );
}

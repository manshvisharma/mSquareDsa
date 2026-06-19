import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, getDocs, where } from 'firebase/firestore';
import { COLLECTIONS } from '../constants';
import { SQLProblem, SQLSubmission } from '../types';
import { Link } from 'react-router-dom';
import { useAuth } from '../App';
import { Search as SearchIcon, Filter, CheckCircle2, Circle } from 'lucide-react';

export default function SQLDashboard() {
  const { user } = useAuth();
  const [problems, setProblems] = useState<SQLProblem[]>([]);
  const [submissions, setSubmissions] = useState<SQLSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [difficultyFilter, setDifficultyFilter] = useState('All');
  const [tagFilter, setTagFilter] = useState('All');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setErrorMsg('');
      try {
          // Fetch published problems
          const q = query(collection(db, COLLECTIONS.SQL_PROBLEMS), where('published', '==', true));
          const snap = await getDocs(q);
          const loaded = snap.docs.map(d => d.data() as SQLProblem);
          
          // Fetch user submissions for these problems
          if (user) {
             const subQ = query(collection(db, COLLECTIONS.SQL_SUBMISSIONS), where('userId', '==', user.uid));
             const subSnap = await getDocs(subQ);
             const loadedSubs = subSnap.docs.map(d => d.data() as SQLSubmission);
             setSubmissions(loadedSubs);
          }
    
          setProblems(loaded);
      } catch (err: any) {
          if (err.message?.includes('Missing or insufficient permissions')) {
              setErrorMsg('Firebase permissions error: Please update your Firestore security rules to allow read/write access to the "sqlProblems" and "sqlSubmissions" collections.');
          } else {
              setErrorMsg(err.message || 'Error fetching data.');
          }
      }
      setLoading(false);
    };
    fetchData();
  }, [user]);

  const solvedProblemIds = new Set(submissions.filter(s => s.status === 'Accepted').map(s => s.problemId));

  const allTags = Array.from(new Set(problems.flatMap(p => p.tags || []))).sort();

  const filteredProblems = problems.filter(p => {
    const safeTags = p.tags || [];
    const matchesSearch = p.title.toLowerCase().includes(searchTerm.toLowerCase()) || safeTags.some(t => t.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesDiff = difficultyFilter === 'All' || p.difficulty === difficultyFilter;
    const matchesTag = tagFilter === 'All' || safeTags.includes(tagFilter);
    return matchesSearch && matchesDiff && matchesTag;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold text-slate-800 dark:text-white mt-4">SQL Practice Environment</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-2">Master SQL with interactive challenges in your browser.</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 mb-6">
         <div className="relative flex-1">
             <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
             <input 
                 type="text" 
                 placeholder="Search problems or tags..." 
                 value={searchTerm}
                 onChange={e => setSearchTerm(e.target.value)}
                 className="w-full pl-10 pr-4 py-2 bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-xl focus:ring-2 focus:ring-primary-500 text-slate-700 dark:text-white shadow-sm"
             />
         </div>
         <select 
             value={difficultyFilter}
             onChange={e => setDifficultyFilter(e.target.value)}
             className="px-4 py-2 bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-xl focus:ring-2 focus:ring-primary-500 text-slate-700 dark:text-white shadow-sm"
         >
             <option value="All">All Difficulties</option>
             <option value="Easy">Easy</option>
             <option value="Medium">Medium</option>
             <option value="Hard">Hard</option>
         </select>
         <select 
             value={tagFilter}
             onChange={e => setTagFilter(e.target.value)}
             className="px-4 py-2 bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-xl focus:ring-2 focus:ring-primary-500 text-slate-700 dark:text-white shadow-sm"
         >
             <option value="All">All Tags</option>
             {allTags.map(tag => (
                 <option key={tag} value={tag}>{tag}</option>
             ))}
         </select>
      </div>

      {errorMsg ? (
         <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/30 p-6 rounded-xl text-red-600 dark:text-red-400 font-medium">
             <p className="flex items-center gap-2">Failed to load data</p>
             <p className="mt-2 text-sm opacity-80">{errorMsg}</p>
         </div>
      ) : loading ? (
        <div className="text-center p-12 text-gray-500">Loading SQL problems...</div>
      ) : (
        <div className="bg-white dark:bg-dark-card rounded-xl shadow-sm border border-gray-200 dark:border-dark-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-gray-50 dark:bg-dark-surface border-b border-gray-200 dark:border-dark-border">
                <tr>
                  <th className="px-6 py-4 font-semibold text-slate-600 dark:text-slate-300 w-12">Status</th>
                  <th className="px-6 py-4 font-semibold text-slate-600 dark:text-slate-300">Title</th>
                  <th className="px-6 py-4 font-semibold text-slate-600 dark:text-slate-300">Difficulty</th>
                  <th className="px-6 py-4 font-semibold text-slate-600 dark:text-slate-300">Tags</th>
                  <th className="px-6 py-4 font-semibold text-slate-600 dark:text-slate-300">Database</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-dark-border">
                {filteredProblems.map(prob => {
                  const isSolved = solvedProblemIds.has(prob.id);
                  return (
                    <tr key={prob.id} className="hover:bg-gray-50 dark:hover:bg-dark-surface/50 transition-colors group">
                      <td className="px-6 py-4">
                        {isSolved ? (
                            <CheckCircle2 size={20} className="text-emerald-500" />
                        ) : (
                            <Circle size={20} className="text-gray-300 dark:text-gray-600" />
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <Link to={`/sql/problem/${prob.slug}`} className="font-bold text-slate-800 dark:text-gray-200 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                            {prob.title}
                        </Link>
                      </td>
                      <td className="px-6 py-4">
                          <span className={`text-xs font-bold ${
                              prob.difficulty === 'Easy' ? 'text-emerald-600 dark:text-emerald-400' :
                              prob.difficulty === 'Medium' ? 'text-amber-600 dark:text-amber-400' :
                              'text-red-600 dark:text-red-400'
                          }`}>
                              {prob.difficulty}
                          </span>
                      </td>
                      <td className="px-6 py-4">
                          <div className="flex flex-wrap gap-1.5">
                              {(prob.tags || []).map(tag => (
                                  <span key={tag} className="px-2 py-0.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-800/30 rounded-md text-[10px] font-semibold whitespace-nowrap">
                                      {tag}
                                  </span>
                              ))}
                          </div>
                      </td>
                      <td className="px-6 py-4">
                          <span className="text-xs font-bold px-2 py-1 bg-gray-100 dark:bg-dark-surface rounded text-slate-600 dark:text-slate-400">{prob.databaseType}</span>
                      </td>
                    </tr>
                  );
                })}
                {filteredProblems.length === 0 && (
                    <tr><td colSpan={5} className="p-8 text-center text-gray-500">No SQL problems match your criteria.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

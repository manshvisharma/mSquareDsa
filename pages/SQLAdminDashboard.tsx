import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, getDocs, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { COLLECTIONS } from '../constants';
import { SQLProblem, SQLTopicBatch } from '../types';
import { Plus, Edit2, Trash2, X, FileJson, Check, AlertCircle, Layers } from 'lucide-react';

export default function SQLAdminDashboard() {
  const [problems, setProblems] = useState<SQLProblem[]>([]);
  const [batches, setBatches] = useState<SQLTopicBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'problems' | 'batches'>('problems');

  const [editingProblem, setEditingProblem] = useState<SQLProblem | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [importJson, setImportJson] = useState('');
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [expectedOutputText, setExpectedOutputText] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [sortField, setSortField] = useState<'problemNumber' | 'title' | 'difficulty'>('problemNumber');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const [showTopicModal, setShowTopicModal] = useState(false);
  const [topicStart, setTopicStart] = useState<number | ''>('');
  const [topicEnd, setTopicEnd] = useState<number | ''>('');
  const [topicName, setTopicName] = useState('');
  const [editingBatchId, setEditingBatchId] = useState<string | null>(null);

  const [errorMsg, setErrorMsg] = useState('');

  const fetchProblems = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
        const q = query(collection(db, COLLECTIONS.SQL_PROBLEMS));
        const snap = await getDocs(q);
        const loaded = snap.docs.map(d => ({ id: d.id, ...d.data() } as SQLProblem));
        setProblems(loaded);
        setSelectedIds(new Set()); // Reset selections on fetch

        // Fetch batches as well
        const bSnap = await getDocs(query(collection(db, COLLECTIONS.SQL_TOPIC_BATCHES)));
        setBatches(bSnap.docs.map(d => ({ id: d.id, ...d.data() } as SQLTopicBatch)));
    } catch (err: any) {
        if (err.message?.includes('Missing or insufficient permissions')) {
            setErrorMsg('Firebase permissions error: Please update your Firestore security rules to allow read/write access to the "sqlProblems" collection.');
        } else {
            setErrorMsg(err.message || 'Error fetching problems.');
        }
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchProblems();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProblem) return;
    
    let parsedOutput = [];
    try {
        parsedOutput = JSON.parse(expectedOutputText);
    } catch(err) {
        alert("Invalid JSON in Expected Output. Please fix it before saving.");
        return;
    }

    // Auto generate slug if empty
    let finalSlug = editingProblem.slug.trim();
    if (!finalSlug) {
      finalSlug = editingProblem.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
    }
    
    const problemToSave = {
      ...editingProblem,
      slug: finalSlug,
      expectedOutput: parsedOutput,
      updatedAt: Date.now()
    };
    
    if (!problemToSave.id) {
       problemToSave.id = doc(collection(db, COLLECTIONS.SQL_PROBLEMS)).id;
       problemToSave.createdAt = Date.now();
    }
    
    try {
        await setDoc(doc(db, COLLECTIONS.SQL_PROBLEMS, problemToSave.id), problemToSave);
        setShowModal(false);
        fetchProblems();
    } catch (err: any) {
        if (err.message?.includes('Missing or insufficient permissions')) {
            alert('Firebase permissions error: Could not save the problem. Please update your Firestore security rules to allow read/write access to "sqlProblems".');
        } else {
            alert("Error saving problem: " + err.message);
        }
    }
  };

  const openNewModal = () => {
    setEditingProblem({
      id: '',
      problemNumber: 0,
      title: '',
      slug: '',
      difficulty: 'Easy',
      category: 'Basic',
      tags: [],
      description: '',
      constraints: [],
      notes: '',
      hints: [],
      databaseType: 'PostgreSQL',
      visibleSetupSql: '',
      hiddenSetupSql: '',
      starterQuery: '',
      sampleExplanation: '',
      solutionQuery: '',
      expectedOutput: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      published: false
    });
    setExpectedOutputText('[]');
    setShowModal(true);
  };

  const openEditModal = (problem: SQLProblem) => {
    setEditingProblem({ ...problem });
    setExpectedOutputText(JSON.stringify(problem.expectedOutput || [], null, 2));
    setShowModal(true);
  };

  const [problemToDelete, setProblemToDelete] = useState<string | null>(null);

  const confirmDelete = async () => {
    if (!problemToDelete) return;
    try {
        await deleteDoc(doc(db, COLLECTIONS.SQL_PROBLEMS, problemToDelete));
        fetchProblems();
    } catch (err: any) {
        if (err.message?.includes('Missing or insufficient permissions')) {
            alert('Firebase permissions error: Could not delete the problem. Please update your Firestore security rules.');
        } else {
            alert("Error deleting problem: " + err.message);
        }
    }
    setProblemToDelete(null);
  };

  const handleImport = async () => {
    try {
      const data = JSON.parse(importJson);
      if (!Array.isArray(data)) throw new Error("JSON must be an array of problems");
      
      for (const item of data) {
         let finalSlug = item.slug?.trim() || item.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
         const problemId = doc(collection(db, COLLECTIONS.SQL_PROBLEMS)).id;
         const problem: SQLProblem = {
            id: problemId,
            problemNumber: item.problemNumber || 0,
            title: item.title || 'Untitled',
            slug: finalSlug,
            difficulty: item.difficulty || 'Easy',
            category: item.category || 'Uncategorized',
            tags: item.tags || [],
            description: item.description || '',
            constraints: item.constraints || [],
            notes: item.notes || '',
            hints: item.hints || [],
            databaseType: item.databaseType || 'PostgreSQL',
            visibleSetupSql: item.visibleSetupSql || '',
            hiddenSetupSql: item.hiddenSetupSql || '',
            sampleTestCases: item.sampleTestCases || [],
            hiddenTestCases: item.hiddenTestCases || [],
            validationQuery: item.validationQuery || '',
            solutionQuery: item.solutionQuery || '',
            starterQuery: item.starterQuery || '',
            sampleExplanation: item.sampleExplanation || '',
            expectedOutput: item.expectedOutput || [],
            createdAt: Date.now(),
            updatedAt: Date.now(),
            published: item.published ?? false
         };
         await setDoc(doc(db, COLLECTIONS.SQL_PROBLEMS, problemId), problem);
      }
      alert('Import successful!');
      setShowImportDialog(false);
      setImportJson('');
      fetchProblems();
    } catch (err: any) {
      if (err.message?.includes('Missing or insufficient permissions')) {
          alert('Firebase permissions error: Could not import problems. Please update your Firestore security rules to allow read/write access to "sqlProblems".');
      } else {
          alert("Import failed: " + err.message);
      }
    }
  };

  const handleBulkDelete = async () => {
      if (!window.confirm(`Are you sure you want to delete ${selectedIds.size} problems?`)) return;
      try {
          for (const id of selectedIds) {
              await deleteDoc(doc(db, COLLECTIONS.SQL_PROBLEMS, id));
          }
          fetchProblems();
      } catch (err: any) {
          alert("Error bulk deleting: " + err.message);
      }
  };

  const handleBulkStatusChange = async (published: boolean) => {
      try {
          for (const id of selectedIds) {
              await setDoc(doc(db, COLLECTIONS.SQL_PROBLEMS, id), { published }, { merge: true });
          }
          fetchProblems();
      } catch (err: any) {
          alert("Error updating status: " + err.message);
      }
  };

  const toggleSelectAll = () => {
      if (selectedIds.size === problems.length) {
          setSelectedIds(new Set());
      } else {
          setSelectedIds(new Set(problems.map(p => p.id)));
      }
  };

  const toggleSelect = (id: string) => {
      const newSet = new Set(selectedIds);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      setSelectedIds(newSet);
  };

  const handleSaveBatch = async () => {
    if (topicStart === '' || topicEnd === '' || !topicName.trim()) {
        return alert("Please enter valid start number, end number, and topic name.");
    }
    const start = Number(topicStart);
    const end = Number(topicEnd);
    
    if (start > end) {
        return alert("Start number cannot be greater than end number.");
    }

    // Check count of problems that will fall into this batch
    const problemCount = problems.filter(p => (p.problemNumber || 0) >= start && (p.problemNumber || 0) <= end).length;
    
    // Instead of assigning to problems, we store the batch logic in SQL_TOPIC_BATCHES
    const batchId = editingBatchId || doc(collection(db, COLLECTIONS.SQL_TOPIC_BATCHES)).id;
    
    const batchDoc: SQLTopicBatch = {
        name: topicName.trim(),
        startRange: start,
        endRange: end
    };

    try {
        await setDoc(doc(db, COLLECTIONS.SQL_TOPIC_BATCHES, batchId), batchDoc);
        
        // Remove 'category' from any matching problems to prevent old topic logic overlap
        // We do this silently in background
        const toUpdate = problems.filter(p => (p.problemNumber || 0) >= start && (p.problemNumber || 0) <= end && p.category);
        for(const p of toUpdate) {
            await setDoc(doc(db, COLLECTIONS.SQL_PROBLEMS, p.id), { category: null }, { merge: true });
        }
        
        setShowTopicModal(false);
        setTopicStart('');
        setTopicEnd('');
        setTopicName('');
        setEditingBatchId(null);
        alert(`Saved batch topic. Covers ${problemCount} current problems.`);
        fetchProblems(); // refetches both problems and batches
    } catch (err: any) {
        alert("Error saving batch: " + err.message);
    }
  };

  const handleDeleteBatch = async (batchId: string) => {
    if (!window.confirm("Are you sure you want to delete this batch? (Problems will not be deleted)")) return;
    try {
        await deleteDoc(doc(db, COLLECTIONS.SQL_TOPIC_BATCHES, batchId));
        fetchProblems();
    } catch (err: any) {
        alert("Error deleting batch: " + err.message);
    }
  };

  const openNewBatchModal = () => {
      setEditingBatchId(null);
      setTopicName('');
      setTopicStart('');
      setTopicEnd('');
      setShowTopicModal(true);
  };

  const openEditBatchModal = (b: SQLTopicBatch) => {
      setEditingBatchId(b.id!);
      setTopicName(b.name);
      setTopicStart(b.startRange);
      setTopicEnd(b.endRange);
      setShowTopicModal(true);
  };

  const handleSort = (field: 'problemNumber' | 'title' | 'difficulty') => {
      if (sortField === field) {
          setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
      } else {
          setSortField(field);
          setSortDir('asc');
      }
  };

  const sortedProblems = [...problems].sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];
      if (sortField === 'title') {
          valA = String(valA || '').toLowerCase();
          valB = String(valB || '').toLowerCase();
      }
      
      // Handle difficulty custom sort: Easy < Medium < Hard
      if (sortField === 'difficulty') {
          const rank = { 'Easy': 1, 'Medium': 2, 'Hard': 3 };
          valA = rank[valA as keyof typeof rank] || 0;
          valB = rank[valB as keyof typeof rank] || 0;
      }

      if (valA < valB) return sortDir === 'asc' ? -1 : 1;
      if (valA > valB) return sortDir === 'asc' ? 1 : -1;
      return 0;
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">SQL Practice Admin</h1>
          <p className="text-slate-500 dark:text-slate-400">Manage interactive SQL problems</p>
        </div>
        <div className="flex gap-3 text-sm">
            {activeTab === 'batches' ? (
                <button 
                    onClick={openNewBatchModal}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2 shadow-sm"
                >
                    <Plus size={16} /> Create Batch Topic
                </button>
            ) : (
                <>
                    <button 
                        onClick={() => setShowImportDialog(true)}
                        className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-dark-surface dark:hover:bg-dark-border text-slate-700 dark:text-slate-200 rounded-lg font-medium transition-colors flex items-center gap-2"
                    >
                        <FileJson size={18} /> Bulk Import
                    </button>
                    <button 
                        onClick={openNewModal}
                        className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2 shadow-sm"
                    >
                        <Plus size={18} /> Add Problem
                    </button>
                </>
            )}
        </div>
      </div>

      <div className="flex gap-4 border-b border-gray-200 dark:border-dark-border">
          <button 
              onClick={() => setActiveTab('problems')} 
              className={`pb-3 text-sm font-bold transition-colors ${activeTab === 'problems' ? 'text-primary-600 dark:text-primary-400 border-b-2 border-primary-600 dark:border-primary-400' : 'text-gray-500 hover:text-slate-800 dark:hover:text-gray-200'}`}
          >
              Problems ({problems.length})
          </button>
          <button 
              onClick={() => setActiveTab('batches')} 
              className={`pb-3 text-sm font-bold transition-colors ${activeTab === 'batches' ? 'text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400' : 'text-gray-500 hover:text-slate-800 dark:hover:text-gray-200'}`}
          >
              Topic Batches ({batches.length})
          </button>
      </div>

      {errorMsg ? (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/30 p-6 rounded-xl text-red-600 dark:text-red-400 font-medium">
          <p className="flex items-center gap-2"><AlertCircle size={20} /> Failed to load data</p>
          <p className="mt-2 text-sm opacity-80">{errorMsg}</p>
        </div>
      ) : loading ? (
        <div className="text-center p-12 text-gray-500">Loading data...</div>
      ) : activeTab === 'batches' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {batches.length === 0 && (
                <div className="col-span-full p-8 text-center text-gray-500 border border-dashed border-gray-300 dark:border-dark-border rounded-xl">
                    No topic batches created yet.
                </div>
            )}
            {batches.map(b => {
                const count = problems.filter(p => (p.problemNumber || 0) >= b.startRange && (p.problemNumber || 0) <= b.endRange).length;
                return (
                    <div key={b.id} className="bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-xl p-5 shadow-sm relative group">
                        <div className="flex justify-between items-start mb-2">
                            <h3 className="font-bold text-slate-800 dark:text-white text-lg flex items-center gap-2">
                                <Layers size={18} className="text-indigo-500" />
                                {b.name}
                            </h3>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => openEditBatchModal(b)} className="p-1.5 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-md hover:bg-gray-100 dark:hover:bg-dark-surface"><Edit2 size={14}/></button>
                                <button onClick={() => handleDeleteBatch(b.id!)} className="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20"><Trash2 size={14}/></button>
                            </div>
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                            From problem #<span className="font-bold text-slate-700 dark:text-gray-300">{b.startRange}</span> to #<span className="font-bold text-slate-700 dark:text-gray-300">{b.endRange}</span>
                        </div>
                        <div className="bg-gray-50 dark:bg-dark-surface px-3 py-2 rounded-lg inline-flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-300 border border-gray-100 dark:border-dark-border">
                            <span>{count}</span> problems matched
                        </div>
                    </div>
                );
            })}
        </div>
      ) : (
        <div className="bg-white dark:bg-dark-card rounded-xl shadow-sm border border-gray-200 dark:border-dark-border overflow-hidden">
          {selectedIds.size > 0 && (
              <div className="bg-primary-50 dark:bg-primary-900/20 px-6 py-3 border-b border-primary-100 dark:border-primary-900/30 flex items-center justify-between">
                  <span className="text-primary-700 dark:text-primary-400 font-bold text-sm">{selectedIds.size} selected</span>
                  <div className="flex gap-2">
                      <button onClick={() => handleBulkStatusChange(true)} className="px-3 py-1.5 bg-white dark:bg-dark-surface border border-gray-200 dark:border-dark-border rounded text-sm font-medium text-emerald-600 dark:text-emerald-400 hover:bg-gray-50 dark:hover:bg-dark-border">Publish Selected</button>
                      <button onClick={() => handleBulkStatusChange(false)} className="px-3 py-1.5 bg-white dark:bg-dark-surface border border-gray-200 dark:border-dark-border rounded text-sm font-medium text-amber-600 dark:text-amber-400 hover:bg-gray-50 dark:hover:bg-dark-border">Draft Selected</button>
                      <button onClick={handleBulkDelete} className="px-3 py-1.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/30 rounded text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40">Delete Selected</button>
                  </div>
              </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-gray-50 dark:bg-dark-surface border-b border-gray-200 dark:border-dark-border">
                <tr>
                  <th className="px-6 py-4 w-12">
                      <input 
                          type="checkbox" 
                          checked={selectedIds.size === sortedProblems.length && sortedProblems.length > 0} 
                          onChange={toggleSelectAll}
                          className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 w-4 h-4"
                      />
                  </th>
                  <th className="px-6 py-4 font-semibold text-slate-600 dark:text-slate-300">
                      <div className="flex items-center gap-2">
                        <span onClick={() => handleSort('problemNumber')} className="cursor-pointer hover:text-slate-800 dark:hover:text-white">
                            No. {sortField === 'problemNumber' && (sortDir === 'asc' ? '↑' : '↓')}
                        </span>
                        <span>/</span>
                        <span onClick={() => handleSort('title')} className="cursor-pointer hover:text-slate-800 dark:hover:text-white">
                            Title / Slug {sortField === 'title' && (sortDir === 'asc' ? '↑' : '↓')}
                        </span>
                      </div>
                  </th>
                  <th onClick={() => handleSort('difficulty')} className="px-6 py-4 font-semibold text-slate-600 dark:text-slate-300 cursor-pointer hover:bg-gray-100 dark:hover:bg-dark-border transition-colors">
                      Difficulty {sortField === 'difficulty' && (sortDir === 'asc' ? '↑' : '↓')}
                  </th>
                  <th className="px-6 py-4 font-semibold text-slate-600 dark:text-slate-300">DB Type</th>
                  <th className="px-6 py-4 font-semibold text-slate-600 dark:text-slate-300">Status</th>
                  <th className="px-6 py-4 font-semibold text-slate-600 dark:text-slate-300 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-dark-border">
                {sortedProblems.map(prob => (
                  <tr key={prob.id} className={`transition-colors ${selectedIds.has(prob.id) ? 'bg-primary-50/50 dark:bg-primary-900/10' : 'hover:bg-gray-50 dark:hover:bg-dark-surface/50'}`}>
                    <td className="px-6 py-4">
                        <input 
                            type="checkbox" 
                            checked={selectedIds.has(prob.id)} 
                            onChange={() => toggleSelect(prob.id)}
                            className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 w-4 h-4"
                        />
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-800 dark:text-gray-200 cursor-pointer" onClick={() => openEditModal(prob)}>
                        <span className="text-gray-500 mr-2">{prob.problemNumber || 0}.</span>
                        {prob.title}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">/{prob.slug}</div>
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
                    <td className="px-6 py-4">
                        <span className="px-2 py-1 bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 text-xs rounded font-medium border border-blue-100 dark:border-blue-800/30">{prob.databaseType}</span>
                    </td>
                    <td className="px-6 py-4">
                        {prob.published ? (
                            <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 text-xs font-bold"><Check size={14}/> Published</span>
                        ) : (
                            <span className="flex items-center gap-1 text-gray-500 dark:text-gray-400 text-xs font-bold"><AlertCircle size={14} /> Draft</span>
                        )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button onClick={() => openEditModal(prob)} className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors mr-2">
                        <Edit2 size={16} />
                      </button>
                      <button onClick={() => setProblemToDelete(prob.id)} className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors">
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
                {problems.length === 0 && (
                    <tr><td colSpan={6} className="p-8 text-center text-gray-500">No SQL problems found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {problemToDelete && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-dark-card w-full max-w-sm rounded-2xl p-6 shadow-2xl border border-gray-200 dark:border-dark-border text-center">
            <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 size={32} className="text-red-600 dark:text-red-400" />
            </div>
            <h2 className="text-xl font-bold dark:text-white mb-2">Delete Problem?</h2>
            <p className="text-gray-500 mb-6 font-medium">This action cannot be undone. Are you sure you want to delete this problem?</p>
            <div className="flex gap-3 justify-center">
              <button type="button" onClick={() => setProblemToDelete(null)} className="px-5 py-2.5 rounded-lg font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-dark-border transition-colors w-full">Cancel</button>
              <button onClick={confirmDelete} className="px-5 py-2.5 rounded-lg font-bold text-white bg-red-600 hover:bg-red-700 shadow-md w-full">Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Batch Topic Modal */}
      {showTopicModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-dark-card w-full max-w-md rounded-2xl p-6 shadow-2xl border border-gray-200 dark:border-dark-border">
            <h2 className="text-xl font-bold dark:text-white mb-4">{editingBatchId ? 'Edit Batch Topic' : 'Create Batch Topic'}</h2>
            <p className="text-sm text-gray-500 mb-4">Define a topic that groups a range of existing problems. This helps users discover problems by topic without needing to tag every problem individually.</p>
            
            <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Start No.</label>
                        <input type="number" value={topicStart} onChange={e => setTopicStart(e.target.value ? Number(e.target.value) : '')} className="w-full p-2.5 rounded-lg border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-surface dark:text-white focus:ring-2 focus:ring-primary-500" placeholder="e.g. 1" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">End No.</label>
                        <input type="number" value={topicEnd} onChange={e => setTopicEnd(e.target.value ? Number(e.target.value) : '')} className="w-full p-2.5 rounded-lg border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-surface dark:text-white focus:ring-2 focus:ring-primary-500" placeholder="e.g. 5" />
                    </div>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Topic Name</label>
                    <input type="text" value={topicName} onChange={e => setTopicName(e.target.value)} className="w-full p-2.5 rounded-lg border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-surface dark:text-white focus:ring-2 focus:ring-primary-500" placeholder="e.g. DML or Joins" />
                </div>
            </div>

            <div className="flex gap-3 justify-end mt-6">
              <button type="button" onClick={() => setShowTopicModal(false)} className="px-5 py-2.5 rounded-lg font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-dark-border transition-colors">Cancel</button>
              <button onClick={handleSaveBatch} className="px-5 py-2.5 rounded-lg font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-md">
                {editingBatchId ? 'Save Changes' : 'Create Batch'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Editor Modal */}
      {showModal && editingProblem && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-dark-card w-full max-w-5xl max-h-[90vh] flex flex-col rounded-2xl shadow-2xl overflow-hidden border border-gray-200 dark:border-dark-border">
            <div className="p-6 border-b border-gray-100 dark:border-dark-border flex justify-between items-center shrink-0">
              <h2 className="text-xl font-bold dark:text-white">
                {editingProblem.id ? 'Edit Problem' : 'New SQL Problem'}
              </h2>
              <button type="button" onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                <X size={24} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                <form id="problemFrom" onSubmit={handleSave} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Problem Number (ID)</label>
                            <input required type="number" value={editingProblem.problemNumber || 0} onChange={e => setEditingProblem({...editingProblem, problemNumber: parseInt(e.target.value) || 0})} className="w-full p-2.5 rounded-lg border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-surface dark:text-white focus:ring-2 focus:ring-primary-500" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Title</label>
                            <input required type="text" value={editingProblem.title} onChange={e => setEditingProblem({...editingProblem, title: e.target.value})} className="w-full p-2.5 rounded-lg border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-surface dark:text-white focus:ring-2 focus:ring-primary-500" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Slug (auto-generated if empty)</label>
                            <input type="text" value={editingProblem.slug} onChange={e => setEditingProblem({...editingProblem, slug: e.target.value})} className="w-full p-2.5 rounded-lg border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-surface dark:text-white focus:ring-2 focus:ring-primary-500" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Difficulty</label>
                            <select value={editingProblem.difficulty} onChange={e => setEditingProblem({...editingProblem, difficulty: e.target.value as any})} className="w-full p-2.5 rounded-lg border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-surface dark:text-white focus:ring-2 focus:ring-primary-500">
                                <option>Easy</option>
                                <option>Medium</option>
                                <option>Hard</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Database Type</label>
                            <select value={editingProblem.databaseType} onChange={e => setEditingProblem({...editingProblem, databaseType: e.target.value as any})} className="w-full p-2.5 rounded-lg border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-surface dark:text-white focus:ring-2 focus:ring-primary-500">
                                <option>PostgreSQL</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Category</label>
                            <input type="text" value={editingProblem.category} onChange={e => setEditingProblem({...editingProblem, category: e.target.value})} className="w-full p-2.5 rounded-lg border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-surface dark:text-white focus:ring-2 focus:ring-primary-500" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tags (comma separated)</label>
                            <input type="text" value={editingProblem.tags.join(', ')} onChange={e => setEditingProblem({...editingProblem, tags: e.target.value.split(',').map(s=>s.trim()).filter(Boolean)})} placeholder="JOIN, GROUP BY" className="w-full p-2.5 rounded-lg border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-surface dark:text-white focus:ring-2 focus:ring-primary-500" />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description (Markdown Supported)</label>
                        <textarea required rows={5} value={editingProblem.description} onChange={e => setEditingProblem({...editingProblem, description: e.target.value})} className="w-full p-2.5 rounded-lg border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-surface dark:text-white focus:ring-2 focus:ring-primary-500 font-mono text-sm" />
                    </div>
                    
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Visible Sample Test Cases (Creates tables & populates data)</label>
                            <button type="button" onClick={() => setEditingProblem({...editingProblem, sampleTestCases: [...(editingProblem.sampleTestCases || []), '']})} className="text-xs font-semibold text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20 px-2.5 py-1 rounded-md hover:bg-primary-100 transition-colors">+ Add Sample Case</button>
                        </div>
                        {(editingProblem.sampleTestCases || []).length === 0 && (
                            <div className="text-xs text-gray-500 italic mb-2">No sample test cases defined.</div>
                        )}
                        <div className="space-y-3">
                            {(editingProblem.sampleTestCases || []).map((tc, idx) => (
                                <div key={idx} className="relative">
                                    <textarea rows={4} value={tc} onChange={e => {
                                        const newArr = [...(editingProblem.sampleTestCases || [])];
                                        newArr[idx] = e.target.value;
                                        setEditingProblem({...editingProblem, sampleTestCases: newArr});
                                    }} className="w-full p-2.5 rounded-lg border border-gray-300 dark:border-dark-border bg-slate-50 dark:bg-[#1e1e1e] dark:text-gray-300 font-mono text-sm focus:ring-2 focus:ring-primary-500 text-blue-600 dark:text-blue-400" placeholder={`-- Sample Test Case ${idx + 1}\nCREATE TABLE ...`} />
                                    <button type="button" onClick={() => {
                                        const newArr = [...(editingProblem.sampleTestCases || [])];
                                        newArr.splice(idx, 1);
                                        setEditingProblem({...editingProblem, sampleTestCases: newArr});
                                    }} className="absolute top-2 right-2 p-1 text-red-500 hover:bg-red-50 rounded dark:hover:bg-red-900/20"><Trash2 size={16}/></button>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div>
                        <div className="flex items-center justify-between mb-2 mt-4">
                            <label className="text-sm font-medium text-purple-700 dark:text-purple-400">Hidden Evaluation Test Cases (Optional evaluation behind the scenes)</label>
                            <button type="button" onClick={() => setEditingProblem({...editingProblem, hiddenTestCases: [...(editingProblem.hiddenTestCases || []), '']})} className="text-xs font-semibold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20 px-2.5 py-1 rounded-md hover:bg-purple-100 transition-colors">+ Add Hidden Case</button>
                        </div>
                        {(editingProblem.hiddenTestCases || []).length === 0 && (
                            <div className="text-xs text-purple-400/70 italic mb-2">No hidden test cases defined.</div>
                        )}
                        <div className="space-y-3">
                            {(editingProblem.hiddenTestCases || []).map((tc, idx) => (
                                <div key={idx} className="relative">
                                    <textarea rows={4} value={tc} onChange={e => {
                                        const newArr = [...(editingProblem.hiddenTestCases || [])];
                                        newArr[idx] = e.target.value;
                                        setEditingProblem({...editingProblem, hiddenTestCases: newArr});
                                    }} className="w-full p-2.5 rounded-lg border border-purple-200 dark:border-purple-900 bg-purple-50 dark:bg-purple-900/10 dark:text-gray-300 font-mono text-sm focus:ring-2 focus:ring-purple-500 text-purple-600 dark:text-purple-400" placeholder={`-- Hidden Test Case ${idx + 1}\nCREATE TABLE ...`} />
                                    <button type="button" onClick={() => {
                                        const newArr = [...(editingProblem.hiddenTestCases || [])];
                                        newArr.splice(idx, 1);
                                        setEditingProblem({...editingProblem, hiddenTestCases: newArr});
                                    }} className="absolute top-2 right-2 p-1 text-red-500 hover:bg-red-50 rounded dark:hover:bg-red-900/20"><Trash2 size={16}/></button>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-purple-700 dark:text-purple-400 mb-1">Solution Query (For Dynamic Eval)</label>
                            <textarea rows={3} value={editingProblem.solutionQuery || ''} onChange={e => setEditingProblem({...editingProblem, solutionQuery: e.target.value})} className="w-full p-2.5 rounded-lg border border-purple-200 dark:border-purple-900 bg-purple-50 dark:bg-[#1e1e1e] dark:text-gray-300 font-mono text-sm focus:ring-2 focus:ring-purple-500" placeholder="SELECT * FROM Employee;" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Validation Query (Overrides user select logic)</label>
                            <textarea rows={3} value={editingProblem.validationQuery || ''} onChange={e => setEditingProblem({...editingProblem, validationQuery: e.target.value})} className="w-full p-2.5 rounded-lg border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-surface dark:text-white font-mono text-xs focus:ring-2 focus:ring-primary-500" placeholder="SELECT * FROM OutputTable ORDER BY id;" />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Starter Query</label>
                            <textarea rows={3} value={editingProblem.starterQuery} onChange={e => setEditingProblem({...editingProblem, starterQuery: e.target.value})} className="w-full p-2.5 rounded-lg border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-surface dark:text-white font-mono text-sm focus:ring-2 focus:ring-primary-500" placeholder="SELECT * FROM Employee;" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Expected Output Fallback (JSON)</label>
                            <textarea rows={3} value={expectedOutputText} onChange={e => setExpectedOutputText(e.target.value)} className="w-full p-2.5 rounded-lg border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-surface dark:text-white font-mono text-xs focus:ring-2 focus:ring-primary-500" placeholder={'[{"name": "John"}]'} />
                        </div>
                    </div>

                    {/* Published Toggle */}
                    <div className="flex items-center gap-3">
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" checked={editingProblem.published} onChange={e => setEditingProblem({...editingProblem, published: e.target.checked})} className="sr-only peer" />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary-600"></div>
                            <span className="ml-3 text-sm font-bold text-gray-900 dark:text-gray-300">Published to users</span>
                        </label>
                    </div>

                </form>
            </div>
            
            <div className="p-6 border-t border-gray-100 dark:border-dark-border flex justify-end gap-3 bg-gray-50 dark:bg-dark-surface/50 shrink-0">
               <button type="button" onClick={() => setShowModal(false)} className="px-5 py-2.5 rounded-lg font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-dark-border transition-colors">Cancel</button>
               <button type="submit" form="problemFrom" className="px-5 py-2.5 rounded-lg font-bold text-white bg-primary-600 hover:bg-primary-700 shadow-md">Save Problem</button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Import JSON */}
      {showImportDialog && (
         <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-dark-card w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl shadow-2xl border border-gray-200 dark:border-dark-border overflow-hidden">
                <div className="p-6 border-b border-gray-100 dark:border-dark-border flex justify-between items-center shrink-0">
                    <h2 className="text-xl font-bold dark:text-white">Bulk Import Problems</h2>
                    <button type="button" onClick={() => setShowImportDialog(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                        <X size={24} />
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                    <p className="text-sm text-gray-500 mb-3">Paste a JSON array of problem objects. All fields from the individual problem form are supported, including multi-testcase support with `sampleTestCases` and `hiddenTestCases`.</p>
                    <button onClick={() => setImportJson(JSON.stringify([
                        {
                            "problemNumber": 1,
                            "title": "Combine Two Tables",
                            "slug": "combine-two-tables",
                            "difficulty": "Easy",
                            "category": "Joins",
                            "tags": ["LEFT JOIN", "Database"],
                            "description": "Table: `Person`\n\n| Column Name | Type    |\n|-------------|---------|\n| personId    | int     |\n| lastName    | varchar |\n| firstName   | varchar |\n\n`personId` is the primary key (column with unique values) for this table.\nThis table contains information about the ID of some persons and their first and last names.\n\nTable: `Address`\n\n| Column Name | Type    |\n|-------------|---------|\n| addressId   | int     |\n| personId    | int     |\n| city        | varchar |\n| state       | varchar |\n\n`addressId` is the primary key (column with unique values) for this table.\nEach row of this table contains information about the city and state of one person with ID = `personId`.\n\n---\n\nWrite a SQL query to report the first name, last name, city, and state of each person in the `Person` table. If the address of a `personId` is not present in the `Address` table, report `null` instead.\n\nReturn the result table in **any order**.\n\n### Example 1:\n\n**Input:**\nPerson table:\n| personId | lastName | firstName |\n| --- | --- | --- |\n| 1 | Wang | Allen |\n| 2 | Alice | Bob |\n\nAddress table:\n| addressId | personId | city | state |\n| --- | --- | --- | --- |\n| 1 | 2 | New York City | New York |\n| 2 | 3 | Leetcode | California |\n\n**Output:**\n| firstName | lastName | city | state |\n| --- | --- | --- | --- |\n| Allen | Wang | null | null |\n| Bob | Alice | New York City | New York |\n\n**Explanation:**\nThere is no address in the address table for the personId 1 so we return null in their city and state. addressId 1 contains information about the address of personId 2.",
                            "databaseType": "PostgreSQL",
                            "sampleTestCases": ["CREATE TABLE Person (personId INT, lastName VARCHAR, firstName VARCHAR);\nCREATE TABLE Address (addressId INT, personId INT, city VARCHAR, state VARCHAR);\n\nINSERT INTO Person VALUES (1, 'Wang', 'Allen'), (2, 'Alice', 'Bob');\nINSERT INTO Address VALUES (1, 2, 'New York City', 'New York'), (2, 3, 'Leetcode', 'California');"],
                            "hiddenTestCases": ["CREATE TABLE Person (personId INT, lastName VARCHAR, firstName VARCHAR);\nCREATE TABLE Address (addressId INT, personId INT, city VARCHAR, state VARCHAR);\n\nINSERT INTO Person VALUES (1, 'Wang', 'Allen'), (2, 'Alice', 'Bob'), (3, 'Smith', 'John');\nINSERT INTO Address VALUES (1, 2, 'New York City', 'New York'), (2, 3, 'Leetcode', 'California');"],
                            "starterQuery": "-- Write your PostgreSQL query statement below\n",
                            "solutionQuery": "SELECT p.firstName, p.lastName, a.city, a.state FROM Person p LEFT JOIN Address a ON p.personId = a.personId;",
                            "expectedOutput": [
                                { "firstName": "Allen", "lastName": "Wang", "city": "null", "state": "null" },
                                { "firstName": "Bob", "lastName": "Alice", "city": "New York City", "state": "New York" }
                            ],
                            "constraints": [],
                            "hints": ["Consider using a LEFT JOIN so that all persons are included even if they have no address."],
                            "sampleExplanation": "There is no address in the address table for `personId = 1` so we return null in their city and state. `addressId = 1` contains information about the address of `personId = 2`.",
                            "published": true
                        },
                        {
                            "problemNumber": 2,
                            "title": "Create Users Table",
                            "slug": "create-users-table",
                            "difficulty": "Easy",
                            "category": "DDL",
                            "tags": ["CREATE TABLE"],
                            "description": "Write a SQL query to create a table named `Users` with the following columns:\n\n- `id` of type `INT`\n- `name` of type `VARCHAR`\n- `email` of type `VARCHAR`\n\n### Example 1:\n\n**Input:**\nNo data setup.\n\n**Output:**\n| column_name | data_type |\n| --- | --- |\n| id | integer |\n| name | character varying |\n| email | character varying |\n\n**Explanation:**\nThe table is created with three columns.",
                            "databaseType": "PostgreSQL",
                            "sampleTestCases": [" "],
                            "hiddenTestCases": [" "],
                            "starterQuery": "-- Write your PostgreSQL query statement below to create the table\n",
                            "solutionQuery": "CREATE TABLE users (id INT, name VARCHAR, email VARCHAR);",
                            "validationQuery": "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'users' ORDER BY ordinal_position;",
                            "expectedOutput": [
                                { "column_name": "id", "data_type": "integer" },
                                { "column_name": "name", "data_type": "character varying" },
                                { "column_name": "email", "data_type": "character varying" }
                            ],
                            "constraints": ["Table must be named Users."],
                            "hints": ["Use the CREATE TABLE statement."],
                            "sampleExplanation": "",
                            "published": true
                        },
                        {
                            "problemNumber": 3,
                            "title": "High Earners",
                            "slug": "find-high-earners",
                            "difficulty": "Easy",
                            "category": "Filtering",
                            "tags": ["SELECT", "WHERE"],
                            "description": "Table: `Employees`\n\n| Column Name | Type    |\n|-------------|---------|\n| id          | int     |\n| name        | varchar |\n| salary      | int     |\n\n`id` is the primary key for this table.\n\n---\n\nWrite a SQL query to retrieve the `name` and `salary` of all employees who earn more than `$50,000`.\n\n### Example 1:\n\n**Input:**\nEmployees table:\n| id | name | salary |\n| --- | --- | --- |\n| 1 | Alice | 60000 |\n| 2 | Bob | 45000 |\n| 3 | Charlie | 55000 |\n\n**Output:**\n| name | salary |\n| --- | --- |\n| Alice | 60000 |\n| Charlie | 55000 |\n\n**Explanation:**\nBob only makes $45,000 so he is excluded from the results.",
                            "databaseType": "PostgreSQL",
                            "sampleTestCases": ["CREATE TABLE Employees (id INT, name VARCHAR, salary INT);\nINSERT INTO Employees VALUES (1, 'Alice', 60000), (2, 'Bob', 45000), (3, 'Charlie', 55000);"],
                            "hiddenTestCases": ["CREATE TABLE Employees (id INT, name VARCHAR, salary INT);\nINSERT INTO Employees VALUES (1, 'Alice', 60000), (2, 'Bob', 45000), (3, 'Charlie', 55000), (4, 'Dave', 70000), (5, 'Eve', 40000);"],
                            "starterQuery": "-- Select name and salary from Employees\n",
                            "solutionQuery": "SELECT name, salary FROM Employees WHERE salary > 50000;",
                            "expectedOutput": [{ "name": "Alice", "salary": 60000 }, { "name": "Charlie", "salary": 55000 }],
                            "constraints": ["Return only the name and salary columns."],
                            "hints": ["Use the WHERE clause to filter salaries larger than 50000."],
                            "sampleExplanation": "Bob only makes $45,000 so he is excluded from the results.",
                            "published": true
                        }
                    ], null, 2))} className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:hover:bg-blue-900/40 dark:text-blue-400 rounded-md text-sm font-bold transition-colors mb-4 inline-flex items-center gap-2">
                        Load Demo Problems
                    </button>
                    <textarea 
                        rows={16} 
                        className="w-full p-4 rounded-xl border border-gray-300 dark:border-dark-border bg-slate-50 dark:bg-[#1e1e1e] dark:text-gray-300 font-mono text-xs focus:ring-2 focus:ring-primary-500"
                        placeholder={`[\n  {\n    "problemNumber": 1,\n    "title": "High Earners",\n    "slug": "high-earners",\n    "difficulty": "Easy",\n    ... \n    "sampleTestCases": ["CREATE TABLE ..."],\n    "hiddenTestCases": ["CREATE TABLE ..."],\n    "solutionQuery": "SELECT ..."\n  }\n]`}
                        value={importJson}
                        onChange={(e) => setImportJson(e.target.value)}
                    />
                </div>
                <div className="p-6 border-t border-gray-100 dark:border-dark-border bg-gray-50 dark:bg-dark-surface/50 shrink-0 flex justify-end gap-3">
                    <button onClick={() => setShowImportDialog(false)} className="px-5 py-2.5 rounded-lg font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-dark-border transition-colors">Cancel</button>
                    <button onClick={handleImport} className="px-5 py-2.5 rounded-lg font-bold text-white bg-primary-600 hover:bg-primary-700 shadow-md">Import JSON</button>
                </div>
            </div>
         </div>
      )}

    </div>
  );
}

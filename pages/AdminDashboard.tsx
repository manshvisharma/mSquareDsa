import React, { useState, useEffect } from 'react';
import { getSheets, getTopics, getSubPatterns, getProblems, softDelete, restoreItem, batchAddProblems, reorderItem, getChildCount } from '../services/dataService';
import { Sheet, Topic, SubPattern, Problem, BatchImportData } from '../types';
import { db } from '../firebase';
import { COLLECTIONS } from '../constants';
import { collection, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { Plus, Trash2, Edit2, ChevronRight, ChevronDown, Upload, Save, X, RefreshCw, ArrowUp, ArrowDown, AlertTriangle, LinkIcon } from 'lucide-react';

// Confirmation Modal Component
const ConfirmModal = ({ isOpen, onClose, onConfirm, title, message }: any) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-sm w-full p-6 border border-gray-200 dark:border-gray-700 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center gap-3 mb-4 text-red-600 dark:text-red-400">
          <AlertTriangle size={24} />
          <h3 className="text-lg font-bold">{title}</h3>
        </div>
        <p className="text-gray-600 dark:text-gray-300 mb-6 text-sm leading-relaxed">{message}</p>
        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700 font-medium">Cancel</button>
          <button onClick={onConfirm} className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-medium shadow-md shadow-red-600/20">Delete</button>
        </div>
      </div>
    </div>
  );
};

const PillSelector = ({ title, items, selectedId, onSelect, onAdd, onDelete, onReorder, collectionName, onRefresh }: any) => {
  const [newItemName, setNewItemName] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const submitAdd = async () => {
     if(!newItemName.trim()) return;
     await onAdd(newItemName.trim());
     setNewItemName('');
     setIsAdding(false);
  }

  const submitEdit = async (id: string) => {
     if(!editName.trim()) return;
     await updateDoc(doc(db, collectionName, id), { title: editName.trim() });
     setEditingId(null);
     onRefresh();
  }

  return (
    <div className="flex flex-col gap-2 mb-4">
      <div className="flex items-center gap-2">
         <div className="text-xs font-bold text-gray-400 uppercase tracking-widest">{title}</div>
         <div className="h-px flex-1 bg-gray-100 dark:bg-gray-700"></div>
      </div>
      <div className="flex flex-wrap gap-2 items-center">
         {items.map((item: any, idx: number) => {
            const isSelected = selectedId === item.id;
            const isEditing = editingId === item.id;
            return (
              <div key={item.id} className={`group flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm font-medium transition-colors cursor-pointer ${isSelected ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-600/20' : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-600'}`} onClick={() => !isEditing && onSelect(item.id)}>
                 {isEditing ? (
                    <input autoFocus className="bg-transparent border-none outline-none text-gray-900 dark:text-white w-28 text-sm" value={editName} onChange={e => setEditName(e.target.value)} onBlur={() => submitEdit(item.id)} onKeyDown={(e) => { if(e.key==='Enter') submitEdit(item.id); if(e.key==='Escape') setEditingId(null); }} />
                 ) : (
                    <span>{item.title}</span>
                 )}
                 
                 {!isEditing && (
                    <div className={`flex items-center space-x-1 ml-1 overflow-hidden transition-all duration-200 ${isSelected ? 'w-auto opacity-100' : 'w-0 opacity-0 group-hover:w-auto group-hover:opacity-100'}`}>
                        <button onClick={(e) => { e.stopPropagation(); onReorder(e, collectionName, item, 'up', items, onRefresh); }} className={`p-0.5 rounded transition-colors ${isSelected ? 'text-indigo-200 hover:text-white hover:bg-indigo-500' : 'text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30'}`} title="Move Up/Left"><ArrowUp size={14}/></button>
                        <button onClick={(e) => { e.stopPropagation(); onReorder(e, collectionName, item, 'down', items, onRefresh); }} className={`p-0.5 rounded transition-colors ${isSelected ? 'text-indigo-200 hover:text-white hover:bg-indigo-500' : 'text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30'}`} title="Move Down/Right"><ArrowDown size={14}/></button>
                        <button onClick={(e) => { e.stopPropagation(); setEditName(item.title); setEditingId(item.id); }} className={`p-0.5 rounded transition-colors ${isSelected ? 'text-indigo-200 hover:text-white hover:bg-indigo-500' : 'text-blue-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30'}`} title="Edit"><Edit2 size={14}/></button>
                        <button onClick={(e) => { e.stopPropagation(); onDelete(e, collectionName, item.id, onRefresh); }} className={`p-0.5 rounded transition-colors ${isSelected ? 'text-indigo-200 hover:text-white hover:bg-indigo-500' : 'text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30'}`} title="Delete"><Trash2 size={14}/></button>
                    </div>
                 )}
              </div>
            )
         })}
         
         {isAdding ? (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
               <input autoFocus className="bg-transparent border-none outline-none text-sm w-28 dark:text-white" value={newItemName} onChange={e => setNewItemName(e.target.value)} onKeyDown={(e) => { if(e.key==='Enter') submitAdd(); if(e.key==='Escape') setIsAdding(false); }} onBlur={() => submitAdd()} placeholder="Name..." />
            </div>
         ) : (
            <button onClick={() => setIsAdding(true)} className="px-3 py-1.5 rounded-full border border-dashed border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-indigo-600 transition-colors flex items-center gap-1 text-sm font-medium">
               <Plus size={14} /> Add New
            </button>
         )}
      </div>
    </div>
  )
}

export default function AdminDashboard() {
  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string | null>(null);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [subPatterns, setSubPatterns] = useState<SubPattern[]>([]);
  const [selectedSub, setSelectedSub] = useState<string | null>(null);
  const [problems, setProblems] = useState<Problem[]>([]);

  // Modals state
  const [isBatchModalOpen, setBatchModalOpen] = useState(false);
  const [batchJson, setBatchJson] = useState('');
  
  const [probModal, setProbModal] = useState<{isOpen: boolean, isEdit: boolean, problem?: Problem | null}>({isOpen: false, isEdit: false});
  const [probForm, setProbForm] = useState<{title: string, url: string, platform: 'LeetCode' | 'GFG' | 'Other', platformId: string}>({ title: '', url: '', platform: 'LeetCode', platformId: '' });
  
  // Delete Modal State
  const [deleteModal, setDeleteModal] = useState<{isOpen: boolean, type: string, id: string, refresh: () => void} | null>(null);

  const refreshSheets = async () => setSheets(await getSheets(true)); 
  const refreshTopics = async () => { if(selectedSheet) setTopics(await getTopics(selectedSheet)); }
  const refreshSubs = async () => { if(selectedTopic) setSubPatterns(await getSubPatterns(selectedTopic)); }
  const refreshProblems = async () => { if(selectedSub) setProblems(await getProblems(selectedSub)); }

  useEffect(() => { refreshSheets(); }, []);
  useEffect(() => { refreshTopics(); setSelectedTopic(null); setTopics([]); }, [selectedSheet]);
  useEffect(() => { refreshSubs(); setSelectedSub(null); setSubPatterns([]); }, [selectedTopic]);
  useEffect(() => { refreshProblems(); setProblems([]); }, [selectedSub]);

  // Handlers
  const handleAddSheet = async (title: string) => {
    await addDoc(collection(db, COLLECTIONS.SHEETS), {
        title: title,
        description: '',
        createdAt: Date.now(),
        isDeleted: false
    });
    refreshSheets();
  };

  const handleAddTopic = async (title: string) => {
    if(!selectedSheet) return;
    await addDoc(collection(db, COLLECTIONS.TOPICS), {
        sheetId: selectedSheet,
        title: title,
        order: topics.length + 1,
        isDeleted: false
    });
    refreshTopics();
  };

  const handleAddSub = async (title: string) => {
    if(!selectedTopic) return;
    await addDoc(collection(db, COLLECTIONS.SUBPATTERNS), {
        topicId: selectedTopic,
        title: title,
        order: subPatterns.length + 1,
        isDeleted: false
    });
    refreshSubs();
  };

  const initiateDelete = async (e: React.MouseEvent, collectionName: string, id: string, refresh: () => void) => {
      e?.stopPropagation?.();
      e?.preventDefault?.();

      const childCount = await getChildCount(collectionName, id);
      
      if (childCount > 0) {
          alert(`Cannot delete: This item has ${childCount} active items inside it. Please delete them first.`);
          return;
      }

      setDeleteModal({ isOpen: true, type: collectionName, id, refresh });
  };

  const confirmDelete = async () => {
      if (!deleteModal) return;
      await softDelete(deleteModal.type, deleteModal.id);
      deleteModal.refresh();
      setDeleteModal(null);
  };

  const handleReorder = async (e: React.MouseEvent, collectionName: string, item: any, direction: 'up' | 'down', list: any[], refresh: () => void) => {
      e?.stopPropagation?.();
      await reorderItem(collectionName, item, direction, list);
      refresh();
  };

  const handleBatchImport = async () => {
      if(!selectedSub) return;
      try {
          const data: BatchImportData[] = JSON.parse(batchJson);
          const mapped = data.map(d => ({
              title: d.title,
              url: d.url,
              platform: d.platform,
              platformId: d.platformId || ''
          }));
          await batchAddProblems(selectedSub, mapped);
          setBatchJson('');
          setBatchModalOpen(false);
          refreshProblems();
          alert(`Added ${mapped.length} problems`);
      } catch (e) {
          alert('Invalid JSON');
      }
  };

  const openProbModal = (problem?: Problem) => {
      if(problem) {
          setProbForm({ title: problem.title, url: problem.url, platform: problem.platform || 'LeetCode', platformId: problem.platformId || '' });
          setProbModal({ isOpen: true, isEdit: true, problem });
      } else {
          setProbForm({ title: '', url: '', platform: 'LeetCode', platformId: '' });
          setProbModal({ isOpen: true, isEdit: false, problem: null });
      }
  };

  const saveProblem = async () => {
      if(!probForm.title || !probForm.url) return;
      if (probModal.isEdit && probModal.problem) {
          await updateDoc(doc(db, COLLECTIONS.PROBLEMS, probModal.problem.id), {
               title: probForm.title,
               url: probForm.url,
               platform: probForm.platform,
               platformId: probForm.platformId
          });
      } else if (!probModal.isEdit && selectedSub) {
          await addDoc(collection(db, COLLECTIONS.PROBLEMS), {
               subPatternId: selectedSub,
               title: probForm.title,
               url: probForm.url,
               platform: probForm.platform,
               platformId: probForm.platformId,
               order: problems.length + 1,
               isDeleted: false
          });
      }
      setProbModal({isOpen: false, isEdit: false});
      refreshProblems();
  };

  return (
    <div className="flex flex-col gap-6 h-[calc(100vh-100px)]">
      
      {/* Top Selector Section */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 flex-shrink-0 relative overflow-hidden">
        {/* Background Accent */}
        <div className="absolute top-0 right-0 p-8 opacity-5">
           <svg width="200" height="200" viewBox="0 0 24 24" fill="currentColor"><path d="M4 6h16v2H4zm0 5h16v2H4zm0 5h16v2H4z"/></svg>
        </div>

        <h2 className="text-xl font-black text-slate-800 dark:text-white mb-6 flex items-center gap-2">
            Database Organization
        </h2>

        <PillSelector 
            title="1. Select Sheet" 
            items={sheets} 
            selectedId={selectedSheet} 
            onSelect={setSelectedSheet} 
            onAdd={handleAddSheet}
            onDelete={initiateDelete}
            onReorder={handleReorder}
            onRefresh={refreshSheets}
            collectionName={COLLECTIONS.SHEETS}
        />

        {selectedSheet && (
           <PillSelector 
               title="2. Select Topic" 
               items={topics} 
               selectedId={selectedTopic} 
               onSelect={setSelectedTopic} 
               onAdd={handleAddTopic}
               onDelete={initiateDelete}
               onReorder={handleReorder}
               onRefresh={refreshTopics}
               collectionName={COLLECTIONS.TOPICS}
           />
        )}

        {selectedTopic && (
           <PillSelector 
               title="3. Select SubPattern" 
               items={subPatterns} 
               selectedId={selectedSub} 
               onSelect={setSelectedSub} 
               onAdd={handleAddSub}
               onDelete={initiateDelete}
               onReorder={handleReorder}
               onRefresh={refreshSubs}
               collectionName={COLLECTIONS.SUBPATTERNS}
           />
        )}
      </div>

      {/* Problems List Section */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col flex-1 min-h-0">
        <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-700/50 rounded-t-xl shrink-0">
            <h2 className="font-bold text-gray-700 dark:text-gray-200 flex items-center gap-2">
               Problems
               {selectedSub && <span className="bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-xs px-2 py-0.5 rounded-full">{problems.length} items</span>}
            </h2>
            {selectedSub && (
                <div className="flex items-center gap-2">
                    <button onClick={() => openProbModal()} className="text-sm bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg font-medium flex items-center gap-1 transition-colors">
                        <Plus size={16} /> Single Add
                    </button>
                    <button onClick={() => setBatchModalOpen(true)} className="text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 hover:border-indigo-600 dark:hover:border-indigo-400 text-gray-700 dark:text-gray-200 px-3 py-1.5 rounded-lg font-medium flex items-center gap-1 transition-colors" title="Batch Import JSON">
                        <Upload size={16} /> Batch
                    </button>
                </div>
            )}
        </div>
        <div className="p-0 flex-1 overflow-y-auto">
            {!selectedSub && (
                <div className="h-full flex flex-col items-center justify-center text-gray-400 dark:text-gray-500">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mb-4 opacity-50"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
                    <p>Select a SubPattern above to view its problems.</p>
                </div>
            )}
            
            {selectedSub && problems.length === 0 && (
                <div className="text-center p-8 text-gray-500 dark:text-gray-400">
                     No problems found in this subpattern. Add some!
                </div>
            )}

            {selectedSub && problems.length > 0 && (
                <div className="divide-y divide-gray-100 dark:divide-gray-700">
                   {problems.map((p, idx) => (
                       <div key={p.id} className="p-4 bg-white dark:bg-gray-800 flex justify-between items-center group hover:bg-gray-50 dark:hover:bg-gray-800/80 transition-colors">
                           <div className="flex items-start gap-4">
                               <div className="text-gray-400 dark:text-gray-500 font-mono text-sm pt-0.5">{idx + 1}.</div>
                               <div className="flex flex-col">
                                   <div className="font-semibold text-gray-800 dark:text-gray-200">{p.title}</div>
                                   <div className="flex items-center gap-3 mt-1">
                                       <span className="text-xs font-medium px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 pointer-events-none">{p.platform}</span>
                                       <a href={p.url} target="_blank" rel="noreferrer" className="text-xs text-indigo-500 hover:text-indigo-600 flex items-center gap-1">
                                          <LinkIcon size={12} /> View Link
                                       </a>
                                   </div>
                               </div>
                           </div>
                           <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={(e) => handleReorder(e, COLLECTIONS.PROBLEMS, p, 'up', problems, refreshProblems)} className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-600 rounded text-gray-500"><ArrowUp size={16} /></button>
                                <button onClick={(e) => handleReorder(e, COLLECTIONS.PROBLEMS, p, 'down', problems, refreshProblems)} className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-600 rounded text-gray-500"><ArrowDown size={16} /></button>
                                <div className="w-px h-4 bg-gray-200 dark:bg-gray-600 mx-1"></div>
                                <button onClick={() => openProbModal(p)} className="p-1.5 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded text-blue-500" title="Edit Problem"><Edit2 size={16} /></button>
                                <button onClick={(e) => initiateDelete(e, COLLECTIONS.PROBLEMS, p.id, refreshProblems)} className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/30 rounded text-red-500" title="Delete Problem"><Trash2 size={16} /></button>
                           </div>
                       </div>
                   ))}
                </div>
            )}
        </div>
      </div>

      {/* Problem Modal (Single Add / Edit) */}
      {probModal.isOpen && (
         <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
             <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md p-6">
                 <div className="flex justify-between items-center mb-6">
                     <h3 className="text-lg font-bold dark:text-white">{probModal.isEdit ? 'Edit Problem' : 'Add Problem'}</h3>
                     <button onClick={() => setProbModal({isOpen:false, isEdit:false})} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"><X size={20}/></button>
                 </div>
                 <div className="space-y-4">
                     <div>
                         <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Title</label>
                         <input 
                             type="text" 
                             className="w-full border rounded-lg p-2.5 text-sm dark:bg-gray-900 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-indigo-500"
                             value={probForm.title}
                             onChange={e => setProbForm({...probForm, title: e.target.value})}
                             placeholder="e.g. Two Sum"
                         />
                     </div>
                     <div>
                         <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">URL</label>
                         <input 
                             type="url" 
                             className="w-full border rounded-lg p-2.5 text-sm dark:bg-gray-900 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-indigo-500"
                             value={probForm.url}
                             onChange={e => setProbForm({...probForm, url: e.target.value})}
                             placeholder="https://..."
                         />
                     </div>
                     <div className="grid grid-cols-2 gap-4">
                         <div>
                             <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Platform</label>
                             <select 
                                 className="w-full border rounded-lg p-2.5 text-sm dark:bg-gray-900 dark:border-gray-600 dark:text-white"
                                 value={probForm.platform}
                                 onChange={e => setProbForm({...probForm, platform: e.target.value as any})}
                             >
                                 <option value="LeetCode">LeetCode</option>
                                 <option value="GFG">GFG</option>
                                 <option value="Other">Other</option>
                             </select>
                         </div>
                         <div>
                             <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Platform ID <span className="text-xs font-normal text-gray-400">(opt)</span></label>
                             <input 
                                 type="text" 
                                 className="w-full border rounded-lg p-2.5 text-sm dark:bg-gray-900 dark:border-gray-600 dark:text-white"
                                 value={probForm.platformId}
                                 onChange={e => setProbForm({...probForm, platformId: e.target.value})}
                                 placeholder="e.g. two-sum"
                             />
                         </div>
                     </div>
                 </div>
                 <div className="mt-8 flex justify-end space-x-3">
                     <button onClick={() => setProbModal({isOpen:false, isEdit:false})} className="px-4 py-2 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700 rounded-lg font-medium">Cancel</button>
                     <button onClick={saveProblem} disabled={!probForm.title || !probForm.url} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium disabled:opacity-50">
                         {probModal.isEdit ? 'Save Changes' : 'Add Problem'}
                     </button>
                 </div>
             </div>
         </div>
      )}

      {/* Batch Import Modal */}
      {isBatchModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-lg p-6">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold dark:text-white">Batch Import Problems</h3>
                    <button onClick={() => setBatchModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={20}/></button>
                </div>
                <p className="text-xs text-gray-500 mb-2">Paste JSON format: <code className="bg-gray-100 dark:bg-gray-700 px-1 py-0.5 rounded">[{`{"title":"X","url":"...","platform":"LeetCode"}`}]</code></p>
                <textarea 
                    className="w-full h-48 border rounded-lg p-3 text-sm font-mono dark:bg-gray-900 dark:border-gray-600 dark:text-gray-300 focus:ring-2 focus:ring-indigo-500 outline-none"
                    value={batchJson}
                    onChange={e => setBatchJson(e.target.value)}
                    placeholder='[{"title": "Two Sum", "url": "...", "platform": "LeetCode"}]'
                />
                <div className="mt-4 flex justify-end space-x-2">
                    <button onClick={() => setBatchModalOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
                    <button onClick={handleBatchImport} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">Import</button>
                </div>
            </div>
        </div>
      )}

      {/* Confirmation Modal */}
      <ConfirmModal 
        isOpen={!!deleteModal}
        onClose={() => setDeleteModal(null)}
        onConfirm={confirmDelete}
        title="Delete Item"
        message="Are you sure you want to delete this item? This action cannot be easily undone."
      />

    </div>
  );
}

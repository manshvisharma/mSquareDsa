import React, { useState, useEffect } from 'react';
import { getSheets, getTopics, getSubPatterns, getProblems, softDelete, restoreItem, batchAddProblems, reorderItem, getChildCount } from '../services/dataService';
import { Sheet, Topic, SubPattern, Problem, BatchImportData } from '../types';
import { db } from '../firebase';
import { COLLECTIONS } from '../constants';
import { collection, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { Plus, Trash2, Edit2, ChevronRight, ChevronDown, Upload, Save, X, RefreshCw, ArrowUp, ArrowDown, AlertTriangle } from 'lucide-react';

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
  
  // Delete Modal State
  const [deleteModal, setDeleteModal] = useState<{isOpen: boolean, type: string, id: string, refresh: () => void} | null>(null);

  // Form States
  const [newSheetTitle, setNewSheetTitle] = useState('');
  const [newTopicTitle, setNewTopicTitle] = useState('');
  const [newSubTitle, setNewSubTitle] = useState('');

  const refreshSheets = async () => setSheets(await getSheets(true)); 
  const refreshTopics = async () => { if(selectedSheet) setTopics(await getTopics(selectedSheet)); }
  const refreshSubs = async () => { if(selectedTopic) setSubPatterns(await getSubPatterns(selectedTopic)); }
  const refreshProblems = async () => { if(selectedSub) setProblems(await getProblems(selectedSub)); }

  useEffect(() => { refreshSheets(); }, []);
  useEffect(() => { refreshTopics(); setSelectedTopic(null); }, [selectedSheet]);
  useEffect(() => { refreshSubs(); setSelectedSub(null); }, [selectedTopic]);
  useEffect(() => { refreshProblems(); }, [selectedSub]);

  // Handlers
  const handleAddSheet = async () => {
    await addDoc(collection(db, COLLECTIONS.SHEETS), {
        title: newSheetTitle,
        description: '',
        createdAt: Date.now(),
        isDeleted: false
    });
    setNewSheetTitle('');
    refreshSheets();
  };

  const handleAddTopic = async () => {
    if(!selectedSheet) return;
    await addDoc(collection(db, COLLECTIONS.TOPICS), {
        sheetId: selectedSheet,
        title: newTopicTitle,
        order: topics.length + 1,
        isDeleted: false
    });
    setNewTopicTitle('');
    refreshTopics();
  };

  const handleAddSub = async () => {
    if(!selectedTopic) return;
    await addDoc(collection(db, COLLECTIONS.SUBPATTERNS), {
        topicId: selectedTopic,
        title: newSubTitle,
        order: subPatterns.length + 1,
        isDeleted: false
    });
    setNewSubTitle('');
    refreshSubs();
  };

  // Safe Deletion Logic Steps
  const initiateDelete = async (e: React.MouseEvent, collectionName: string, id: string, refresh: () => void) => {
      e.stopPropagation();
      e.preventDefault();

      // 1. Check for children dependencies
      const childCount = await getChildCount(collectionName, id);
      
      if (childCount > 0) {
          alert(`Cannot delete: This item has ${childCount} active items inside it. Please delete them first.`);
          return;
      }

      // 2. Open Custom Modal
      setDeleteModal({ isOpen: true, type: collectionName, id, refresh });
  };

  const confirmDelete = async () => {
      if (!deleteModal) return;
      await softDelete(deleteModal.type, deleteModal.id);
      deleteModal.refresh();
      setDeleteModal(null);
  };

  const handleReorder = async (e: React.MouseEvent, collectionName: string, item: any, direction: 'up' | 'down', list: any[], refresh: () => void) => {
      e.stopPropagation();
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

  return (
    <div className="grid grid-cols-12 gap-6 h-[calc(100vh-100px)]">
      
      {/* Column 1: Sheets */}
      <div className="col-span-12 md:col-span-3 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col">
        <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-700/50">
            <h2 className="font-bold text-gray-700 dark:text-gray-200">Sheets</h2>
        </div>
        <div className="p-2 space-y-2 flex-1 overflow-y-auto">
            {sheets.map(s => (
                <div key={s.id} 
                    onClick={() => setSelectedSheet(s.id)}
                    className={`p-3 rounded-lg cursor-pointer flex justify-between items-center group ${selectedSheet === s.id ? 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-200' : 'hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                >
                    <span className="font-medium dark:text-gray-200">{s.title}</span>
                    <button onClick={(e) => initiateDelete(e, COLLECTIONS.SHEETS, s.id, refreshSheets)} className="opacity-0 group-hover:opacity-100 p-1 text-red-400 hover:bg-red-50 rounded">
                        <Trash2 size={16} />
                    </button>
                </div>
            ))}
        </div>
        <div className="p-3 border-t border-gray-100 dark:border-gray-700">
            <div className="flex space-x-2">
                <input 
                    className="flex-1 px-3 py-2 border rounded-md text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    placeholder="New Sheet Name"
                    value={newSheetTitle}
                    onChange={e => setNewSheetTitle(e.target.value)}
                />
                <button onClick={handleAddSheet} disabled={!newSheetTitle} className="bg-indigo-600 text-white p-2 rounded-md disabled:opacity-50"><Plus size={18}/></button>
            </div>
        </div>
      </div>

      {/* Column 2: Topics */}
      <div className="col-span-12 md:col-span-3 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col">
        <div className="p-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
            <h2 className="font-bold text-gray-700 dark:text-gray-200">Topics</h2>
        </div>
        <div className="p-2 space-y-2 flex-1 overflow-y-auto">
            {!selectedSheet && <div className="text-center text-sm text-gray-400 mt-10">Select a Sheet</div>}
            {topics.map((t, idx) => (
                <div key={t.id} 
                    onClick={() => setSelectedTopic(t.id)}
                    className={`p-3 rounded-lg cursor-pointer flex justify-between items-center group ${selectedTopic === t.id ? 'bg-indigo-50 dark:bg-indigo-900/30' : 'hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                >
                    <div className="flex items-center space-x-2 overflow-hidden">
                       <span className="text-xs text-gray-400">{idx + 1}.</span>
                       <span className="text-sm font-medium dark:text-gray-200 truncate">{t.title}</span>
                    </div>
                    <div className="flex space-x-1 opacity-0 group-hover:opacity-100">
                        <button onClick={(e) => handleReorder(e, COLLECTIONS.TOPICS, t, 'up', topics, refreshTopics)} className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded text-gray-500"><ArrowUp size={14} /></button>
                        <button onClick={(e) => handleReorder(e, COLLECTIONS.TOPICS, t, 'down', topics, refreshTopics)} className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded text-gray-500"><ArrowDown size={14} /></button>
                        <button onClick={(e) => initiateDelete(e, COLLECTIONS.TOPICS, t.id, refreshTopics)} className="p-1 text-red-400 hover:bg-red-50 rounded">
                            <Trash2 size={14} />
                        </button>
                    </div>
                </div>
            ))}
        </div>
        {selectedSheet && (
            <div className="p-3 border-t border-gray-100 dark:border-gray-700">
                <div className="flex space-x-2">
                    <input 
                        className="flex-1 px-3 py-2 border rounded-md text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                        placeholder="New Topic"
                        value={newTopicTitle}
                        onChange={e => setNewTopicTitle(e.target.value)}
                    />
                    <button onClick={handleAddTopic} disabled={!newTopicTitle} className="bg-indigo-600 text-white p-2 rounded-md disabled:opacity-50"><Plus size={18}/></button>
                </div>
            </div>
        )}
      </div>

      {/* Column 3: Patterns */}
      <div className="col-span-12 md:col-span-3 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col">
         <div className="p-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
            <h2 className="font-bold text-gray-700 dark:text-gray-200">SubPatterns</h2>
        </div>
        <div className="p-2 space-y-2 flex-1 overflow-y-auto">
            {!selectedTopic && <div className="text-center text-sm text-gray-400 mt-10">Select a Topic</div>}
            {subPatterns.map((s, idx) => (
                <div key={s.id} 
                    onClick={() => setSelectedSub(s.id)}
                    className={`p-3 rounded-lg cursor-pointer flex justify-between items-center group ${selectedSub === s.id ? 'bg-indigo-50 dark:bg-indigo-900/30' : 'hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                >
                    <div className="flex items-center space-x-2 overflow-hidden">
                        <span className="text-xs text-gray-400">{idx + 1}.</span>
                        <span className="text-sm font-medium dark:text-gray-200 truncate">{s.title}</span>
                    </div>
                    <div className="flex space-x-1 opacity-0 group-hover:opacity-100">
                        <button onClick={(e) => handleReorder(e, COLLECTIONS.SUBPATTERNS, s, 'up', subPatterns, refreshSubs)} className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded text-gray-500"><ArrowUp size={14} /></button>
                        <button onClick={(e) => handleReorder(e, COLLECTIONS.SUBPATTERNS, s, 'down', subPatterns, refreshSubs)} className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded text-gray-500"><ArrowDown size={14} /></button>
                        <button onClick={(e) => initiateDelete(e, COLLECTIONS.SUBPATTERNS, s.id, refreshSubs)} className="p-1 text-red-400 hover:bg-red-50 rounded">
                            <Trash2 size={14} />
                        </button>
                    </div>
                </div>
            ))}
        </div>
        {selectedTopic && (
            <div className="p-3 border-t border-gray-100 dark:border-gray-700">
                <div className="flex space-x-2">
                    <input 
                        className="flex-1 px-3 py-2 border rounded-md text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                        placeholder="New Pattern"
                        value={newSubTitle}
                        onChange={e => setNewSubTitle(e.target.value)}
                    />
                    <button onClick={handleAddSub} disabled={!newSubTitle} className="bg-indigo-600 text-white p-2 rounded-md disabled:opacity-50"><Plus size={18}/></button>
                </div>
            </div>
        )}
      </div>

      {/* Column 4: Problems */}
      <div className="col-span-12 md:col-span-3 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col">
        <div className="p-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 flex justify-between items-center">
            <h2 className="font-bold text-gray-700 dark:text-gray-200">Problems</h2>
            {selectedSub && (
                <button onClick={() => setBatchModalOpen(true)} className="text-indigo-600 hover:bg-indigo-50 p-1 rounded" title="Batch Import">
                    <Upload size={18} />
                </button>
            )}
        </div>
        <div className="p-2 space-y-2 flex-1 overflow-y-auto">
            {!selectedSub && <div className="text-center text-sm text-gray-400 mt-10">Select a Pattern</div>}
            {problems.map(p => (
                <div key={p.id} className="p-3 rounded-lg border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 flex justify-between items-start group hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    <div className="overflow-hidden">
                        <div className="text-sm font-medium truncate dark:text-gray-200">{p.title}</div>
                        <div className="text-xs text-gray-400">{p.platform}</div>
                    </div>
                    <div className="flex space-x-1 opacity-0 group-hover:opacity-100">
                         <button onClick={(e) => handleReorder(e, COLLECTIONS.PROBLEMS, p, 'up', problems, refreshProblems)} className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded text-gray-500"><ArrowUp size={14} /></button>
                         <button onClick={(e) => handleReorder(e, COLLECTIONS.PROBLEMS, p, 'down', problems, refreshProblems)} className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded text-gray-500"><ArrowDown size={14} /></button>
                         <button onClick={(e) => initiateDelete(e, COLLECTIONS.PROBLEMS, p.id, refreshProblems)} className="text-red-400 hover:text-red-600 p-1">
                            <Trash2 size={14} />
                        </button>
                    </div>
                </div>
            ))}
        </div>
      </div>

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
                    className="w-full h-48 border rounded-lg p-3 text-sm font-mono dark:bg-gray-900 dark:border-gray-600 dark:text-gray-300"
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
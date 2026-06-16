import React, { useState, useEffect, useRef } from 'react';
import { Search, FileText, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getSheetsFullSearch } from '../services/dataService';
import { Sheet, Problem } from '../types';

export const GlobalSearch = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<{sheet: Sheet, problems: Problem[]}[]>([]);
    const [loading, setLoading] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const navigate = useNavigate();

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                setIsOpen(prev => !prev);
            }
            if (e.key === 'Escape' && isOpen) {
                setIsOpen(false);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen]);

    useEffect(() => {
        if (isOpen) {
            inputRef.current?.focus();
            if (query.length > 2) {
                performSearch(query);
            } else {
                setResults([]);
            }
        }
    }, [isOpen, query]);

    const performSearch = async (searchQuery: string) => {
        setLoading(true);
        try {
            const res = await getSheetsFullSearch(searchQuery);
            setResults(res);
        } catch (error) {
            console.error("Search error", error);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[10vh] bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={() => setIsOpen(false)}>
            <div className="bg-white dark:bg-dark-card glass-container w-full max-w-2xl rounded-2xl shadow-2xl border border-gray-200 dark:border-dark-border overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="flex items-center px-4 py-3 border-b border-gray-100 dark:border-dark-border relative">
                    <Search className="text-gray-400 mr-3" size={20} />
                    <input 
                        ref={inputRef}
                        type="text" 
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search problems or sheets... (min 3 chars)"
                        className="flex-1 bg-transparent text-lg text-slate-800 dark:text-white outline-none placeholder-gray-400"
                    />
                    <button onClick={() => setIsOpen(false)} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-dark-surface text-gray-500">
                        <X size={18} />
                    </button>
                </div>
                
                <div className="max-h-[60vh] overflow-y-auto custom-scrollbar">
                    {loading && <div className="p-4 text-center text-gray-500 text-sm">Searching...</div>}
                    {!loading && query.length > 2 && results.length === 0 && (
                        <div className="p-8 text-center text-gray-500">No results found for "{query}"</div>
                    )}
                    {!loading && results.map((res, i) => (
                        <div key={i} className="border-b border-gray-100 dark:border-dark-border last:border-0 pb-2">
                             <div className="px-4 py-2 bg-gray-50 dark:bg-dark-surface flex items-center gap-2 sticky top-0">
                                 <FileText size={14} className="text-primary-500" />
                                 <span className="text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider">{res.sheet.title}</span>
                             </div>
                             <div>
                                 {res.problems.map(prob => (
                                     <button 
                                        key={prob.id}
                                        onClick={() => {
                                            setIsOpen(false);
                                            navigate(`/sheet/${res.sheet.id}`);
                                            setTimeout(() => {
                                                const el = document.getElementById(`problem-${prob.id}`);
                                                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                            }, 500);
                                        }}
                                        className="w-full text-left px-6 py-3 hover:bg-primary-50 dark:hover:bg-primary-900/10 flex justify-between items-center group transition-colors"
                                     >
                                         <span className="font-medium text-slate-700 dark:text-gray-200 group-hover:text-primary-600 dark:group-hover:text-primary-400">{prob.title}</span>
                                         <span className="text-[10px] text-gray-400 uppercase font-bold px-2 py-0.5 rounded border border-gray-200 dark:border-dark-border group-hover:border-primary-200">{prob.platform}</span>
                                     </button>
                                 ))}
                             </div>
                        </div>
                    ))}
                    {!loading && query.length <= 2 && (
                        <div className="p-6 text-center text-gray-500 text-sm italic">Type at least 3 characters to search</div>
                    )}
                </div>
                <div className="bg-gray-50 dark:bg-dark-surface border-t border-gray-100 dark:border-dark-border px-4 py-2 flex justify-between items-center text-xs text-gray-400 font-bold uppercase">
                    <span>Quick Navigation</span>
                    <div className="flex gap-2">
                         <span className="px-2 py-0.5 rounded border border-gray-200 dark:border-dark-border">ESC to close</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

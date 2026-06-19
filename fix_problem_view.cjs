const fs = require('fs');
const content = `import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Editor } from '@monaco-editor/react';
import { PGlite } from '@electric-sql/pglite';
import { SQLProblem } from '../types';
import { db, auth } from '../firebase';
import { collection, query, where, getDocs, addDoc } from 'firebase/firestore';
import { ChevronLeft, Play, Database, CheckCircle2, XCircle, RefreshCw, Send, Plus, Trash2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";

interface RunResult {
    fields: string[];
    rows: any[];
}

interface TestCaseResult {
    passed: boolean;
    error: string | null;
    userResult: RunResult | null;
    expectedResult: RunResult | null;
    timeMs: number;
}

export default function SQLProblemView() {
    const { slug } = useParams<{ slug: string }>();
    const navigate = useNavigate();
    
    const [problem, setProblem] = useState<SQLProblem | null>(null);
    const [loading, setLoading] = useState(true);
    const [queryCode, setQueryCode] = useState('');
    const [dbLoading, setDbLoading] = useState(false);
    
    // Multiple user editable test cases
    const [testCasesSql, setTestCasesSql] = useState<string[]>([]);
    const [activeTestCaseIdx, setActiveTestCaseIdx] = useState(0);

    const [runResults, setRunResults] = useState<TestCaseResult[]>([]);
    const [verdict, setVerdict] = useState<'Accepted' | 'Wrong Answer' | 'Error' | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [consoleTab, setConsoleTab] = useState<'testcase' | 'output'>('testcase');

    useEffect(() => {
        const fetchProblem = async () => {
            if (!slug) return;
            try {
                const q = query(collection(db, 'sqlProblems'), where('slug', '==', slug));
                const snap = await getDocs(q);
                if (!snap.empty) {
                    const data = { id: snap.docs[0].id, ...snap.docs[0].data() } as SQLProblem;
                    setProblem(data);
                    setQueryCode(data.starterQuery || '');
                    setTestCasesSql([data.visibleSetupSql || '']);
                }
            } catch(e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        fetchProblem();
    }, [slug]);

    useEffect(() => {
        const init = async () => {
            setDbLoading(true);
            try {
                 const testPg = new PGlite();
                 await testPg.query('SELECT 1');
                 testPg.close();
            } catch(e) {}
            setDbLoading(false);
        };
        init();
    }, []);

    const compareRows = (actual: any[], expected: any[], fields: string[]) => {
        if (actual.length !== expected.length) return false;
        for (let i = 0; i < actual.length; i++) {
            const r1 = actual[i] as any;
            const r2 = expected[i] as any;
            for (const f of fields) {
                if (String(r1[f]) !== String(r2[f])) return false;
            }
        }
        return true;
    };

    const countVerdict = (results: TestCaseResult[]) => {
        if (results.some(r => r.error)) return 'Error';
        if (results.some(r => !r.passed)) return 'Wrong Answer';
        return 'Accepted';
    };

    const runQuery = async (isSubmit = false) => {
        if (!problem) return;
        setIsSubmitting(isSubmit);
        setConsoleTab('output');
        setVerdict(null);

        let casesToRun = [...testCasesSql];
        // If it's a real submit, append the hidden test case to evaluate it behind the scenes
        let hasHidden = isSubmit && !!problem.hiddenSetupSql;
        if (hasHidden) {
             casesToRun.push(problem.hiddenSetupSql!);
        }

        let newResults: TestCaseResult[] = [];
        let allPassed = true;

        for (let i = 0; i < casesToRun.length; i++) {
            const setupSql = casesToRun[i];
            let timeMs = 0;
            let expectedRes: RunResult | null = null;
            let userRes: RunResult | null = null;
            let errorMsg: string | null = null;
            let passed = false;

            try {
                // 1. Evaluate Expected Result
                if (problem.solutionQuery) {
                     const pgExp = new PGlite();
                     if (setupSql) await pgExp.exec(setupSql);
                     const rExp = await pgExp.query(problem.solutionQuery);
                     expectedRes = { fields: rExp.fields.map(f => f.name), rows: rExp.rows };
                     pgExp.close();
                }

                // 2. Evaluate User Result
                const pgUser = new PGlite();
                if (setupSql) await pgUser.exec(setupSql);
                const start = performance.now();
                const rUser = await pgUser.query(queryCode);
                const end = performance.now();
                timeMs = Math.round(end - start);
                userRes = { fields: rUser.fields.map(f => f.name), rows: rUser.rows };
                pgUser.close();

                // 3. Compare
                if (!expectedRes && problem.expectedOutput && i === 0) {
                     // Fallback for first case to static expected format if solutionQuery not present
                     let expectedRows = problem.expectedOutput;
                     let expectedFields = expectedRows.length > 0 ? Object.keys(expectedRows[0]) : [];
                     expectedRes = { fields: expectedFields, rows: expectedRows };
                }

                if (expectedRes && userRes) {
                     passed = compareRows(userRes.rows, expectedRes.rows, expectedRes.fields);
                } else if (!expectedRes && userRes) {
                     passed = true; // No expected output strictly defined
                }

            } catch (e: any) {
                errorMsg = e.message || String(e);
                passed = false;
            }

            if (!passed) allPassed = false;
            
            // Only add to frontend results if it's NOT the hidden case, 
            // or if we fail the hidden case we might just show a "Hidden test failed" generic msg
            if (!(isSubmit && hasHidden && i === casesToRun.length - 1)) {
                newResults.push({ passed, error: errorMsg, userResult: userRes, expectedResult: expectedRes, timeMs });
            } else if (isSubmit && hasHidden && i === casesToRun.length - 1) {
                if (!passed) {
                    newResults.push({ passed: false, error: errorMsg ? "A hidden test case encountered an error." : null, userResult: null, expectedResult: null, timeMs: 0 });
                }
            }
        }

        setRunResults(newResults);
        
        let finalVerdict = countVerdict(newResults);
        if (!allPassed) finalVerdict = finalVerdict === 'Error' ? 'Error' : 'Wrong Answer';
        setVerdict(finalVerdict);

        if (isSubmit && auth.currentUser) {
            await addDoc(collection(db, 'sqlSubmissions'), {
                userId: auth.currentUser.uid,
                problemId: problem.id,
                query: queryCode,
                status: finalVerdict,
                executionTimeMs: newResults.reduce((acc, r) => acc + r.timeMs, 0),
                timestamp: Date.now()
            });
            if (finalVerdict === 'Accepted') {
                import('canvas-confetti').then(confetti => confetti.default());
            }
        }
        setIsSubmitting(false);
    };

    if (loading) return <div className="p-8">Loading problem...</div>;
    if (!problem) return <div className="p-8">Problem not found.</div>;

    const getDifficultyClass = () => {
        if (problem.difficulty === 'Easy') return 'text-emerald-500';
        if (problem.difficulty === 'Medium') return 'text-amber-500';
        return 'text-red-500';
    };

    const addTestCase = () => {
        setTestCasesSql([...testCasesSql, testCasesSql[activeTestCaseIdx]]);
        setActiveTestCaseIdx(testCasesSql.length);
    };

    const removeTestCase = (idx: number) => {
        if (testCasesSql.length === 1) return;
        const newArr = testCasesSql.filter((_, i) => i !== idx);
        setTestCasesSql(newArr);
        if (activeTestCaseIdx >= newArr.length) {
            setActiveTestCaseIdx(newArr.length - 1);
        }
    };

    const updateTestCase = (idx: number, val: string) => {
        const newArr = [...testCasesSql];
        newArr[idx] = val;
        setTestCasesSql(newArr);
    };

    const activeResult = runResults[activeTestCaseIdx];

    return (
        <div className="h-[calc(100vh-3.5rem)] flex flex-col bg-slate-100 dark:bg-[#0f0f11]">
            <div className="flex items-center justify-between px-4 h-12 bg-white dark:bg-[#1a1a1c] border-b border-gray-200 dark:border-dark-border shrink-0">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate('/sql')} className="text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 transition-colors">
                        <ChevronLeft size={20} />
                    </button>
                    <h1 className="font-semibold text-sm dark:text-gray-200">{problem.title}</h1>
                </div>
                <div className="flex gap-2">
                    <button 
                        onClick={() => runQuery(false)}
                        disabled={dbLoading || isSubmitting}
                        className="flex items-center gap-2 px-4 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded text-sm font-medium transition-colors disabled:opacity-50"
                    >
                        {dbLoading ? <RefreshCw className="animate-spin" size={14} /> : <Play size={14} />}
                        Run
                    </button>
                    <button 
                        onClick={() => runQuery(true)}
                        disabled={dbLoading || isSubmitting}
                        className="flex items-center gap-2 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-sm font-medium transition-colors disabled:opacity-50 shadow-sm"
                    >
                        <Send size={14} />
                        Submit
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-hidden p-2">
                <PanelGroup direction="horizontal" className="h-full gap-2">
                    {/* Left Panel: Description */}
                    <Panel defaultSize={40} minSize={25} className="bg-white dark:bg-[#1a1a1c] rounded-lg border border-gray-200 dark:border-dark-border flex flex-col shadow-sm">
                        <div className="flex border-b border-gray-100 dark:border-dark-border px-4 py-2 shrink-0">
                            <span className="py-1 text-sm font-semibold text-slate-800 dark:text-gray-200 border-b-2 border-primary-500">
                                Description
                            </span>
                        </div>
                        <div className="flex-1 overflow-y-auto p-5 text-sm">
                            <div className="flex items-center gap-3 mb-6">
                                <span className={\`font-medium \${getDifficultyClass()}\`}>
                                    {problem.difficulty}
                                </span>
                            </div>
                            <div className="prose prose-sm dark:prose-invert max-w-none prose-p:text-slate-600 dark:prose-p:text-slate-300">
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>{problem.description || ''}</ReactMarkdown>
                            </div>
                        </div>
                    </Panel>

                    <PanelResizeHandle className="w-2 flex items-center justify-center cursor-col-resize group">
                        <div className="h-8 w-1 rounded-full bg-gray-300 dark:bg-gray-700 group-hover:bg-primary-500 transition-colors" />
                    </PanelResizeHandle>

                    {/* Right Panel: Editor & Console */}
                    <Panel defaultSize={60} minSize={30} className="flex flex-col gap-2">
                        <PanelGroup direction="vertical" className="h-full gap-2">
                            {/* Editor */}
                            <Panel defaultSize={60} minSize={20} className="bg-white dark:bg-[#1a1a1c] rounded-lg border border-gray-200 dark:border-dark-border flex flex-col shadow-sm overflow-hidden">
                                <div className="flex items-center h-10 px-4 border-b border-gray-100 dark:border-dark-border bg-slate-50 dark:bg-[#222225] shrink-0">
                                   <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                                       <Database size={14}/>
                                       <span>{problem.databaseType || 'PostgreSQL'}</span>
                                   </div>
                                </div>
                                <div className="flex-1 p-2">
                                    <Editor
                                        height="100%"
                                        defaultLanguage="sql"
                                        theme="vs-dark"
                                        value={queryCode}
                                        onChange={(val) => setQueryCode(val || '')}
                                        options={{
                                            minimap: { enabled: false },
                                            fontSize: 13,
                                            fontFamily: '"JetBrains Mono", monospace',
                                            wordWrap: 'on',
                                            automaticLayout: true,
                                            padding: { top: 12 },
                                            scrollBeyondLastLine: false,
                                        }}
                                    />
                                </div>
                            </Panel>

                            <PanelResizeHandle className="h-2 flex items-center justify-center cursor-row-resize group">
                                <div className="w-8 h-1 rounded-full bg-gray-300 dark:bg-gray-700 group-hover:bg-primary-500 transition-colors" />
                            </PanelResizeHandle>

                            {/* Console */}
                            <Panel defaultSize={40} minSize={10} className="bg-white dark:bg-[#1a1a1c] rounded-lg border border-gray-200 dark:border-dark-border flex flex-col shadow-sm">
                                <div className="flex items-center justify-between px-3 h-10 border-b border-gray-100 dark:border-dark-border bg-slate-50 dark:bg-[#222225] shrink-0">
                                    <div className="flex gap-1 h-full pt-2">
                                        <button 
                                            onClick={() => setConsoleTab('testcase')} 
                                            className={\`px-3 text-xs font-medium rounded-t-lg transition-colors \${consoleTab === 'testcase' ? 'bg-white dark:bg-[#1a1a1c] text-primary-600 dark:text-primary-400 border-t border-x border-gray-200 dark:border-dark-border border-b-transparent relative top-[1px]' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}\`}
                                        >
                                            Testcase
                                        </button>
                                        <button 
                                            onClick={() => setConsoleTab('output')} 
                                            className={\`px-3 text-xs font-medium rounded-t-lg transition-colors flex items-center gap-1.5 \${consoleTab === 'output' ? 'bg-white dark:bg-[#1a1a1c] text-primary-600 dark:text-primary-400 border-t border-x border-gray-200 dark:border-dark-border border-b-transparent relative top-[1px]' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}\`}
                                        >
                                            Test Result
                                            {verdict === 'Accepted' && <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"/>}
                                            {verdict === 'Wrong Answer' && <div className="w-1.5 h-1.5 rounded-full bg-red-500"/>}
                                            {verdict === 'Error' && <div className="w-1.5 h-1.5 rounded-full bg-amber-500"/>}
                                        </button>
                                    </div>
                                </div>
                                <div className="flex-1 overflow-auto flex flex-col relative text-sm">
                                    
                                    {/* Testcase/Result Nav Bar */}
                                    <div className="flex px-4 py-3 gap-2 overflow-x-auto shrink-0 border-b border-gray-50 dark:border-dark-border">
                                         {testCasesSql.map((tc, idx) => (
                                             <div key={idx} className="flex relative">
                                                <button
                                                    onClick={() => setActiveTestCaseIdx(idx)}
                                                    className={\`px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-2 \${activeTestCaseIdx === idx ? 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800/50'}\`}
                                                >
                                                    Case {idx + 1}
                                                    {runResults[idx] && (
                                                         runResults[idx].passed ? <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> : <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                                                    )}
                                                </button>
                                                {testCasesSql.length > 1 && (
                                                    <button onClick={() => removeTestCase(idx)} className="absolute -top-1 -right-1 z-10 hidden group-hover:flex w-4 h-4 bg-red-100 text-red-600 rounded-full items-center justify-center">
                                                        <Trash2 size={10} />
                                                    </button>
                                                )}
                                             </div>
                                         ))}
                                         <button onClick={addTestCase} className="px-2 py-1.5 rounded-md text-xs font-medium text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1">
                                             <Plus size={14}/> Add
                                         </button>
                                    </div>

                                    <div className="p-4 flex-1 overflow-y-auto">
                                        {consoleTab === 'testcase' && (
                                            <div className="h-full flex flex-col">
                                                <div className="text-xs font-medium text-slate-500 mb-2">Schema & Data Setup (Editable)</div>
                                                <textarea
                                                    className="w-full flex-1 min-h-[160px] bg-slate-50 dark:bg-[#222225] border border-gray-200 dark:border-dark-border rounded-lg p-3 text-xs font-mono text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-primary-500"
                                                    value={testCasesSql[activeTestCaseIdx]}
                                                    onChange={(e) => updateTestCase(activeTestCaseIdx, e.target.value)}
                                                    spellCheck={false}
                                                />
                                            </div>
                                        )}
                                        
                                        {consoleTab === 'output' && (
                                            !activeResult ? (
                                                <div className="text-slate-400 italic text-center py-8">Run the code to view test results.</div>
                                            ) : (
                                                <div className="space-y-6">
                                                    <div className="flex items-center gap-2">
                                                        <span className={\`font-bold text-base flex items-center gap-1.5 \${activeResult.passed ? 'text-emerald-500' : 'text-red-500'}\`}>
                                                           {activeResult.passed ? <CheckCircle2 size={18}/> : <XCircle size={18}/>}
                                                           {activeResult.passed ? 'Accepted' : (activeResult.error ? 'Runtime Error' : 'Wrong Answer')}
                                                        </span>
                                                        <span className="text-xs text-slate-500 ml-2">Time: {activeResult.timeMs}ms</span>
                                                    </div>

                                                    {activeResult.error && (
                                                        <div className="bg-red-50 dark:bg-red-900/10 text-red-600 dark:text-red-400 p-3 rounded-lg font-mono text-xs whitespace-pre-wrap border border-red-100 dark:border-red-900/30">
                                                            {activeResult.error}
                                                        </div>
                                                    )}

                                                    {activeResult.userResult && (
                                                        <div>
                                                            <div className="text-xs font-medium text-slate-500 mb-2">Output</div>
                                                            <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-dark-border">
                                                                <div className="overflow-x-auto">
                                                                    <table className="w-full text-left text-xs whitespace-nowrap">
                                                                        <thead className="bg-slate-50 dark:bg-[#222225] border-b border-gray-200 dark:border-dark-border">
                                                                            <tr>
                                                                                {activeResult.userResult.fields.map((f, i) => (
                                                                                    <th key={"th-out-"+i} className="px-3 py-2 font-semibold text-slate-600 dark:text-slate-300">{f}</th>
                                                                                ))}
                                                                            </tr>
                                                                        </thead>
                                                                        <tbody className="divide-y divide-gray-100 dark:divide-dark-border">
                                                                            {activeResult.userResult.rows.map((r, i) => (
                                                                                <tr key={"tr-out-"+i} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                                                                                    {activeResult.userResult!.fields.map((f, j) => (
                                                                                        <td key={"td-out-"+j} className="px-3 py-2 text-slate-700 dark:text-slate-300">{String(r[f])}</td>
                                                                                    ))}
                                                                                </tr>
                                                                            ))}
                                                                            {activeResult.userResult.rows.length === 0 && (
                                                                                <tr>
                                                                                    <td colSpan={activeResult.userResult.fields.length} className="px-3 py-4 text-center text-slate-400 italic">No output.</td>
                                                                                </tr>
                                                                            )}
                                                                        </tbody>
                                                                    </table>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {!activeResult.passed && activeResult.expectedResult && !activeResult.error && (
                                                        <div>
                                                            <div className="text-xs font-medium text-slate-500 mb-2">Expected Outplut</div>
                                                            <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-dark-border">
                                                                <div className="overflow-x-auto">
                                                                    <table className="w-full text-left text-xs whitespace-nowrap">
                                                                        <thead className="bg-slate-50 dark:bg-[#222225] border-b border-gray-200 dark:border-dark-border">
                                                                            <tr>
                                                                                {activeResult.expectedResult.fields.map((f, i) => (
                                                                                    <th key={"th-exp-"+i} className="px-3 py-2 font-semibold text-slate-600 dark:text-slate-300">{f}</th>
                                                                                ))}
                                                                            </tr>
                                                                        </thead>
                                                                        <tbody className="divide-y divide-gray-100 dark:divide-dark-border">
                                                                            {activeResult.expectedResult.rows.map((r, i) => (
                                                                                <tr key={"tr-exp-"+i} className="bg-red-50/30 dark:bg-red-900/10">
                                                                                    {activeResult.expectedResult!.fields.map((f, j) => (
                                                                                        <td key={"td-exp-"+j} className="px-3 py-2 text-slate-700 dark:text-slate-300">{String(r[f])}</td>
                                                                                    ))}
                                                                                </tr>
                                                                            ))}
                                                                            {activeResult.expectedResult.rows.length === 0 && (
                                                                                <tr>
                                                                                    <td colSpan={activeResult.expectedResult.fields.length} className="px-3 py-4 text-center text-slate-400 italic">No output expected.</td>
                                                                                </tr>
                                                                            )}
                                                                        </tbody>
                                                                    </table>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )
                                        )}
                                    </div>
                                </div>
                            </Panel>
                        </PanelGroup>
                    </Panel>
                </PanelGroup>
            </div>
        </div>
    );
}`;
fs.writeFileSync('pages/SQLProblemView.tsx', content);

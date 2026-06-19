const fs = require('fs');
let content = fs.readFileSync('pages/SQLProblemView.tsx', 'utf-8');

// target index of "activeTab === 'output' && runResult ? ("
let startIndex = content.indexOf(") : activeTab === 'output' && runResult ? (");

// find "activeTab === 'status' && runError ? ("
let endIndex = content.indexOf(") : activeTab === 'status' && runError ? (", startIndex);

const beforeStr = content.substring(0, startIndex);
const afterStr = content.substring(endIndex);

const replaceStr = \`) : activeTab === 'output' && runResult ? (
                        <div className="space-y-6">
                            <div>
                                <div className="text-xs mb-3 flex items-center justify-between">
                                    <span className={\\\`font-bold flex items-center gap-1 \${
                                        verdict === 'Accepted' ? 'text-emerald-600 dark:text-emerald-400' :
                                        verdict === 'Wrong Answer' ? 'text-red-600 dark:text-red-400' :
                                        'text-gray-600 dark:text-gray-400'
                                    }\\\`}>
                                        {verdict === 'Accepted' ? <CheckCircle2 size={14}/> : verdict === 'Wrong Answer' ? <XCircle size={14}/> : <Database size={14}/>} 
                                        {verdict || 'Executed'}
                                    </span>
                                    <span className="text-gray-500">Time: {executionTime}ms</span>
                                </div>
                                {verdict !== 'Accepted' && <div className="mb-2 text-xs font-bold text-slate-700 dark:text-gray-300">Your Output:</div>}
                                <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-dark-border">
                                    <table className="w-full text-left text-sm whitespace-nowrap">
                                        <thead className="bg-gray-50 dark:bg-dark-surface">
                                            <tr>
                                                {runResult.fields.map((f, i) => (
                                                    <th key={\\\`th-out-\${f}-\${i}\\\`} className="px-4 py-2 font-bold text-slate-600 dark:text-gray-300 border-b border-gray-200 dark:border-dark-border">{f}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100 dark:divide-dark-border">
                                            {runResult.rows.map((r, rowIndex) => (
                                                <tr key={\\\`tr-out-\${rowIndex}\\\`} className="hover:bg-gray-50 dark:hover:bg-dark-surface/50">
                                                    {runResult.fields.map((f, colIndex) => (
                                                        <td key={\\\`td-out-\${f}-\${colIndex}\\\`} className="px-4 py-2 text-slate-700 dark:text-gray-200">{String(r[f])}</td>
                                                    ))}
                                                </tr>
                                            ))}
                                            {runResult.rows.length === 0 && (
                                                <tr><td colSpan={runResult.fields.length} className="px-4 py-6 text-center text-gray-400 italic">No rows returned.</td></tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                            
                            {verdict === 'Wrong Answer' && expectedRunResult && (
                                <div>
                                    <div className="mb-2 text-xs font-bold text-slate-700 dark:text-gray-300">Expected Output:</div>
                                    <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-dark-border">
                                        <table className="w-full text-left text-sm whitespace-nowrap">
                                            <thead className="bg-gray-50 dark:bg-dark-surface">
                                                <tr>
                                                    {expectedRunResult.fields.map((f, i) => (
                                                        <th key={\\\`th-expout-\${f}-\${i}\\\`} className="px-4 py-2 font-bold text-slate-600 dark:text-gray-300 border-b border-gray-200 dark:border-dark-border">{f}</th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100 dark:divide-dark-border">
                                                {expectedRunResult.rows.map((r, rowIndex) => (
                                                    <tr key={\\\`tr-expout-\${rowIndex}\\\`} className="hover:bg-red-50 dark:hover:bg-red-900/10">
                                                        {expectedRunResult.fields.map((f, colIndex) => (
                                                            <td key={\\\`td-expout-\${f}-\${colIndex}\\\`} className="px-4 py-2 text-slate-700 dark:text-gray-200">{String(r[f])}</td>
                                                        ))}
                                                    </tr>
                                                ))}
                                                {expectedRunResult.rows.length === 0 && (
                                                    <tr><td colSpan={expectedRunResult.fields.length} className="px-4 py-6 text-center text-gray-400 italic">No rows returned.</td></tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </div>
                    \`;

fs.writeFileSync('pages/SQLProblemView.tsx', beforeStr + replaceStr + afterStr);

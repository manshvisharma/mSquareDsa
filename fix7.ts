// Fix the whole Expected Output container syntax error properly
import fs from 'fs';
const content = fs.readFileSync('pages/SQLProblemView.tsx', 'utf-8');

const targetBefore = `                            <div>
                                <h3 className="font-bold text-slate-800 dark:text-gray-200 mb-2">Expected Output</h3>`;

const targetAfter = `                            </div>
                        </div>
                    ) : activeTab === 'output' && runResult ? (`;

const replaceWith = `                            <div>
                                <h3 className="font-bold text-slate-800 dark:text-gray-200 mb-2">Expected Output</h3>
                                {(expectedRunResult?.rows || problem.expectedOutput || []).length > 0 ? (
                                    <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-dark-border">
                                        <table className="w-full text-left text-xs whitespace-nowrap">
                                            <thead className="bg-gray-50 dark:bg-dark-surface">
                                                <tr>
                                                    {(expectedRunResult?.fields || Object.keys(problem.expectedOutput[0] || {})).map((f: string, i: number) => (
                                                        <th key={"th-exp-" + f + "-" + i} className="px-4 py-2 font-bold text-slate-600 dark:text-gray-300 border-b border-gray-200 dark:border-dark-border">{f}</th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100 dark:divide-dark-border">
                                                {(expectedRunResult?.rows || problem.expectedOutput).map((r: any, i: number) => (
                                                    <tr key={"tr-exp-" + i} className="hover:bg-gray-50 dark:hover:bg-dark-surface/50">
                                                        {(expectedRunResult?.fields || Object.keys(r)).map((f: string, j: number) => (
                                                            <td key={"td-exp-" + f + "-" + j} className="px-4 py-2 text-slate-700 dark:text-gray-200">{String(r[f])}</td>
                                                        ))}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (
                                    <div className="text-gray-500 italic text-xs">No expected output rows.</div>
                                )}
                            </div>
                        </div>
                    ) : activeTab === 'output' && runResult ? (
                        <div className="space-y-6">
                            <div>
                                <div className="text-xs mb-3 flex items-center justify-between">
                                    <span className={"font-bold flex items-center gap-1 " + (
                                        verdict === 'Accepted' ? 'text-emerald-600 dark:text-emerald-400' :
                                        verdict === 'Wrong Answer' ? 'text-red-600 dark:text-red-400' :
                                        'text-gray-600 dark:text-gray-400'
                                    )}>
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
                                                    <th key={"th-out-"+f+"-"+i} className="px-4 py-2 font-bold text-slate-600 dark:text-gray-300 border-b border-gray-200 dark:border-dark-border">{f}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100 dark:divide-dark-border">
                                            {runResult.rows.map((r, rowIndex) => (
                                                <tr key={"tr-out-"+rowIndex} className="hover:bg-gray-50 dark:hover:bg-dark-surface/50">
                                                    {runResult.fields.map((f, colIndex) => (
                                                        <td key={"td-out-"+f+"-"+colIndex} className="px-4 py-2 text-slate-700 dark:text-gray-200">{String(r[f])}</td>
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
                                                        <th key={"th-expout-"+f+"-"+i} className="px-4 py-2 font-bold text-slate-600 dark:text-gray-300 border-b border-gray-200 dark:border-dark-border">{f}</th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100 dark:divide-dark-border">
                                                {expectedRunResult.rows.map((r, rowIndex) => (
                                                    <tr key={"tr-expout-"+rowIndex} className="hover:bg-red-50 dark:hover:bg-red-900/10">
                                                        {expectedRunResult.fields.map((f, colIndex) => (
                                                            <td key={"td-expout-"+f+"-"+colIndex} className="px-4 py-2 text-slate-700 dark:text-gray-200">{String(r[f])}</td>
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
                        </div>`;

const startIdx = content.indexOf(targetBefore);
const endIdx = content.indexOf(targetAfter, startIdx) + targetAfter.length;

if (startIdx === -1 || endIdx < startIdx) {
    console.error("Could not find the target indices!");
    process.exit(1);
}

// Find where the output render originally ended
const outputEndTarget = \`                            </div>
                        </div>
                    ) : activeTab === 'status' && runError ? (\`;

const endOfOutputRenderStr = content.indexOf(outputEndTarget, endIdx);

if (endOfOutputRenderStr === -1) {
     console.error("Could not find the end of the output render block!");
     process.exit(1);
}

const beforeBlockStr = content.substring(0, startIdx);
const afterBlockStr = content.substring(endOfOutputRenderStr + \`                            </div>
                        </div>\`.length);

fs.writeFileSync('pages/SQLProblemView.tsx', beforeBlockStr + replaceWith + afterBlockStr);
console.log("Successfully patched SQLProblemView.tsx");

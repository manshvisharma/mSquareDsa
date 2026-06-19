const fs = require('fs');

let content = fs.readFileSync('pages/SQLProblemView.tsx', 'utf-8');

const targetStr = `                                        {runResult.rows.length === 0 && (
                                            <tr><td colSpan={runResult.fields.length} className="px-4 py-6 text-center text-gray-400 italic">No rows returned.</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>`;
                            
const replacementStr = `                                        {runResult.rows.length === 0 && (
                                            <tr><td colSpan={runResult.fields.length} className="px-4 py-6 text-center text-gray-400 italic">No rows returned.</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                            
                            {verdict === 'Wrong Answer' && expectedRunResult && (
                                <div>
                                    <div className="mb-2 text-xs font-bold text-slate-700 dark:text-gray-300">Expected Output:</div>
                                    <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-dark-border">
                                        <table className="w-full text-left text-sm whitespace-nowrap">
                                            <thead className="bg-gray-50 dark:bg-dark-surface">
                                                <tr>
                                                    {expectedRunResult.fields.map((f, i) => (
                                                        <th key={\`th-expout-\${f}-\${i}\`} className="px-4 py-2 font-bold text-slate-600 dark:text-gray-300 border-b border-gray-200 dark:border-dark-border">{f}</th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100 dark:divide-dark-border">
                                                {expectedRunResult.rows.map((r, rowIndex) => (
                                                    <tr key={\`tr-expout-\${rowIndex}\`} className="hover:bg-red-50 dark:hover:bg-red-900/10">
                                                        {expectedRunResult.fields.map((f, colIndex) => (
                                                            <td key={\`td-expout-\${f}-\${colIndex}\`} className="px-4 py-2 text-slate-700 dark:text-gray-200">{String(r[f])}</td>
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

content = content.replace(targetStr, replacementStr);

const targetOutputStr = `{verdict || 'Executed'}
                                </span>
                                <span className="text-gray-500">Time: {executionTime}ms</span>
                            </div>
                            <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-dark-border">`;

const replaceOutputStr = `{verdict || 'Executed'}
                                </span>
                                <span className="text-gray-500">Time: {executionTime}ms</span>
                            </div>
                            {verdict !== 'Accepted' && <div className="mb-2 text-xs font-bold text-slate-700 dark:text-gray-300">Your Output:</div>}
                            <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-dark-border">`;
                            
content = content.replace(targetOutputStr, replaceOutputStr);

fs.writeFileSync('pages/SQLProblemView.tsx', content);

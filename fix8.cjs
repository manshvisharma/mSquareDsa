const fs = require('fs');

const content = fs.readFileSync('pages/SQLProblemView.tsx', 'utf-8');

const targetBefore = "                            <div>\\n" +
"                                <h3 className=\\"font-bold text-slate-800 dark:text-gray-200 mb-2\\">Expected Output</h3>";

const targetAfter = "                            </div>\\n" +
"                        </div>\\n" +
"                    ) : activeTab === 'output' && runResult ? (";

const replaceWith = '                            <div>\\n' +
'                                <h3 className="font-bold text-slate-800 dark:text-gray-200 mb-2">Expected Output</h3>\\n' +
'                                {(expectedRunResult?.rows || problem.expectedOutput || []).length > 0 ? (\\n' +
'                                    <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-dark-border">\\n' +
'                                        <table className="w-full text-left text-xs whitespace-nowrap">\\n' +
'                                            <thead className="bg-gray-50 dark:bg-dark-surface">\\n' +
'                                                <tr>\\n' +
'                                                    {(expectedRunResult?.fields || Object.keys(problem.expectedOutput[0] || {})).map((f: string, i: number) => (\\n' +
'                                                        <th key={"th-exp-" + f + "-" + i} className="px-4 py-2 font-bold text-slate-600 dark:text-gray-300 border-b border-gray-200 dark:border-dark-border">{f}</th>\\n' +
'                                                    ))}\\n' +
'                                                </tr>\\n' +
'                                            </thead>\\n' +
'                                            <tbody className="divide-y divide-gray-100 dark:divide-dark-border">\\n' +
'                                                {(expectedRunResult?.rows || problem.expectedOutput).map((r: any, i: number) => (\\n' +
'                                                    <tr key={"tr-exp-" + i} className="hover:bg-gray-50 dark:hover:bg-dark-surface/50">\\n' +
'                                                        {(expectedRunResult?.fields || Object.keys(r)).map((f: string, j: number) => (\\n' +
'                                                            <td key={"td-exp-" + f + "-" + j} className="px-4 py-2 text-slate-700 dark:text-gray-200">{String(r[f])}</td>\\n' +
'                                                        ))}\\n' +
'                                                    </tr>\\n' +
'                                                ))}\\n' +
'                                            </tbody>\\n' +
'                                        </table>\\n' +
'                                    </div>\\n' +
'                                ) : (\\n' +
'                                    <div className="text-gray-500 italic text-xs">No expected output rows.</div>\\n' +
'                                )}\\n' +
'                            </div>\\n' +
'                        </div>\\n' +
'                    ) : activeTab === \'output\' && runResult ? (\\n' +
'                        <div className="space-y-6">\\n' +
'                            <div>\\n' +
'                                <div className="text-xs mb-3 flex items-center justify-between">\\n' +
'                                    <span className={"font-bold flex items-center gap-1 " + (\\n' +
'                                        verdict === \'Accepted\' ? \'text-emerald-600 dark:text-emerald-400\' :\\n' +
'                                        verdict === \'Wrong Answer\' ? \'text-red-600 dark:text-red-400\' :\\n' +
'                                        \'text-gray-600 dark:text-gray-400\'\\n' +
'                                    )}>\\n' +
'                                        {verdict === \'Accepted\' ? <CheckCircle2 size={14}/> : verdict === \'Wrong Answer\' ? <XCircle size={14}/> : <Database size={14}/>} \\n' +
'                                        {verdict || \'Executed\'}\\n' +
'                                    </span>\\n' +
'                                    <span className="text-gray-500">Time: {executionTime}ms</span>\\n' +
'                                </div>\\n' +
'                                {verdict !== \'Accepted\' && <div className="mb-2 text-xs font-bold text-slate-700 dark:text-gray-300">Your Output:</div>}\\n' +
'                                <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-dark-border">\\n' +
'                                    <table className="w-full text-left text-sm whitespace-nowrap">\\n' +
'                                        <thead className="bg-gray-50 dark:bg-dark-surface">\\n' +
'                                            <tr>\\n' +
'                                                {runResult.fields.map((f, i) => (\\n' +
'                                                    <th key={"th-out-"+f+"-"+i} className="px-4 py-2 font-bold text-slate-600 dark:text-gray-300 border-b border-gray-200 dark:border-dark-border">{f}</th>\\n' +
'                                                ))}\\n' +
'                                            </tr>\\n' +
'                                        </thead>\\n' +
'                                        <tbody className="divide-y divide-gray-100 dark:divide-dark-border">\\n' +
'                                            {runResult.rows.map((r, rowIndex) => (\\n' +
'                                                <tr key={"tr-out-"+rowIndex} className="hover:bg-gray-50 dark:hover:bg-dark-surface/50">\\n' +
'                                                    {runResult.fields.map((f, colIndex) => (\\n' +
'                                                        <td key={"td-out-"+f+"-"+colIndex} className="px-4 py-2 text-slate-700 dark:text-gray-200">{String(r[f])}</td>\\n' +
'                                                    ))}\\n' +
'                                                </tr>\\n' +
'                                            ))}\\n' +
'                                            {runResult.rows.length === 0 && (\\n' +
'                                                <tr><td colSpan={runResult.fields.length} className="px-4 py-6 text-center text-gray-400 italic">No rows returned.</td></tr>\\n' +
'                                            )}\\n' +
'                                        </tbody>\\n' +
'                                    </table>\\n' +
'                                </div>\\n' +
'                            </div>\\n' +
'                            \\n' +
'                            {verdict === \'Wrong Answer\' && expectedRunResult && (\\n' +
'                                <div>\\n' +
'                                    <div className="mb-2 text-xs font-bold text-slate-700 dark:text-gray-300">Expected Output:</div>\\n' +
'                                    <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-dark-border">\\n' +
'                                        <table className="w-full text-left text-sm whitespace-nowrap">\\n' +
'                                            <thead className="bg-gray-50 dark:bg-dark-surface">\\n' +
'                                                <tr>\\n' +
'                                                    {expectedRunResult.fields.map((f, i) => (\\n' +
'                                                        <th key={"th-expout-"+f+"-"+i} className="px-4 py-2 font-bold text-slate-600 dark:text-gray-300 border-b border-gray-200 dark:border-dark-border">{f}</th>\\n' +
'                                                    ))}\\n' +
'                                                </tr>\\n' +
'                                            </thead>\\n' +
'                                            <tbody className="divide-y divide-gray-100 dark:divide-dark-border">\\n' +
'                                                {expectedRunResult.rows.map((r, rowIndex) => (\\n' +
'                                                    <tr key={"tr-expout-"+rowIndex} className="hover:bg-red-50 dark:hover:bg-red-900/10">\\n' +
'                                                        {expectedRunResult.fields.map((f, colIndex) => (\\n' +
'                                                            <td key={"td-expout-"+f+"-"+colIndex} className="px-4 py-2 text-slate-700 dark:text-gray-200">{String(r[f])}</td>\\n' +
'                                                        ))}\\n' +
'                                                    </tr>\\n' +
'                                                ))}\\n' +
'                                                {expectedRunResult.rows.length === 0 && (\\n' +
'                                                    <tr><td colSpan={expectedRunResult.fields.length} className="px-4 py-6 text-center text-gray-400 italic">No rows returned.</td></tr>\\n' +
'                                                )}\\n' +
'                                            </tbody>\\n' +
'                                        </table>\\n' +
'                                    </div>\\n' +
'                                </div>\\n' +
'                            )}\\n' +
'                        </div>';

const startIdx = content.indexOf(targetBefore);
const endIdx = content.indexOf(targetAfter, startIdx) + targetAfter.length;

if (startIdx === -1 || (content.indexOf(targetAfter, startIdx) === -1)) {
    console.error("Could not find the target indices! startIdx: " + startIdx);
    process.exit(1);
}

const outputEndTarget = "                            </div>\\n" +
"                        </div>\\n" +
"                    ) : activeTab === 'status' && runError ? (";

const endOfOutputRenderStr = content.indexOf(outputEndTarget, endIdx);

if (endOfOutputRenderStr === -1) {
     console.error("Could not find the end of the output render block!");
     process.exit(1);
}

const beforeBlockStr = content.substring(0, startIdx);
const afterBlockStr = content.substring(endOfOutputRenderStr + ("                            </div>\\n" + "                        </div>").length);

fs.writeFileSync('pages/SQLProblemView.tsx', beforeBlockStr + replaceWith + afterBlockStr);
console.log("Successfully patched SQLProblemView.tsx");

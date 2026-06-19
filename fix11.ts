// Fix wrong insert
import fs from 'fs';
const content = fs.readFileSync('pages/SQLProblemView.tsx', 'utf-8');

const targetStr = \`                                {(expectedRunResult?.rows || problem.expectedOutput || []).length > 0 ? (
                                    <div className="space-y-4">
                                 {verdict !== 'Accepted' && <div className="text-xs font-bold text-slate-700 dark:text-gray-300">Your Output:</div>}
                                 <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-dark-border">\`;

const replaceStr = \`                                {(expectedRunResult?.rows || problem.expectedOutput || []).length > 0 ? (
                                    <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-dark-border">\`;

fs.writeFileSync('pages/SQLProblemView.tsx', content.replace(targetStr, replaceStr));

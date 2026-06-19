const fs = require('fs');

let content = fs.readFileSync('pages/SQLProblemView.tsx', 'utf-8');

const targetStr = `                        <div>
                            <div className="text-xs mb-3 flex items-center justify-between">`;
                            
const replacementStr = `                        <div className="space-y-6">
                            <div>
                                <div className="text-xs mb-3 flex items-center justify-between">`;

content = content.replace(targetStr, replacementStr);
fs.writeFileSync('pages/SQLProblemView.tsx', content);

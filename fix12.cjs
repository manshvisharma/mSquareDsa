const fs = require('fs');
let lines = fs.readFileSync('pages/SQLProblemView.tsx', 'utf-8').split('\\n');

let idxToRemove1 = lines.findIndex(l => l.includes('<div className="space-y-4">') && l.includes('                                '));
let idxToRemove2 = lines.findIndex(l => l.includes('Your Output:</div>}'));

if(idxToRemove1 !== -1 && idxToRemove2 !== -1) {
    lines.splice(idxToRemove1, idxToRemove2 - idxToRemove1 + 1);
}

fs.writeFileSync('pages/SQLProblemView.tsx', lines.join('\\n'));
console.log("Success");

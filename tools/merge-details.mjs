// 将 research/details/*.json 中的四件事字段合并进 research/solutions/*.json
// 幂等：重复运行会覆盖同名字段，不改变其他内容。
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.cwd(), 'research');
const detailsDir = path.join(root, 'details');
const solutionsDir = path.join(root, 'solutions');

const mapFile = {
  'fps.json': 'fps.json',
  'tps-extraction.json': 'tps-extraction.json',
  'moba.json': 'moba.json',
  'openworld.json': 'openworld.json',
  'arpg.json': 'arpg.json',
  'common.json': 'common.json'
};

let merged = 0;
const missing = [];

for (const [detailName, solutionName] of Object.entries(mapFile)) {
  const detailPath = path.join(detailsDir, detailName);
  const solutionPath = path.join(solutionsDir, solutionName);
  const details = JSON.parse(fs.readFileSync(detailPath, 'utf8'));
  const solutions = JSON.parse(fs.readFileSync(solutionPath, 'utf8'));

  for (const sol of solutions) {
    const d = details[sol.id];
    if (!d) {
      missing.push(sol.id);
      continue;
    }
    for (const key of ['reproduce', 'usage', 'optimization', 'verify']) {
      sol[key] = d[key];
    }
    merged += 1;
  }

  fs.writeFileSync(solutionPath, JSON.stringify(solutions, null, 2) + '\n', 'utf8');
}

console.log(`merged=${merged}`);
if (missing.length) {
  console.log(`missing details for: ${missing.join(', ')}`);
  process.exitCode = 1;
}

/**
 * This script supports install.sh,
 */
import fs from 'fs';

const res = fs.readFileSync('package.json', 'utf8');
const pkg = JSON.parse(res);
pkg.workspaces = ['.devops'];
console.log(JSON.stringify(pkg, null, 2));

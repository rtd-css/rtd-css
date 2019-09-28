const path = require('path');
const test = require('postcss-test-fixtures').default;

const pathToPlugin = path.join(__dirname, '../lib/postcss-rtd-css.cjs.js');
test.run(pathToPlugin);

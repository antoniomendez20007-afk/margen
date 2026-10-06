// Copia la web compilada a gas/Index.html, que es lo que sirve doGet()
import fs from 'fs';
fs.copyFileSync('dist/index.html', 'gas/Index.html');
console.log('gas/Index.html', (fs.statSync('gas/Index.html').size / 1024).toFixed(0), 'KB');

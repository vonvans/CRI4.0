const AdmZip = require('adm-zip');
const fs = require('fs');

const zip = new AdmZip();
zip.addFile('test-file.txt', Buffer.from('hello'));
zip.addFile('folder/', Buffer.alloc(0)); // empty folder
zip.writeZip('test.zip');

const zip2 = new AdmZip('test.zip');
zip2.extractAllTo('./out', true);

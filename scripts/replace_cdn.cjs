const fs = require('fs');
const path = require('path');

const cdnUrl = 'https://raw.githubusercontent.com/nikazfar-droid/MVOCapps/Developer/assets/images/cars/veloz-600x338.png';

const walkSync = (dir, filelist = []) => {
  fs.readdirSync(dir).forEach(file => {
    const dirFile = path.join(dir, file);
    try {
      filelist = walkSync(dirFile, filelist);
    } catch (err) {
      if (err.code === 'ENOTDIR' || err.code === 'EBADF') filelist.push(dirFile);
    }
  });
  return filelist;
};

walkSync('./src').filter(f => f.endsWith('.tsx') || f.endsWith('.ts')).forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  const regex = /https:\/\/images\.unsplash\.com\/photo-[A-Za-z0-9-]+[^\s"'`\}]*/g;
  if (regex.test(content)) {
    content = content.replace(regex, cdnUrl);
    fs.writeFileSync(file, content, 'utf8');
    console.log('Replaced unsplash links in: ' + file);
  }
});
console.log('Semua pautan CDN selesai diganti!');

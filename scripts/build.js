const fs = require('fs-extra');
const path = require('path');

const root = path.join(__dirname, '..');
const dist = path.join(root, 'dist');

const PUBLIC_FILES = ['abogados.html', 'abogados.css', 'abogados.js', 'index.html', 'style.css', 'script.js', 'detail.html'];
const DATA_DIR = path.join(root, 'public', 'data');
const PKG_PATH = path.join(root, 'package.json');

(async () => {
  try {
    console.log('🧹 Limpiando carpeta dist...');
    await fs.remove(dist);
    await fs.ensureDir(dist);

    console.log('📁 Copiando archivos públicos...');
    for (const file of PUBLIC_FILES) {
      const src = path.join(root, 'public', file);
      if (await fs.pathExists(src)) {
        await fs.copy(src, path.join(dist, file));
      }
    }

    console.log('📂 Copiando datos...');
    await fs.copy(DATA_DIR, path.join(dist, 'data'));

    console.log('📄 Copiando package.json de producción...');
    const pkg = await fs.readJson(PKG_PATH);
    const prodPkg = {
      name: pkg.name,
      version: pkg.version,
      description: pkg.description,
      main: pkg.main,
      scripts: {
        start: 'node server.js',
      },
      dependencies: pkg.dependencies,
      engines: pkg.engines,
    };
    await fs.writeJson(path.join(dist, 'package.json'), prodPkg, { spaces: 2 });

    console.log('🚀 Build completado en', dist);
  } catch (err) {
    console.error('❌ Error en build:', err);
    process.exit(1);
  }
})();
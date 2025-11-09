#!/usr/bin/env node

/**
 * Script para preparar el proyecto antes de subir a GitHub
 * Limpia archivos innecesarios y verifica la configuración
 */

const fs = require('fs-extra');
const path = require('path');
const { execSync } = require('child_process');

const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function prepareForGitHub() {
  log('\n🚀 Preparando proyecto para GitHub...', 'blue');
  
  try {
    // 1. Verificar estructura básica
    log('\n📁 Verificando estructura del proyecto...', 'yellow');
    
    const requiredFiles = [
      'server.js',
      'package.json',
      'public/abogados-actualizado.html',
      'public/abogados-completos.json',
      'src',
      'vercel.json',
      '.gitignore',
      'README.md',
      'LICENSE'
    ];
    
    let missingFiles = [];
    for (const file of requiredFiles) {
      const exists = await fs.pathExists(file);
      if (exists) {
        log(`  ✅ ${file}`, 'green');
      } else {
        log(`  ❌ ${file}`, 'red');
        missingFiles.push(file);
      }
    }
    
    if (missingFiles.length > 0) {
      throw new Error(`Archivos faltantes: ${missingFiles.join(', ')}`);
    }
    
    // 2. Limpiar archivos temporales y logs
    log('\n🧹 Limpiando archivos temporales...', 'yellow');
    
    const cleanPaths = [
      'logs',
      'node_modules',
      '.eslintcache',
      'npm-debug.log*',
      'yarn-debug.log*',
      'yarn-error.log*'
    ];
    
    for (const cleanPath of cleanPaths) {
      if (await fs.pathExists(cleanPath)) {
        await fs.remove(cleanPath);
        log(`  🗑️  Eliminado: ${cleanPath}`, 'green');
      }
    }
    
    // 3. Verificar package.json
    log('\n📦 Verificando package.json...', 'yellow');
    const packageJson = await fs.readJson('package.json');
    
    if (!packageJson.scripts || !packageJson.scripts.start) {
      throw new Error('package.json debe tener un script "start"');
    }
    
    if (!packageJson.engines || !packageJson.engines.node) {
      log('  ⚠️  Advertencia: No se especifica versión de Node.js en engines', 'yellow');
    }
    
    log('  ✅ package.json válido', 'green');
    
    // 4. Verificar variables de entorno
    log('\n🔐 Verificando variables de entorno...', 'yellow');
    
    const envExampleExists = await fs.pathExists('.env.example');
    const envExists = await fs.pathExists('.env');
    
    if (envExampleExists) {
      log('  ✅ .env.example encontrado', 'green');
    } else {
      log('  ❌ .env.example no encontrado', 'red');
    }
    
    if (envExists) {
      log('  ⚠️  .env encontrado - asegúrate de no subirlo a GitHub', 'yellow');
    }
    
    // 5. Verificar base de datos
    log('\n🗄️  Verificando base de datos...', 'yellow');
    const dbExists = await fs.pathExists('database.sqlite');
    
    if (dbExists) {
      const stats = await fs.stat('database.sqlite');
      const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
      log(`  ✅ database.sqlite encontrada (${sizeMB} MB)`, 'green');
    } else {
      log('  ⚠️  database.sqlite no encontrada', 'yellow');
    }
    
    // 6. Verificar archivos del frontend
    log('\n🌐 Verificando archivos frontend...', 'yellow');
    
    const frontendFiles = [
      'public/abogados-actualizado.html',
      'public/styles-actualizado.css',
      'public/script-actualizado.js',
      'public/abogados-completos.json'
    ];
    
    for (const file of frontendFiles) {
      if (await fs.pathExists(file)) {
        log(`  ✅ ${file}`, 'green');
      } else {
        log(`  ❌ ${file}`, 'red');
      }
    }
    
    // 7. Verificar configuración de Vercel
    log('\n⚡ Verificando configuración de Vercel...', 'yellow');
    
    const vercelExists = await fs.pathExists('vercel.json');
    if (vercelExists) {
      const vercelConfig = await fs.readJson('vercel.json');
      
      if (vercelConfig.version && vercelConfig.builds) {
        log('  ✅ vercel.json válido', 'green');
      } else {
        log('  ❌ vercel.json incompleto', 'red');
      }
    }
    
    // 8. Recomendaciones finales
    log('\n💡 Recomendaciones finales:', 'blue');
    log('  • Asegúrate de tener .env en .gitignore', 'yellow');
    log('  • Verifica que node_modules esté en .gitignore', 'yellow');
    log('  • Haz commit de todos los archivos necesarios', 'yellow');
    log('  • Sube a GitHub y conecta con Vercel', 'yellow');
    
    log('\n✅ ¡Proyecto preparado para GitHub!', 'green');
    log('\nSiguientes pasos:', 'blue');
    log('1. git add .', 'yellow');
    log('2. git commit -m "Initial commit"', 'yellow');
    log('3. git push origin main', 'yellow');
    
  } catch (error) {
    log(`\n❌ Error: ${error.message}`, 'red');
    process.exit(1);
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  prepareForGitHub();
}

module.exports = { prepareForGitHub };
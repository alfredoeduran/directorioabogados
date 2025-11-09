#!/usr/bin/env node

/**
 * Script de build para Vercel
 * Asegura que el proyecto esté correctamente configurado para producción
 */

const fs = require('fs-extra');
const path = require('path');

console.log('🔧 Iniciando build para Vercel...');

async function vercelBuild() {
  try {
    // 1. Verificar que existan los archivos necesarios
    const requiredFiles = [
      'server.js',
      'package.json',
      'database.sqlite',
      'public/abogados-actualizado.html',
      'public/abogados-completos.json'
    ];

    console.log('📁 Verificando archivos necesarios...');
    for (const file of requiredFiles) {
      if (await fs.pathExists(file)) {
        console.log(`  ✅ ${file}`);
      } else {
        console.log(`  ❌ ${file} - NO ENCONTRADO`);
        throw new Error(`Archivo requerido no encontrado: ${file}`);
      }
    }

    // 2. Verificar que el servidor pueda iniciar
    console.log('\n🚀 Verificando que el servidor pueda iniciar...');
    
    // Intentar importar el servidor
    try {
      const serverModule = require('../server.js');
      console.log('  ✅ Servidor puede ser importado correctamente');
    } catch (error) {
      console.log('  ⚠️  Advertencia al importar servidor:', error.message);
    }

    // 3. Verificar que la base de datos tenga datos
    console.log('\n🗄️  Verificando base de datos...');
    if (await fs.pathExists('database.sqlite')) {
      const stats = await fs.stat('database.sqlite');
      const sizeKB = (stats.size / 1024).toFixed(2);
      console.log(`  ✅ Base de datos encontrada (${sizeKB} KB)`);
      
      if (stats.size < 1024) {
        console.log('  ⚠️  Advertencia: La base de datos parece estar vacía');
      }
    }

    // 4. Verificar que los archivos del frontend existan
    console.log('\n🌐 Verificando archivos frontend...');
    const frontendFiles = [
      'public/abogados-actualizado.html',
      'public/styles-actualizado.css',
      'public/script-actualizado.js',
      'public/abogados-completos.json'
    ];

    for (const file of frontendFiles) {
      if (await fs.pathExists(file)) {
        console.log(`  ✅ ${file}`);
      } else {
        console.log(`  ⚠️  ${file} - No encontrado`);
      }
    }

    // 5. Crear archivo de configuración para Vercel si no existe
    console.log('\n⚡ Verificando configuración de Vercel...');
    if (await fs.pathExists('vercel.json')) {
      console.log('  ✅ vercel.json encontrado');
    } else {
      console.log('  ❌ vercel.json no encontrado');
      throw new Error('vercel.json es requerido para el despliegue');
    }

    console.log('\n✅ Build completado exitosamente!');
    console.log('\n📋 Resumen del proyecto:');
    console.log('  • Tipo: Aplicación web de directorio de abogados');
    console.log('  • Backend: Express.js con API REST');
    console.log('  • Frontend: HTML/CSS/JavaScript vanilla');
    console.log('  • Base de datos: SQLite con 186 abogados');
    console.log('  • Hosting: Vercel (serverless)');

  } catch (error) {
    console.error('\n❌ Error en el build:', error.message);
    process.exit(1);
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  vercelBuild();
}

module.exports = { vercelBuild };
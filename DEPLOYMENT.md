# 🚀 Guía de Despliegue - GitHub + Vercel

## 📋 Pasos para Subir a GitHub y Desplegar en Vercel

### 1️⃣ Preparar el Repositorio Local

```bash
# Navegar al directorio del proyecto
cd hispaleman-express

# Inicializar git (si no está inicializado)
git init

# Agregar todos los archivos
git add .

# Hacer commit inicial
git commit -m "Initial commit: Directorio de abogados hispanohablantes"
```

### 2️⃣ Crear Repositorio en GitHub

1. Ve a [GitHub.com](https://github.com)
2. Click en "New repository" o "Nuevo repositorio"
3. Nombre del repositorio: `hispaleman-abogados`
4. Descripción: "Directorio de abogados en España para la comunidad hispanohablante"
5. Público o privado (elige según prefieras)
6. NO inicialices con README (ya tenemos uno)
7. Click "Create repository"

### 3️⃣ Conectar Repositorio Local con GitHub

```bash
# Agregar el repositorio remoto (reemplaza TU-USUARIO con tu nombre de usuario)
git remote add origin https://github.com/TU-USUARIO/hispaleman-abogados.git

# Subir el código a GitHub
git branch -M main
git push -u origin main
```

### 4️⃣ Configurar Variables de Entorno en Vercel

Cuando configures el proyecto en Vercel, usa estas variables:

```env
NODE_ENV=production
PORT=3000
ALLOWED_ORIGINS=*
SCRAPING_ENABLED=false
CACHE_TTL=1800
LOG_LEVEL=info
```

### 5️⃣ Desplegar en Vercel

#### Opción A: Desde la Web de Vercel

1. Ve a [Vercel.com](https://vercel.com)
2. Click "New Project" o "Nuevo Proyecto"
3. Importa tu repositorio de GitHub
4. Configura:
   - **Framework Preset**: Node.js
   - **Build Command**: `npm run build`
   - **Output Directory**: `./`
   - **Install Command**: `npm install`
5. Agrega las variables de entorno
6. Click "Deploy"

#### Opción B: Desde CLI de Vercel

```bash
# Instalar Vercel CLI globalmente
npm i -g vercel

# Desplegar (desde la carpeta del proyecto)
cd hispaleman-express
vercel

# Sigue las instrucciones interactivas
```

### 6️⃣ Verificar el Despliegue

Una vez desplegado, verifica:

1. **URL pública**: La obtendrás de Vercel
2. **API funcionando**: Visita `https://tu-url.vercel.app/api/search`
3. **Frontend**: Visita `https://tu-url.vercel.app/abogados-actualizado.html`

## 🔧 Solución de Problemas Comunes

### Error: "Build failed"

```bash
# Asegúrate de que el build script esté configurado
npm run build
```

### Error: "Module not found"

```bash
# Verifica que todas las dependencias estén instaladas
npm install
```

### Error: "Database connection failed"

- En Vercel, SQLite debe estar incluido en el proyecto
- Verifica que `database.sqlite` esté en el repositorio

## 📁 Archivos Importantes para el Despliegue

✅ **DEBEN estar en el repositorio:**
- `server.js` - Servidor principal
- `package.json` - Dependencias y scripts
- `public/` - Archivos estáticos
- `src/` - Código fuente
- `database.sqlite` - Base de datos
- `vercel.json` - Configuración de Vercel
- `.env.example` - Ejemplo de variables
- `README.md` - Documentación
- `LICENSE` - Licencia MIT

❌ **NO deben estar en el repositorio:**
- `node_modules/` - Se instala automáticamente
- `.env` - Contiene información sensible
- `logs/` - Archivos de log
- Archivos temporales

## 🎯 Comandos Útiles

```bash
# Ver estado de git
git status

# Ver logs de git
git log --oneline

# Forzar push (si hay problemas)
git push -f origin main

# Verificar build local
npm run build

# Probar servidor local
npm start
```

## 📞 Soporte

Si tienes problemas:

1. **Verifica los logs de Vercel** en el dashboard
2. **Consulta la documentación de Vercel**: https://vercel.com/docs
3. **Revisa los issues en GitHub** del proyecto

## 🎉 ¡Listo!

Una vez completados estos pasos, tu aplicación de directorio de abogados estará disponible públicamente en Internet a través de Vercel.

**URL típica**: `https://hispaleman-abogados.vercel.app/abogados-actualizado.html`
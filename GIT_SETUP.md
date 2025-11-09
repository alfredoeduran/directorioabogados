# 🚀 Configuración de Git y GitHub

## 📋 Pasos Finales para Subir a GitHub

### 1️⃣ Configurar Git (si no está configurado)

```bash
# Configurar nombre de usuario
git config --global user.name "Tu Nombre"

# Configurar email
git config --global user.email "tuemail@ejemplo.com"
```

### 2️⃣ Inicializar Repositorio Local

```bash
# Inicializar git (si no está hecho)
git init

# Verificar estado
git status
```

### 3️⃣ Agregar Archivos al Repositorio

```bash
# Agregar todos los archivos
git add .

# O agregar archivos específicos si prefieres
git add server.js package.json public/ src/ vercel.json .gitignore README.md LICENSE .env.example
```

### 4️⃣ Hacer Commit Inicial

```bash
# Hacer commit con mensaje descriptivo
git commit -m "Initial commit: Directorio de abogados hispanohablantes en España"

# O con mensaje más detallado
git commit -m "feat: Aplicación web de directorio de abogados

- Búsqueda avanzada de abogados por especialidad y ubicación
- API RESTful con Express.js
- Base de datos SQLite con 186 registros
- Interfaz responsive y optimizada
- Preparado para despliegue en Vercel"
```

### 5️⃣ Crear Repositorio en GitHub

1. **Ir a GitHub**: https://github.com/new
2. **Nombre del repositorio**: `hispaleman-abogados`
3. **Descripción**: "Directorio de abogados en España para la comunidad hispanohablante"
4. **Privacidad**: Público (recomendado para Vercel)
5. **NO** inicialices con README, .gitignore o licencia (ya los tenemos)
6. **Crear repositorio**

### 6️⃣ Conectar Repositorio Local con GitHub

```bash
# Agregar repositorio remoto (reemplaza TU-USUARIO)
git remote add origin https://github.com/TU-USUARIO/hispaleman-abogados.git

# Verificar conexión
git remote -v
```

### 7️⃣ Subir Código a GitHub

```bash
# Cambiar nombre de rama a main (si está como master)
git branch -M main

# Subir código
git push -u origin main
```

### 8️⃣ Verificar en GitHub

1. **Ve a tu repositorio**: `https://github.com/TU-USUARIO/hispaleman-abogados`
2. **Verifica que todos los archivos estén**: server.js, package.json, public/, etc.
3. **Verifica que .env NO esté** (debe estar en .gitignore)

## 🔧 Comandos Útiles de Git

```bash
# Ver historial
git log --oneline

# Ver estado actual
git status

# Ver ramas
git branch -a

# Actualizar desde GitHub
git pull origin main

# Forzar push (si hay problemas)
git push -f origin main

# Clonar repositorio (en otro lugar)
git clone https://github.com/TU-USUARIO/hispaleman-abogados.git
```

## 🚨 Solución de Problemas Comunes

### Error: "remote origin already exists"
```bash
git remote remove origin
git remote add origin https://github.com/TU-USUARIO/hispaleman-abogados.git
```

### Error: "failed to push some refs"
```bash
# Obtener cambios primero
git pull origin main --rebase
# Luego volver a push
git push origin main
```

### Error: "permission denied"
```bash
# Verificar que estés logueado en GitHub
# Y que tengas permisos en el repositorio
```

## 🎯 Siguientes Pasos

Una vez que el código esté en GitHub:

1. **Conectar con Vercel**: Sigue la guía en `DEPLOYMENT.md`
2. **Configurar variables de entorno** en Vercel
3. **Desplegar** la aplicación
4. **Compartir** la URL pública

## 📞 Soporte

Si tienes problemas con Git o GitHub:

1. **Documentación oficial**: https://docs.github.com
2. **GitHub Desktop**: Cliente gráfico alternativo
3. **Comandos de ayuda**: `git help` o `git help push`

¡Listo! Tu proyecto está ahora en GitHub y listo para conectar con Vercel. 🎉
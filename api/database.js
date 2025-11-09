const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class Database {
  constructor() {
    this.db = null;
    this.init();
  }

  init() {
    const dbPath = process.env.DB_PATH || './database.sqlite';
    this.db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('❌ Error conectando a SQLite:', err.message);
      } else {
        console.log('✅ Conectado a SQLite');
        this.createTables();
      }
    });
  }

  createTables() {
    const createPropertiesTable = `
      CREATE TABLE IF NOT EXISTS properties (
        id TEXT PRIMARY KEY,
        source TEXT NOT NULL,
        title TEXT NOT NULL,
        price TEXT,
        location TEXT,
        rooms INTEGER,
        image TEXT,
        url TEXT NOT NULL,
        city TEXT,
        type TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;

    const createCacheTable = `
      CREATE TABLE IF NOT EXISTS search_cache (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        search_params TEXT NOT NULL,
        results TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        expires_at DATETIME NOT NULL
      )
    `;

    this.db.run(createPropertiesTable, (err) => {
      if (err) {
        console.error('❌ Error creando tabla properties:', err.message);
      } else {
        console.log('✅ Tabla properties creada/verificada');
      }
    });

    this.db.run(createCacheTable, (err) => {
      if (err) {
        console.error('❌ Error creando tabla cache:', err.message);
      } else {
        console.log('✅ Tabla cache creada/verificada');
      }
    });
  }

  // Insertar propiedades
  insertProperties(properties) {
    return new Promise((resolve, reject) => {
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO properties 
        (id, source, title, price, location, rooms, image, url, city, type, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `);

      let inserted = 0;
      properties.forEach(prop => {
        stmt.run([
          prop.id, prop.source, prop.title, prop.price, 
          prop.location, prop.rooms, prop.image, prop.url,
          prop.city, prop.type
        ], (err) => {
          if (err) {
            console.error('Error insertando propiedad:', err.message);
          } else {
            inserted++;
          }
        });
      });

      stmt.finalize((err) => {
        if (err) {
          reject(err);
        } else {
          resolve(inserted);
        }
      });
    });
  }

  // Insertar una sola propiedad (método requerido por scraper)
  insertProperty(property) {
    return new Promise((resolve, reject) => {
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO properties 
        (id, source, title, price, location, rooms, image, url, city, type, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `);

      stmt.run([
        property.id, property.source, property.title, property.price, 
        property.location, property.rooms, property.image, property.url,
        property.city, property.type
      ], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.changes);
        }
      });

      stmt.finalize();
    });
  }

  // Buscar propiedades
  searchProperties(params) {
    return new Promise((resolve, reject) => {
      let query = 'SELECT * FROM properties WHERE 1=1';
      const queryParams = [];

      if (params.city) {
        query += ' AND city LIKE ?';
        queryParams.push(`%${params.city}%`);
      }

      if (params.type) {
        query += ' AND type = ?';
        queryParams.push(params.type);
      }

      if (params.rooms) {
        query += ' AND rooms >= ?';
        queryParams.push(parseInt(params.rooms));
      }

      if (params.budget) {
        // Extraer número del precio para comparar
        query += ' AND CAST(REPLACE(REPLACE(price, "€", ""), ",", "") AS INTEGER) <= ?';
        queryParams.push(parseInt(params.budget));
      }

      query += ' ORDER BY updated_at DESC LIMIT 50';

      this.db.all(query, queryParams, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  // Cache de búsquedas
  getCachedSearch(searchParams) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT results FROM search_cache 
        WHERE search_params = ? AND expires_at > CURRENT_TIMESTAMP
        ORDER BY created_at DESC LIMIT 1
      `;

      this.db.get(query, [JSON.stringify(searchParams)], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row ? JSON.parse(row.results) : null);
        }
      });
    });
  }

  setCachedSearch(searchParams, results) {
    return new Promise((resolve, reject) => {
      const ttl = process.env.CACHE_TTL || 1800; // 30 minutos por defecto
      const expiresAt = new Date(Date.now() + ttl * 1000).toISOString();

      const query = `
        INSERT INTO search_cache (search_params, results, expires_at)
        VALUES (?, ?, ?)
      `;

      this.db.run(query, [
        JSON.stringify(searchParams),
        JSON.stringify(results),
        expiresAt
      ], (err) => {
        if (err) {
          reject(err);
        } else {
          resolve(true);
        }
      });
    });
  }

  // Método alias para compatibilidad con scraper
  cacheSearchResults(searchParams, results) {
    return this.setCachedSearch(searchParams, results);
  }

  // Limpiar cache expirado
  cleanExpiredCache() {
    return new Promise((resolve, reject) => {
      const query = 'DELETE FROM search_cache WHERE expires_at <= CURRENT_TIMESTAMP';
      
      this.db.run(query, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve(this.changes);
        }
      });
    });
  }

  close() {
    if (this.db) {
      this.db.close((err) => {
        if (err) {
          console.error('Error cerrando base de datos:', err.message);
        } else {
          console.log('Base de datos cerrada');
        }
      });
    }
  }
}

module.exports = new Database();
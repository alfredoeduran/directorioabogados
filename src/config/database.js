const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const logger = require('./logger');

/**
 * Configuración mejorada de base de datos
 * Incluye migraciones, índices y métodos optimizados
 */

class Database {
  constructor() {
    this.db = null;
    this.isInitialized = false;
    this.init();
  }

  init() {
    const dbPath = process.env.DB_PATH || path.join(__dirname, '../../database.sqlite');

    this.db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        logger.error('❌ Error conectando a SQLite:', err.message);
        throw err;
      } else {
        logger.info('✅ Conectado a SQLite');
        this.createTables();
      }
    });

    // Configurar SQLite para mejor rendimiento
    this.db.run('PRAGMA journal_mode = WAL');
    this.db.run('PRAGMA synchronous = NORMAL');
    this.db.run('PRAGMA cache_size = 1000000'); // 1GB cache
    this.db.run('PRAGMA temp_store = memory');
  }

  createTables() {
    const tables = [
      // Tabla de propiedades con índices optimizados
      {
        name: 'properties',
        sql: `
          CREATE TABLE IF NOT EXISTS properties (
            id TEXT PRIMARY KEY,
            source TEXT NOT NULL,
            external_id TEXT,
            url TEXT NOT NULL,
            title TEXT NOT NULL,
            price TEXT,
            square_meters REAL,
            main_image TEXT,
            location TEXT,
            property_type TEXT,
            published_date TEXT,
            description TEXT,
            rooms INTEGER,
            floor INTEGER,
            total_floors INTEGER,
            construction_year INTEGER,
            energy_efficiency TEXT,
            heating_type TEXT,
            parking BOOLEAN DEFAULT 0,
            balcony BOOLEAN DEFAULT 0,
            garden BOOLEAN DEFAULT 0,
            elevator BOOLEAN DEFAULT 0,
            furnished BOOLEAN DEFAULT 0,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
            normalized_at TEXT,
            normalization_version TEXT DEFAULT '1.0'
          )
        `,
        indexes: [
          'CREATE INDEX IF NOT EXISTS idx_properties_source ON properties(source)',
          'CREATE INDEX IF NOT EXISTS idx_properties_city ON properties(location)',
          'CREATE INDEX IF NOT EXISTS idx_properties_type ON properties(property_type)',
          'CREATE INDEX IF NOT EXISTS idx_properties_price ON properties(price)',
          'CREATE INDEX IF NOT EXISTS idx_properties_updated ON properties(updated_at)',
          'CREATE INDEX IF NOT EXISTS idx_properties_external_id ON properties(external_id)'
        ]
      },

      // Tabla de caché mejorada
      {
        name: 'search_cache',
        sql: `
          CREATE TABLE IF NOT EXISTS search_cache (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            search_params TEXT NOT NULL,
            results TEXT NOT NULL,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            expires_at TEXT NOT NULL,
            access_count INTEGER DEFAULT 0,
            last_accessed TEXT DEFAULT CURRENT_TIMESTAMP
          )
        `,
        indexes: [
          'CREATE INDEX IF NOT EXISTS idx_cache_params ON search_cache(search_params)',
          'CREATE INDEX IF NOT EXISTS idx_cache_expires ON search_cache(expires_at)',
          'CREATE INDEX IF NOT EXISTS idx_cache_access ON search_cache(last_accessed)'
        ]
      },

      // Tabla de métricas para analytics
      {
        name: 'metrics',
        sql: `
          CREATE TABLE IF NOT EXISTS metrics (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            type TEXT NOT NULL,
            data TEXT NOT NULL,
            timestamp TEXT DEFAULT CURRENT_TIMESTAMP
          )
        `,
        indexes: [
          'CREATE INDEX IF NOT EXISTS idx_metrics_type ON metrics(type)',
          'CREATE INDEX IF NOT EXISTS idx_metrics_timestamp ON metrics(timestamp)'
        ]
      },

      // Tabla de logs de búsqueda para analytics
      {
        name: 'search_logs',
        sql: `
          CREATE TABLE IF NOT EXISTS search_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            search_params TEXT,
            results_count INTEGER,
            duration_ms INTEGER,
            user_ip TEXT,
            user_agent TEXT,
            cached BOOLEAN DEFAULT 0,
            timestamp TEXT DEFAULT CURRENT_TIMESTAMP
          )
        `,
        indexes: [
          'CREATE INDEX IF NOT EXISTS idx_search_logs_timestamp ON search_logs(timestamp)',
          'CREATE INDEX IF NOT EXISTS idx_search_logs_ip ON search_logs(user_ip)'
        ]
      }
    ];

    // Crear tablas e índices
    tables.forEach(table => {
      this.db.run(table.sql, (err) => {
        if (err) {
          logger.error(`❌ Error creando tabla ${table.name}:`, err.message);
        } else {
          logger.info(`✅ Tabla ${table.name} creada/verificada`);

          // Crear índices para la tabla
          if (table.indexes) {
            table.indexes.forEach(indexSql => {
              this.db.run(indexSql, (idxErr) => {
                if (idxErr) {
                  logger.warn(`⚠️ Error creando índice en ${table.name}:`, idxErr.message);
                }
              });
            });
          }
        }
      });
    });

    this.isInitialized = true;
    logger.info('✅ Base de datos inicializada completamente');
  }

  // Métodos para propiedades
  async insertProperties(properties) {
    if (!Array.isArray(properties)) {
      properties = [properties];
    }

    const promises = properties.map(property => this.insertProperty(property));
    return Promise.all(promises);
  }

  async insertProperty(property) {
    const sql = `
      INSERT OR REPLACE INTO properties (
        id, source, external_id, url, title, price, square_meters, main_image,
        location, property_type, published_date, description, rooms, floor,
        total_floors, construction_year, energy_efficiency, heating_type,
        parking, balcony, garden, elevator, furnished, updated_at,
        normalized_at, normalization_version
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const values = [
      property.id,
      property.source,
      property.externalId,
      property.url,
      property.title,
      property.price,
      property.squareMeters,
      property.mainImage,
      property.location,
      property.propertyType,
      property.publishedDate,
      property.description,
      property.rooms,
      property.floor,
      property.totalFloors,
      property.constructionYear,
      property.energyEfficiency,
      property.heatingType,
      property.parking ? 1 : 0,
      property.balcony ? 1 : 0,
      property.garden ? 1 : 0,
      property.elevator ? 1 : 0,
      property.furnished ? 1 : 0,
      new Date().toISOString(),
      property.normalizedAt,
      property.normalizationVersion
    ];

    return new Promise((resolve, reject) => {
      this.db.run(sql, values, function(err) {
        if (err) {
          logger.error('Error insertando propiedad:', err.message);
          reject(err);
        } else {
          resolve(this.changes);
        }
      });
    });
  }

  async searchProperties(params, options = {}) {
    const { limit = 50, offset = 0 } = options;

    let sql = 'SELECT * FROM properties WHERE 1=1';
    const values = [];

    // Aplicar filtros
    if (params.city) {
      sql += ' AND location LIKE ?';
      values.push(`%${params.city}%`);
    }

    if (params.type && params.type !== 'all') {
      sql += ' AND property_type = ?';
      values.push(params.type);
    }

    if (params.rooms && params.rooms !== 'all') {
      sql += ' AND rooms >= ?';
      values.push(parseInt(params.rooms));
    }

    if (params.budget && params.budget !== 'all') {
      sql += ' AND CAST(REPLACE(REPLACE(price, "€", ""), ",", "") AS REAL) <= ?';
      values.push(parseFloat(params.budget));
    }

    // Ordenar por fecha de actualización (más recientes primero)
    sql += ' ORDER BY updated_at DESC';

    // Aplicar paginación
    if (limit > 0) {
      sql += ' LIMIT ?';
      values.push(limit);
    }

    if (offset > 0) {
      sql += ' OFFSET ?';
      values.push(offset);
    }

    return new Promise((resolve, reject) => {
      this.db.all(sql, values, (err, rows) => {
        if (err) {
          logger.error('Error buscando propiedades:', err.message);
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  // Métodos de caché mejorados
  async getCachedSearch(searchParams) {
    const sql = `
      SELECT results, access_count FROM search_cache
      WHERE search_params = ? AND expires_at > CURRENT_TIMESTAMP
      ORDER BY created_at DESC LIMIT 1
    `;

    return new Promise((resolve, reject) => {
      this.db.get(sql, [JSON.stringify(searchParams)], (err, row) => {
        if (err) {
          reject(err);
        } else if (row) {
          // Actualizar contador de accesos
          this.db.run(
            'UPDATE search_cache SET access_count = access_count + 1, last_accessed = CURRENT_TIMESTAMP WHERE search_params = ?',
            [JSON.stringify(searchParams)]
          );

          resolve(JSON.parse(row.results));
        } else {
          resolve(null);
        }
      });
    });
  }

  async setCachedSearch(searchParams, results, ttlSeconds = null) {
    const ttl = ttlSeconds || parseInt(process.env.CACHE_TTL) || 1800;
    const expiresAt = new Date(Date.now() + ttl * 1000).toISOString();

    const sql = `
      INSERT OR REPLACE INTO search_cache (search_params, results, expires_at, access_count, last_accessed)
      VALUES (?, ?, ?, 0, CURRENT_TIMESTAMP)
    `;

    return new Promise((resolve, reject) => {
      this.db.run(sql, [
        JSON.stringify(searchParams),
        JSON.stringify(results),
        expiresAt
      ], function(err) {
        if (err) {
          logger.error('Error guardando en caché:', err.message);
          reject(err);
        } else {
          resolve(this.changes);
        }
      });
    });
  }

  async cleanExpiredCache() {
    const sql = 'DELETE FROM search_cache WHERE expires_at <= CURRENT_TIMESTAMP';

    return new Promise((resolve, reject) => {
      this.db.run(sql, function(err) {
        if (err) {
          reject(err);
        } else {
          logger.info(`🧹 ${this.changes} entradas de caché expiradas eliminadas`);
          resolve(this.changes);
        }
      });
    });
  }

  // Métodos de métricas
  async logSearch(searchParams, resultsCount, duration, userInfo) {
    const sql = `
      INSERT INTO search_logs (search_params, results_count, duration_ms, user_ip, user_agent, cached, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `;

    const values = [
      JSON.stringify(searchParams),
      resultsCount,
      duration,
      userInfo.ip,
      userInfo.userAgent,
      userInfo.cached ? 1 : 0
    ];

    return new Promise((resolve, reject) => {
      this.db.run(sql, values, function(err) {
        if (err) {
          logger.error('Error logging búsqueda:', err.message);
          reject(err);
        } else {
          resolve(this.lastID);
        }
      });
    });
  }

  async getSearchStats(days = 7) {
    const sql = `
      SELECT
        COUNT(*) as total_searches,
        AVG(results_count) as avg_results,
        AVG(duration_ms) as avg_duration,
        SUM(CASE WHEN cached = 1 THEN 1 ELSE 0 END) as cached_searches,
        COUNT(DISTINCT user_ip) as unique_users
      FROM search_logs
      WHERE timestamp >= datetime('now', '-${days} days')
    `;

    return new Promise((resolve, reject) => {
      this.db.get(sql, (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  // Método de estadísticas generales
  async getStats() {
    const stats = {};

    // Contar propiedades por fuente
    const sourceStats = await new Promise((resolve, reject) => {
      this.db.all(
        'SELECT source, COUNT(*) as count FROM properties GROUP BY source',
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });

    stats.propertiesBySource = sourceStats;

    // Estadísticas de caché
    const cacheStats = await new Promise((resolve, reject) => {
      this.db.get(
        'SELECT COUNT(*) as total, SUM(access_count) as total_access FROM search_cache',
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    stats.cache = cacheStats;

    // Total de propiedades
    const totalProperties = await new Promise((resolve, reject) => {
      this.db.get('SELECT COUNT(*) as count FROM properties', (err, row) => {
        if (err) reject(err);
        else resolve(row.count);
      });
    });

    stats.totalProperties = totalProperties;

    return stats;
  }

  // Health check
  async healthCheck() {
    return new Promise((resolve, reject) => {
      this.db.get('SELECT 1 as health', (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row.health === 1);
        }
      });
    });
  }

  // Método para cerrar la conexión
  close() {
    if (this.db) {
      this.db.close((err) => {
        if (err) {
          logger.error('Error cerrando base de datos:', err.message);
        } else {
          logger.info('Base de datos cerrada');
        }
      });
    }
  }

  // Método para hacer backup (básico)
  async backup() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(__dirname, `../../backups/backup-${timestamp}.sqlite`);

    // Crear directorio de backups si no existe
    const fs = require('fs');
    const backupDir = path.dirname(backupPath);
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    return new Promise((resolve, reject) => {
      // SQLite no tiene backup built-in fácil, así que copiamos el archivo
      const sourcePath = process.env.DB_PATH || path.join(__dirname, '../../database.sqlite');

      fs.copyFile(sourcePath, backupPath, (err) => {
        if (err) {
          reject(err);
        } else {
          logger.info(`Backup creado: ${backupPath}`);
          resolve(backupPath);
        }
      });
    });
  }
}

module.exports = new Database();
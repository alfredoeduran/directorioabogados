const winston = require('winston');
const path = require('path');

// Configuración de niveles de log personalizados
const customLevels = {
  levels: {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    debug: 4,
    scraping: 5,
    translation: 6
  },
  colors: {
    error: 'red',
    warn: 'yellow',
    info: 'green',
    http: 'magenta',
    debug: 'blue',
    scraping: 'cyan',
    translation: 'grey'
  }
};

// Agregar colores a winston
winston.addColors(customLevels.colors);

// Formato personalizado para logs
const customFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let log = `${timestamp} [${level.toUpperCase()}]: ${message}`;

    // Agregar metadatos si existen
    if (Object.keys(meta).length > 0) {
      log += ` | ${JSON.stringify(meta)}`;
    }

    return log;
  })
);

// Formato para consola (más legible)
const consoleFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'HH:mm:ss'
  }),
  winston.format.colorize({ all: true }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let log = `${timestamp} ${level}: ${message}`;

    // Agregar metadatos importantes de forma legible
    if (meta.durationMs) {
      log += ` (${meta.durationMs}ms)`;
    }
    if (meta.portal) {
      log += ` [${meta.portal}]`;
    }
    if (meta.city) {
      log += ` [${meta.city}]`;
    }

    return log;
  })
);

// Configuración de transports
const transports = [];

// Transport para consola
transports.push(
  new winston.transports.Console({
    level: process.env.LOG_LEVEL || 'info',
    format: consoleFormat,
    handleExceptions: true,
    handleRejections: true
  })
);

// Transport para archivo de logs generales
const logDir = process.env.LOG_FILE ? path.dirname(process.env.LOG_FILE) : './logs';
const logFile = process.env.LOG_FILE || './logs/app.log';

transports.push(
  new winston.transports.File({
    filename: logFile,
    level: 'info',
    format: customFormat,
    maxsize: 5242880, // 5MB
    maxFiles: 5,
    tailable: true
  })
);

// Transport específico para errores
transports.push(
  new winston.transports.File({
    filename: path.join(logDir, 'error.log'),
    level: 'error',
    format: customFormat,
    maxsize: 5242880, // 5MB
    maxFiles: 5,
    tailable: true
  })
);

// Transport específico para scraping
transports.push(
  new winston.transports.File({
    filename: path.join(logDir, 'scraping.log'),
    level: 'scraping',
    format: customFormat,
    maxsize: 5242880, // 5MB
    maxFiles: 3,
    tailable: true
  })
);

// Crear logger
const logger = winston.createLogger({
  levels: customLevels.levels,
  transports,
  exitOnError: false
});

// Métodos de conveniencia para diferentes tipos de logs
logger.scraping = (message, meta = {}) => {
  logger.log('scraping', message, { ...meta, category: 'scraping' });
};

logger.translation = (message, meta = {}) => {
  logger.log('translation', message, { ...meta, category: 'translation' });
};

logger.api = (message, meta = {}) => {
  logger.log('http', message, { ...meta, category: 'api' });
};

logger.performance = (message, durationMs, meta = {}) => {
  logger.log('info', message, { ...meta, durationMs, category: 'performance' });
};

// Middleware para Express que loguea requests HTTP
logger.expressMiddleware = (req, res, next) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const meta = {
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      durationMs: duration
    };

    if (res.statusCode >= 400) {
      logger.warn(`HTTP ${res.statusCode} ${req.method} ${req.originalUrl}`, meta);
    } else {
      logger.http(`HTTP ${res.statusCode} ${req.method} ${req.originalUrl}`, meta);
    }
  });

  next();
};

// Función para crear child loggers con contexto
logger.createChild = (context) => {
  return logger.child(context);
};

// Función para loguear métricas de rendimiento
logger.logMetrics = (operation, startTime, meta = {}) => {
  const duration = Date.now() - startTime;
  logger.performance(`${operation} completed`, duration, meta);
};

// Función para loguear errores de scraping con contexto
logger.logScrapingError = (portal, city, error, meta = {}) => {
  logger.error(`Scraping failed for ${portal} in ${city}`, {
    ...meta,
    portal,
    city,
    error: error.message,
    stack: error.stack
  });
};

// Función para loguear resultados de scraping
logger.logScrapingResults = (portal, city, resultsCount, duration, meta = {}) => {
  logger.scraping(`Scraped ${resultsCount} properties from ${portal} in ${city}`, {
    ...meta,
    portal,
    city,
    resultsCount,
    durationMs: duration
  });
};

module.exports = logger;
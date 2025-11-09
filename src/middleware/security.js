const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const logger = require('../config/logger');

/**
 * Middleware de seguridad para la aplicación
 * Incluye rate limiting, headers de seguridad, y validación de API keys
 */

// Rate limiter general para API
const apiLimiter = rateLimit({
  windowMs: parseInt(process.env.API_RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutos por defecto
  max: parseInt(process.env.API_RATE_LIMIT_MAX_REQUESTS) || 100, // 100 requests por ventana
  message: {
    success: false,
    error: 'Demasiadas solicitudes, por favor intenta más tarde',
    retryAfter: '15 minutos'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next, options) => {
    logger.warn('Rate limit excedido:', {
      ip: req.ip,
      url: req.originalUrl,
      userAgent: req.get('User-Agent')
    });

    res.status(options.statusCode).json(options.message);
  },
  skip: (req) => {
    // Permitir health checks sin límite
    return req.path === '/health' || req.path === '/api/health';
  }
});

// Rate limiter más estricto para búsquedas
const searchLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutos
  max: 20, // 20 búsquedas por ventana
  message: {
    success: false,
    error: 'Límite de búsquedas excedido, por favor espera 10 minutos',
    retryAfter: '10 minutos'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next, options) => {
    logger.warn('Search rate limit excedido:', {
      ip: req.ip,
      url: req.originalUrl,
      userAgent: req.get('User-Agent')
    });

    res.status(options.statusCode).json(options.message);
  }
});

// Rate limiter para endpoints administrativos
const adminLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 10, // 10 requests por hora
  message: {
    success: false,
    error: 'Límite administrativo excedido',
    retryAfter: '1 hora'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Middleware de validación de API key para WordPress
function validateApiKey(req, res, next) {
  const apiKey = req.headers['x-api-key'] || req.query.api_key;

  if (!apiKey) {
    logger.warn('Request sin API key:', {
      ip: req.ip,
      url: req.originalUrl,
      userAgent: req.get('User-Agent')
    });

    return res.status(401).json({
      success: false,
      error: 'API key requerida',
      message: 'Debes proporcionar una API key válida para acceder a este endpoint'
    });
  }

  const validApiKey = process.env.API_SECRET_KEY;
  if (!validApiKey) {
    logger.error('API_SECRET_KEY no configurada en el servidor');
    return res.status(500).json({
      success: false,
      error: 'Configuración del servidor incompleta'
    });
  }

  if (apiKey !== validApiKey) {
    logger.warn('API key inválida:', {
      ip: req.ip,
      url: req.originalUrl,
      providedKey: apiKey.substring(0, 8) + '...',
      userAgent: req.get('User-Agent')
    });

    return res.status(403).json({
      success: false,
      error: 'API key inválida',
      message: 'La API key proporcionada no es válida'
    });
  }

  // API key válida, continuar
  next();
}

// Middleware de validación de JWT (para futuras expansiones)
function validateJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Token requerido',
      message: 'Debes proporcionar un token JWT válido'
    });
  }

  const jwt = require('jsonwebtoken');
  const jwtSecret = process.env.JWT_SECRET;

  if (!jwtSecret) {
    logger.error('JWT_SECRET no configurada');
    return res.status(500).json({
      success: false,
      error: 'Configuración del servidor incompleta'
    });
  }

  try {
    const decoded = jwt.verify(token, jwtSecret);
    req.user = decoded;
    next();
  } catch (error) {
    logger.warn('Token JWT inválido:', {
      error: error.message,
      ip: req.ip
    });

    return res.status(403).json({
      success: false,
      error: 'Token inválido',
      message: 'El token JWT proporcionado no es válido o ha expirado'
    });
  }
}

// Middleware de sanitización de entrada
function sanitizeInput(req, res, next) {
  // Función recursiva para sanitizar objetos
  function sanitize(obj) {
    if (typeof obj === 'string') {
      // Remover caracteres potencialmente peligrosos
      return obj
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<[^>]*>/g, '')
        .trim();
    } else if (Array.isArray(obj)) {
      return obj.map(item => sanitize(item));
    } else if (obj !== null && typeof obj === 'object') {
      const sanitized = {};
      for (const [key, value] of Object.entries(obj)) {
        sanitized[key] = sanitize(value);
      }
      return sanitized;
    }
    return obj;
  }

  // Sanitizar body, query y params
  if (req.body) req.body = sanitize(req.body);
  if (req.query) req.query = sanitize(req.query);
  if (req.params) req.params = sanitize(req.params);

  next();
}

// Middleware de logging de seguridad
function securityLogger(req, res, next) {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const logData = {
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      apiKey: req.headers['x-api-key'] ? 'present' : 'absent'
    };

    // Loggear requests sospechosos
    if (res.statusCode >= 400) {
      logger.warn('Request con error:', logData);
    } else if (duration > 5000) { // Requests que tardan más de 5 segundos
      logger.warn('Request lento:', logData);
    } else {
      logger.debug('Request completado:', logData);
    }
  });

  next();
}

// Configuración de Helmet para headers de seguridad
const helmetConfig = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ['\'self\''],
      styleSrc: ['\'self\'', '\'unsafe-inline\'', 'https://fonts.googleapis.com'],
      fontSrc: ['\'self\'', 'https://fonts.gstatic.com'],
      scriptSrc: ['\'self\''],
      imgSrc: ['\'self\'', 'data:', 'https:'],
      connectSrc: ['\'self\'']
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  noSniff: true,
  xssFilter: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
});

// Middleware de CORS personalizado
function corsHandler(req, res, next) {
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'];

  const origin = req.headers.origin;
  if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin || allowedOrigins[0]);
  }

  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-API-Key');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Max-Age', '86400'); // 24 horas

  // Manejar preflight requests
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
}

// Middleware para validar que el request viene de WordPress
function validateWordPressOrigin(req, res, next) {
  const userAgent = req.get('User-Agent') || '';
  const referer = req.get('Referer') || '';

  // Verificar si parece venir de WordPress
  const isWordPress = userAgent.includes('WordPress') ||
                     referer.includes('wp-admin') ||
                     referer.includes('wp-content');

  if (isWordPress) {
    logger.debug('Request identificado como proveniente de WordPress', {
      userAgent: userAgent.substring(0, 100),
      referer: referer.substring(0, 100)
    });
  }

  // Por ahora solo loggear, no bloquear
  next();
}

module.exports = {
  apiLimiter,
  searchLimiter,
  adminLimiter,
  validateApiKey,
  validateJWT,
  sanitizeInput,
  securityLogger,
  helmetConfig,
  corsHandler,
  validateWordPressOrigin,

  // Función para aplicar todos los middlewares de seguridad
  applySecurityMiddlewares: (app) => {
    // Headers de seguridad
    app.use(helmetConfig);

    // CORS
    app.use(corsHandler);

    // Logging de seguridad
    app.use(securityLogger);

    // Sanitización de entrada
    app.use(sanitizeInput);

    // Validación de origen WordPress
    app.use(validateWordPressOrigin);

    // Rate limiting general
    app.use('/api', apiLimiter);

    // Rate limiting específico para búsquedas
    app.use('/api/search', searchLimiter);

    // Rate limiting para endpoints administrativos
    app.use('/api/refresh', adminLimiter);
    app.use('/api/stats', adminLimiter);
  }
};
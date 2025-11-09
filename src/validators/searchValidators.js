const Joi = require('joi');

/**
 * Validadores para las consultas de búsqueda
 */

// Esquema de validación para parámetros de búsqueda
const searchParamsSchema = Joi.object({
  city: Joi.string()
    .trim()
    .min(2)
    .max(100)
    .pattern(/^[a-zA-ZÀ-ÿ\s\-']+$/)
    .messages({
      'string.min': 'La ciudad debe tener al menos 2 caracteres',
      'string.max': 'La ciudad no puede tener más de 100 caracteres',
      'string.pattern.base': 'La ciudad solo puede contener letras, espacios, guiones y apóstrofes'
    }),

  type: Joi.string()
    .valid('apartment', 'room', 'house', 'studio', 'all')
    .default('all')
    .messages({
      'any.only': 'El tipo debe ser: apartment, room, house, studio o all'
    }),

  rooms: Joi.number()
    .integer()
    .min(1)
    .max(10)
    .when('type', {
      is: 'room',
      then: Joi.number().max(1).messages({
        'number.max': 'Las habitaciones no pueden ser más de 1 para tipo room'
      })
    })
    .messages({
      'number.min': 'Las habitaciones deben ser al menos 1',
      'number.max': 'Las habitaciones no pueden ser más de 10'
    }),

  budget: Joi.number()
    .integer()
    .min(100)
    .max(5000)
    .messages({
      'number.min': 'El presupuesto debe ser al menos 100€',
      'number.max': 'El presupuesto no puede ser más de 5000€'
    }),

  page: Joi.number()
    .integer()
    .min(1)
    .max(100)
    .default(1)
    .messages({
      'number.min': 'La página debe ser al menos 1',
      'number.max': 'La página no puede ser más de 100'
    }),

  limit: Joi.number()
    .integer()
    .min(1)
    .max(50)
    .default(12)
    .messages({
      'number.min': 'El límite debe ser al menos 1',
      'number.max': 'El límite no puede ser más de 50'
    }),

  forceRefresh: Joi.boolean()
    .default(false)
});

// Esquema de validación para actualización manual de datos
const refreshParamsSchema = Joi.object({
  city: Joi.string()
    .trim()
    .min(2)
    .max(100)
    .required()
    .messages({
      'string.min': 'La ciudad debe tener al menos 2 caracteres',
      'string.max': 'La ciudad no puede tener más de 100 caracteres',
      'any.required': 'La ciudad es requerida'
    }),

  maxResults: Joi.number()
    .integer()
    .min(1)
    .max(100)
    .default(30)
    .messages({
      'number.min': 'Los resultados máximos deben ser al menos 1',
      'number.max': 'Los resultados máximos no pueden ser más de 100'
    }),

  type: Joi.string()
    .valid('apartment', 'room', 'house', 'studio', 'all')
    .default('all')
});

// Esquema de validación para consultas de traducción
const translationParamsSchema = Joi.object({
  text: Joi.string()
    .trim()
    .min(1)
    .max(1000)
    .required()
    .messages({
      'string.min': 'El texto a traducir no puede estar vacío',
      'string.max': 'El texto a traducir no puede tener más de 1000 caracteres',
      'any.required': 'El texto a traducir es requerido'
    }),

  from: Joi.string()
    .valid('es', 'de')
    .default('es')
    .messages({
      'any.only': 'El idioma origen debe ser "es" o "de"'
    }),

  to: Joi.string()
    .valid('es', 'de')
    .default('de')
    .messages({
      'any.only': 'El idioma destino debe ser "es" o "de"'
    })
});

/**
 * Función de validación con manejo de errores
 */
function validateSearchParams(params) {
  const { error, value } = searchParamsSchema.validate(params, {
    abortEarly: false,
    stripUnknown: true
  });

  if (error) {
    const errors = error.details.map(detail => ({
      field: detail.path.join('.'),
      message: detail.message,
      value: detail.context.value
    }));

    return {
      isValid: false,
      errors,
      value: null
    };
  }

  return {
    isValid: true,
    errors: [],
    value
  };
}

function validateRefreshParams(params) {
  const { error, value } = refreshParamsSchema.validate(params, {
    abortEarly: false,
    stripUnknown: true
  });

  if (error) {
    const errors = error.details.map(detail => ({
      field: detail.path.join('.'),
      message: detail.message,
      value: detail.context.value
    }));

    return {
      isValid: false,
      errors,
      value: null
    };
  }

  return {
    isValid: true,
    errors: [],
    value
  };
}

function validateTranslationParams(params) {
  const { error, value } = translationParamsSchema.validate(params, {
    abortEarly: false,
    stripUnknown: true
  });

  if (error) {
    const errors = error.details.map(detail => ({
      field: detail.path.join('.'),
      message: detail.message,
      value: detail.context.value
    }));

    return {
      isValid: false,
      errors,
      value: null
    };
  }

  return {
    isValid: true,
    errors: [],
    value
  };
}

/**
 * Middleware de validación para Express
 */
function validateSearchRequest(req, res, next) {
  const validation = validateSearchParams(req.query);

  if (!validation.isValid) {
    return res.status(400).json({
      success: false,
      error: 'Parámetros de búsqueda inválidos',
      details: validation.errors,
      timestamp: new Date().toISOString()
    });
  }

  // Asignar parámetros validados a req.query
  req.query = validation.value;
  next();
}

function validateRefreshRequest(req, res, next) {
  const validation = validateRefreshParams({
    ...req.params,
    ...req.query
  });

  if (!validation.isValid) {
    return res.status(400).json({
      success: false,
      error: 'Parámetros de actualización inválidos',
      details: validation.errors,
      timestamp: new Date().toISOString()
    });
  }

  // Asignar parámetros validados
  req.validatedParams = validation.value;
  next();
}

function validateTranslationRequest(req, res, next) {
  const validation = validateTranslationParams(req.body);

  if (!validation.isValid) {
    return res.status(400).json({
      success: false,
      error: 'Parámetros de traducción inválidos',
      details: validation.errors,
      timestamp: new Date().toISOString()
    });
  }

  // Asignar parámetros validados
  req.validatedParams = validation.value;
  next();
}

module.exports = {
  validateSearchParams,
  validateRefreshParams,
  validateTranslationParams,
  validateSearchRequest,
  validateRefreshRequest,
  validateTranslationRequest,
  schemas: {
    searchParamsSchema,
    refreshParamsSchema,
    translationParamsSchema
  }
};
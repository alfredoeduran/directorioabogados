const express = require('express');
const router = express.Router();
const database = require('./database');
const scraper = require('../services/scraper');
const scheduler = require('../services/scheduler');

// Cache en memoria para desarrollo
const memoryCache = new Map();

// Datos de prueba para testing inicial
const mockProperties = [
  // Berlin - Propiedades existentes mejoradas
  {
    id: 'wg_001',
    source: 'wg-gesucht',
    title: 'Schöne 2-Zimmer Wohnung in Berlin Mitte',
    price: '850€',
    location: 'Berlin-Mitte',
    rooms: 2,
    image: 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=400&h=250&fit=crop&crop=center',
    url: 'https://www.wg-gesucht.de/wohnungen-in-Berlin-Mitte.8739.2.1.0.html',
    city: 'Berlin',
    type: 'apartment'
  },
  {
    id: 'wg_002',
    source: 'wg-gesucht',
    title: 'Gemütliches WG-Zimmer in Kreuzberg',
    price: '650€',
    location: 'Berlin-Kreuzberg',
    rooms: 1,
    image: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=400&h=250&fit=crop&crop=center',
    url: 'https://www.wg-gesucht.de/wg-zimmer-in-Berlin-Kreuzberg.8739.0.1.0.html',
    city: 'Berlin',
    type: 'room'
  },
  {
    id: 'ka_001',
    source: 'kleinanzeigen',
    title: '3-Zimmer Wohnung mit Balkon',
    price: '1200€',
    location: 'Berlin-Prenzlauer Berg',
    rooms: 3,
    image: 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=400&h=250&fit=crop&crop=center',
    url: 'https://www.kleinanzeigen.de/s-wohnung-mieten/berlin/c203l3331',
    city: 'Berlin',
    type: 'apartment'
  },
  {
    id: 'wg_004',
    source: 'wg-gesucht',
    title: 'Familienhaus mit Garten',
    price: '1800€',
    location: 'Berlin-Zehlendorf',
    rooms: 4,
    image: 'https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=400&h=250&fit=crop&crop=center',
    url: 'https://www.wg-gesucht.de/haeuser-in-Berlin-Zehlendorf.8739.3.1.0.html',
    city: 'Berlin',
    type: 'house'
  },
  
  // Berlin - Nuevas propiedades adicionales
  {
    id: 'wg_005',
    source: 'wg-gesucht',
    title: 'Moderne Studio-Wohnung in Friedrichshain',
    price: '720€',
    location: 'Berlin-Friedrichshain',
    rooms: 1,
    image: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=400&h=250&fit=crop&crop=center',
    url: 'https://www.wg-gesucht.de/wohnungen-in-Berlin-Friedrichshain.8739.2.1.0.html',
    city: 'Berlin',
    type: 'apartment'
  },
  {
    id: 'ka_003',
    source: 'kleinanzeigen',
    title: 'Helles WG-Zimmer in Charlottenburg',
    price: '680€',
    location: 'Berlin-Charlottenburg',
    rooms: 1,
    image: 'https://images.unsplash.com/photo-1484154218962-a197022b5858?w=400&h=250&fit=crop&crop=center',
    url: 'https://www.kleinanzeigen.de/s-wg-zimmer/berlin-charlottenburg/c199l3331',
    city: 'Berlin',
    type: 'room'
  },
  {
    id: 'wg_006',
    source: 'wg-gesucht',
    title: '2-Zimmer Altbau in Schöneberg',
    price: '950€',
    location: 'Berlin-Schöneberg',
    rooms: 2,
    image: 'https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=400&h=250&fit=crop&crop=center',
    url: 'https://www.wg-gesucht.de/wohnungen-in-Berlin-Schoeneberg.8739.2.1.0.html',
    city: 'Berlin',
    type: 'apartment'
  },
  {
    id: 'ka_004',
    source: 'kleinanzeigen',
    title: 'Luxus-Apartment in Berlin Mitte',
    price: '1400€',
    location: 'Berlin-Mitte',
    rooms: 2,
    image: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=400&h=250&fit=crop&crop=center',
    url: 'https://www.kleinanzeigen.de/s-wohnung-mieten/berlin-mitte/c203l3331',
    city: 'Berlin',
    type: 'apartment'
  },
  {
    id: 'wg_007',
    source: 'wg-gesucht',
    title: 'Gemütliches Zimmer in Neukölln',
    price: '590€',
    location: 'Berlin-Neukölln',
    rooms: 1,
    image: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400&h=250&fit=crop&crop=center',
    url: 'https://www.wg-gesucht.de/wg-zimmer-in-Berlin-Neukoelln.8739.0.1.0.html',
    city: 'Berlin',
    type: 'room'
  },
  {
    id: 'ka_005',
    source: 'kleinanzeigen',
    title: '3-Zimmer Wohnung in Tempelhof',
    price: '1100€',
    location: 'Berlin-Tempelhof',
    rooms: 3,
    image: 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=400&h=250&fit=crop&crop=center',
    url: 'https://www.kleinanzeigen.de/s-wohnung-mieten/berlin-tempelhof/c203l3331',
    city: 'Berlin',
    type: 'apartment'
  },
  {
    id: 'wg_008',
    source: 'wg-gesucht',
    title: 'Penthouse mit Dachterrasse in Prenzlauer Berg',
    price: '1600€',
    location: 'Berlin-Prenzlauer Berg',
    rooms: 3,
    image: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=400&h=250&fit=crop&crop=center',
    url: 'https://www.wg-gesucht.de/wohnungen-in-Berlin-Prenzlauer-Berg.8739.2.1.0.html',
    city: 'Berlin',
    type: 'apartment'
  },
  {
    id: 'ka_006',
    source: 'kleinanzeigen',
    title: 'Studentenzimmer in Wedding',
    price: '520€',
    location: 'Berlin-Wedding',
    rooms: 1,
    image: 'https://images.unsplash.com/photo-1555854877-bab0e564b8d5?w=400&h=250&fit=crop&crop=center',
    url: 'https://www.kleinanzeigen.de/s-wg-zimmer/berlin-wedding/c199l3331',
    city: 'Berlin',
    type: 'room'
  },
  {
    id: 'wg_009',
    source: 'wg-gesucht',
    title: '4-Zimmer Maisonette in Steglitz',
    price: '1500€',
    location: 'Berlin-Steglitz',
    rooms: 4,
    image: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=400&h=250&fit=crop&crop=center',
    url: 'https://www.wg-gesucht.de/wohnungen-in-Berlin-Steglitz.8739.2.1.0.html',
    city: 'Berlin',
    type: 'apartment'
  },
  
  // Otras ciudades
  {
    id: 'wg_003',
    source: 'wg-gesucht',
    title: 'Moderne 1-Zimmer Wohnung',
    price: '750€',
    location: 'München-Schwabing',
    rooms: 1,
    image: 'https://images.unsplash.com/photo-1571055107559-3e67626fa8be?w=400&h=250&fit=crop&crop=center',
    url: 'https://www.wg-gesucht.de/wohnungen-in-Muenchen-Schwabing.90.2.1.0.html',
    city: 'München',
    type: 'apartment'
  },
  {
    id: 'ka_002',
    source: 'kleinanzeigen',
    title: 'Großes WG-Zimmer in Hamburg',
    price: '580€',
    location: 'Hamburg-Altona',
    rooms: 1,
    image: 'https://images.unsplash.com/photo-1560185007-cde436f6a4d0?w=400&h=250&fit=crop&crop=center',
    url: 'https://www.kleinanzeigen.de/s-wg-zimmer/hamburg/c199l9409',
    city: 'Hamburg',
    type: 'room'
  }
];

// Inicializar datos de prueba
async function initMockData() {
  try {
    await database.insertProperties(mockProperties);
    console.log('✅ Datos de prueba insertados en la base de datos');
  } catch (error) {
    console.error('❌ Error insertando datos de prueba:', error);
  }
}

// Inicializar al cargar el módulo
setTimeout(initMockData, 1000);

// Validar parámetros de búsqueda
function validateSearchParams(params) {
  const errors = [];
  
  if (params.city && typeof params.city !== 'string') {
    errors.push('Ciudad debe ser texto');
  }
  
  if (params.type && !['apartment', 'room', 'house'].includes(params.type)) {
    errors.push('Tipo debe ser: apartment, room o house');
  }
  
  if (params.rooms && (isNaN(params.rooms) || params.rooms < 1 || params.rooms > 10)) {
    errors.push('Habitaciones debe ser un número entre 1 y 10');
  }
  
  if (params.budget && (isNaN(params.budget) || params.budget < 100 || params.budget > 5000)) {
    errors.push('Presupuesto debe ser un número entre 100 y 5000');
  }
  
  return errors;
}

// Filtrar propiedades en memoria (para desarrollo rápido)
function filterProperties(properties, params) {
  return properties.filter(prop => {
    if (params.city && !prop.city.toLowerCase().includes(params.city.toLowerCase())) {
      return false;
    }
    
    if (params.type && prop.type !== params.type) {
      return false;
    }
    
    if (params.rooms && prop.rooms < parseInt(params.rooms)) {
      return false;
    }
    
    if (params.budget) {
      const price = parseInt(prop.price.replace(/[€,]/g, ''));
      if (price > parseInt(params.budget)) {
        return false;
      }
    }
    
    return true;
  });
}

// Endpoint principal de búsqueda con datos reales
router.get('/search', async (req, res) => {
  try {
    const { city, type, rooms, budget, page = 1, limit = 6, forceRefresh = false } = req.query;
    
    // Preparar parámetros mejorados
    const params = {
      city: city?.trim(),
      type: type !== 'all' ? type : undefined,
      rooms: rooms !== 'all' ? parseInt(rooms) : undefined,
      budget: budget !== 'all' ? parseInt(budget) : undefined
    };

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const offset = (pageNum - 1) * limitNum;

    // Validar parámetros
    const validationErrors = validateSearchParams(params);
    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        error: validationErrors.join(', ')
      });
    }

    // Crear clave de caché (sin incluir page y limit para cachear todos los resultados)
    const cacheKey = JSON.stringify(params);
    
    let allResults = [];
    let fromCache = false;
    let cacheSource = '';
    const useRealData = process.env.SCRAPING_ENABLED === 'true';
    
    // Verificar caché en memoria primero (solo si no se fuerza refresh)
    if (!forceRefresh && memoryCache.has(cacheKey)) {
      const cached = memoryCache.get(cacheKey);
      if (cached.expires > Date.now()) {
        console.log('📦 Resultado desde caché en memoria');
        allResults = cached.data;
        fromCache = true;
        cacheSource = 'memory';
      } else {
        memoryCache.delete(cacheKey);
      }
    }

    // Si no está en memoria y no se fuerza refresh, verificar caché en base de datos
    if (!fromCache && !forceRefresh) {
      try {
        const cachedResults = await database.getCachedSearch(params);
        if (cachedResults) {
          console.log('📦 Resultado desde caché de base de datos');
          
          // Guardar en caché de memoria también
          memoryCache.set(cacheKey, {
            data: cachedResults,
            expires: Date.now() + 30 * 60 * 1000 // 30 minutos
          });
          
          allResults = cachedResults;
          fromCache = true;
          cacheSource = 'database';
        }
      } catch (cacheError) {
        console.warn('⚠️ Error accediendo al caché:', cacheError.message);
      }
    }

    // Si no está en caché o se fuerza refresh, obtener datos frescos
    if (!fromCache || forceRefresh) {
      try {
        if (useRealData && (scraper.shouldRefreshData() || forceRefresh)) {
          console.log('🔍 Obteniendo datos reales via scraping...');
          
          // Parámetros mejorados para el scraper
          const scrapingOptions = {
            type: params.type,
            rooms: params.rooms,
            budget: params.budget,
            maxResults: parseInt(process.env.MAX_RESULTS_PER_SITE) || 50,
            // Nuevos parámetros específicos
            includeRooms: !params.type || params.type === 'room',
            includeApartments: !params.type || params.type === 'apartment',
            minRooms: params.rooms ? Math.max(1, params.rooms - 1) : 1,
            maxRooms: params.rooms ? params.rooms + 1 : 10,
            maxBudget: params.budget ? params.budget * 1.2 : undefined
          };
          
          allResults = await scraper.scrapeProperties(params.city, scrapingOptions);
          cacheSource = 'scraping';
          
          // Guardar en caché si obtuvimos resultados
          if (allResults.length > 0) {
            memoryCache.set(cacheKey, {
              data: allResults,
              expires: Date.now() + 30 * 60 * 1000 // 30 minutos
            });
            
            // También guardar en base de datos para caché persistente
            try {
              await database.cacheSearchResults(params, allResults);
            } catch (cacheError) {
              console.warn('⚠️ Error guardando en caché de BD:', cacheError.message);
            }
          }
        } else {
          // Buscar en base de datos
          allResults = await database.searchProperties(params);
          console.log(`🔍 Encontradas ${allResults.length} propiedades en base de datos`);
          cacheSource = 'database';
        }
      } catch (dbError) {
        console.warn('⚠️ Error obteniendo datos reales, usando datos mock:', dbError.message);
        allResults = filterProperties(mockProperties, params);
        cacheSource = 'mock';
      }

      // Si no hay resultados en BD/scraping, usar mock data como fallback
      if (allResults.length === 0) {
        console.log('📝 Usando datos de prueba como fallback');
        allResults = filterProperties(mockProperties, params);
        cacheSource = 'mock';
      }

      // Guardar en caché solo si no son datos mock
      if (cacheSource !== 'mock') {
        try {
          await database.setCachedSearch(params, allResults);
        } catch (cacheError) {
          console.warn('⚠️ Error guardando en caché:', cacheError.message);
        }

        // Guardar en caché de memoria
        memoryCache.set(cacheKey, {
          data: allResults,
          expires: Date.now() + 30 * 60 * 1000 // 30 minutos
        });
      }
    }

    // Aplicar paginación
    const totalResults = allResults.length;
    const totalPages = Math.ceil(totalResults / limitNum);
    const paginatedResults = allResults.slice(offset, offset + limitNum);

    res.json({
      success: true,
      results: paginatedResults,
      pagination: {
        currentPage: pageNum,
        totalPages: totalPages,
        totalResults: totalResults,
        resultsPerPage: limitNum,
        hasNextPage: pageNum < totalPages,
        hasPrevPage: pageNum > 1
      },
      cached: fromCache,
      source: cacheSource,
      query: params,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error en búsqueda:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
});

// Endpoint para forzar actualización de datos
router.post('/refresh/:city', async (req, res) => {
  try {
    const { city } = req.params;
    
    if (!city || city.length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Ciudad inválida'
      });
    }

    console.log(`🔄 Forzando actualización de datos para ${city}...`);
    
    const results = await scheduler.manualScraping(city, {
      maxResults: 30
    });

    // Limpiar caché relacionado
    const keysToDelete = [];
    memoryCache.forEach((value, key) => {
      if (key.includes(city.toLowerCase())) {
        keysToDelete.push(key);
      }
    });
    keysToDelete.forEach(key => memoryCache.delete(key));

    res.json({
      success: true,
      message: `Datos actualizados para ${city}`,
      results: results.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error forzando actualización:', error);
    res.status(500).json({
      success: false,
      error: 'Error actualizando datos'
    });
  }
});

// Endpoint de estadísticas mejorado
router.get('/stats', async (req, res) => {
  try {
    const dbStats = await database.getStats();
    const schedulerStats = scheduler.getStatus();
    const scraperStats = scraper.getStats();

    res.json({
      success: true,
      database: dbStats,
      scheduler: schedulerStats,
      scraper: scraperStats,
      cache: {
        memoryEntries: memoryCache.size,
        scrapingEnabled: process.env.SCRAPING_ENABLED === 'true'
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error obteniendo estadísticas:', error);
    res.status(500).json({
      success: false,
      error: 'Error obteniendo estadísticas'
    });
  }
});

// Limpiar cache periódicamente
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of memoryCache.entries()) {
    if (value.expires <= now) {
      memoryCache.delete(key);
    }
  }
  
  // Limpiar cache de base de datos
  database.cleanExpiredCache().catch(err => {
    console.warn('⚠️ Error limpiando cache de BD:', err.message);
  });
}, 5 * 60 * 1000); // Cada 5 minutos

module.exports = router;
const axios = require('axios');
const logger = require('../config/logger');

/**
 * Servicio de traducción para consultas inmobiliarias
 * Soporta DeepL API y mapeo de términos específicos del sector
 */

class TranslationService {
  constructor() {
    this.deeplApiKey = process.env.DEEPL_API_KEY;
    this.deeplBaseUrl = 'https://api.deepl.com/v2';
    this.deeplFreeUrl = 'https://api-free.deepl.com/v2';

    // Mapeo de términos inmobiliarios ES ↔ DE
    this.termMappings = {
      // Tipos de vivienda
      'apartamento': 'wohnung',
      'piso': 'wohnung',
      'casa': 'haus',
      'chalet': 'haus',
      'villa': 'villa',
      'ático': 'dachgeschoss',
      'bajo': 'erdgeschoss',
      'estudio': 'studio',
      'loft': 'loft',
      'duplex': 'duplex',

      // Habitaciones
      'habitación': 'zimmer',
      'dormitorio': 'schlafzimmer',
      'sala': 'wohnzimmer',
      'salón': 'wohnzimmer',
      'cocina': 'küche',
      'baño': 'bad',
      'aseo': 'wc',

      // Características
      'terraza': 'terrasse',
      'balcón': 'balkon',
      'jardín': 'garten',
      'garaje': 'garage',
      'parking': 'parkplatz',
      'ascensor': 'aufzug',
      'amueblado': 'möbliert',
      'calefacción': 'heizung',
      'aire acondicionado': 'klimaanlage',

      // Precios y contratos
      'alquiler': 'miete',
      'venta': 'verkauf',
      'alquilar': 'mieten',
      'comprar': 'kaufen',
      'mensual': 'monatlich',
      'anual': 'jährlich',

      // Ubicaciones comunes
      'centro': 'zentrum',
      'barrio': 'stadtteil',
      'zona': 'gebiet',
      'cerca': 'nah',
      'lejos': 'weit',

      // Términos de búsqueda
      'busco': 'suche',
      'necesito': 'brauche',
      'quiero': 'will',
      'barato': 'günstig',
      'caro': 'teuer',
      'moderno': 'modern',
      'antiguo': 'altbau',
      'nuevo': 'neubau'
    };

    // Mapeo inverso DE → ES
    this.reverseMappings = this.createReverseMappings();
  }

  /**
   * Crea el mapeo inverso DE → ES
   */
  createReverseMappings() {
    const reverse = {};
    Object.entries(this.termMappings).forEach(([es, de]) => {
      if (!reverse[de]) {
        reverse[de] = es;
      }
    });
    return reverse;
  }

  /**
   * Traduce texto usando DeepL API
   */
  async translateWithDeepL(text, from = 'ES', to = 'DE') {
    if (!this.deeplApiKey) {
      throw new Error('DeepL API key no configurada');
    }

    try {
      const url = this.deeplApiKey.includes('free') ? this.deeplFreeUrl : this.deeplBaseUrl;

      const response = await axios.post(`${url}/translate`, null, {
        params: {
          auth_key: this.deeplApiKey,
          text: text,
          source_lang: from.toUpperCase(),
          target_lang: to.toUpperCase()
        },
        timeout: 10000
      });

      const translatedText = response.data.translations[0]?.text;
      if (!translatedText) {
        throw new Error('Respuesta de DeepL inválida');
      }

      logger.translation(`DeepL translation: "${text}" → "${translatedText}"`, {
        from,
        to,
        originalText: text,
        translatedText
      });

      return translatedText;

    } catch (error) {
      logger.error('Error en traducción DeepL:', {
        error: error.message,
        text,
        from,
        to
      });
      throw new Error(`Error de traducción: ${error.message}`);
    }
  }

  /**
   * Aplica mapeo de términos específicos antes de la traducción automática
   */
  applyTermMapping(text, from = 'es', to = 'de') {
    if (!text) return text;

    let processedText = text.toLowerCase();
    const mappings = from === 'es' && to === 'de' ? this.termMappings :
      from === 'de' && to === 'es' ? this.reverseMappings : {};

    // Reemplazar términos conocidos
    Object.entries(mappings).forEach(([original, translation]) => {
      // Usar word boundaries para reemplazos precisos
      const regex = new RegExp(`\\b${original}\\b`, 'gi');
      processedText = processedText.replace(regex, translation);
    });

    // Capitalizar primera letra si el original la tenía
    if (text.charAt(0) === text.charAt(0).toUpperCase()) {
      processedText = processedText.charAt(0).toUpperCase() + processedText.slice(1);
    }

    return processedText;
  }

  /**
   * Traducción completa con mapeo + DeepL
   */
  async translate(text, from = 'es', to = 'de') {
    const startTime = Date.now();

    try {
      if (!text || text.trim().length === 0) {
        return text;
      }

      // Paso 1: Aplicar mapeo de términos específicos
      let translatedText = this.applyTermMapping(text, from, to);

      // Paso 2: Si hay API key, usar DeepL para el resto
      if (this.deeplApiKey && translatedText === text.toLowerCase()) {
        // Solo usar DeepL si no se aplicó ningún mapeo
        translatedText = await this.translateWithDeepL(text, from, to);
      }

      const duration = Date.now() - startTime;
      logger.translation(`Translation completed: "${text}" → "${translatedText}"`, {
        from,
        to,
        originalText: text,
        translatedText,
        durationMs: duration,
        method: this.deeplApiKey ? 'deepl+mapping' : 'mapping-only'
      });

      return translatedText;

    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Translation failed:', {
        error: error.message,
        text,
        from,
        to,
        durationMs: duration
      });

      // Fallback: devolver el texto original con mapeo básico
      return this.applyTermMapping(text, from, to);
    }
  }

  /**
   * Traduce consultas de búsqueda inmobiliarias
   */
  async translateSearchQuery(query, from = 'es', to = 'de') {
    if (!query) return query;

    // Dividir en partes significativas
    const parts = query.split(/[\s,]+/).filter(part => part.length > 0);

    const translatedParts = await Promise.all(
      parts.map(async (part) => {
        try {
          return await this.translate(part, from, to);
        } catch (error) {
          logger.warn(`Failed to translate part "${part}", using original`, {
            part,
            error: error.message
          });
          return part;
        }
      })
    );

    return translatedParts.join(' ');
  }

  /**
   * Valida si un texto parece estar en español o alemán
   */
  detectLanguage(text) {
    if (!text) return 'unknown';

    const spanishWords = ['el', 'la', 'los', 'las', 'un', 'una', 'y', 'o', 'pero', 'que', 'de', 'en', 'con', 'por', 'para', 'alquiler', 'apartamento', 'casa'];
    const germanWords = ['der', 'die', 'das', 'und', 'oder', 'aber', 'dass', 'von', 'in', 'mit', 'für', 'miete', 'wohnung', 'haus'];

    const words = text.toLowerCase().split(/\s+/);
    let spanishScore = 0;
    let germanScore = 0;

    words.forEach(word => {
      if (spanishWords.includes(word)) spanishScore++;
      if (germanWords.includes(word)) germanScore++;
    });

    if (spanishScore > germanScore) return 'es';
    if (germanScore > spanishScore) return 'de';
    return 'unknown';
  }

  /**
   * Obtiene estadísticas del servicio de traducción
   */
  getStats() {
    return {
      deeplConfigured: !!this.deeplApiKey,
      termMappingsCount: Object.keys(this.termMappings).length,
      reverseMappingsCount: Object.keys(this.reverseMappings).length
    };
  }

  /**
   * Prueba la conectividad con DeepL API
   */
  async testConnection() {
    if (!this.deeplApiKey) {
      return { success: false, error: 'DeepL API key no configurada' };
    }

    try {
      await this.translateWithDeepL('test', 'EN', 'ES');
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

module.exports = new TranslationService();
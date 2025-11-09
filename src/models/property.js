/**
 * Modelo de datos estandarizado para propiedades inmobiliarias
 * DTO (Data Transfer Object) que normaliza datos de diferentes portales
 */

class Property {
  constructor(data = {}) {
    // Campos obligatorios según especificaciones
    this.id = data.id || null; // ID único generado
    this.source = data.source || null; // Portal origen (wg-gesucht, is24, etc.)
    this.externalId = data.externalId || null; // ID del portal origen
    this.url = data.url || null; // URL original del anuncio
    this.title = data.title || null; // Título del anuncio
    this.price = data.price || null; // Precio (con moneda)
    this.squareMeters = data.squareMeters || null; // Metros cuadrados
    this.mainImage = data.mainImage || null; // URL de imagen principal
    this.location = data.location || null; // Localidad/ciudad
    this.propertyType = data.propertyType || null; // Tipo de inmueble
    this.publishedDate = data.publishedDate || null; // Fecha de publicación

    // Campos opcionales
    this.description = data.description || null;
    this.rooms = data.rooms || null;
    this.floor = data.floor || null;
    this.totalFloors = data.totalFloors || null;
    this.constructionYear = data.constructionYear || null;
    this.energyEfficiency = data.energyEfficiency || null;
    this.heatingType = data.heatingType || null;
    this.parking = data.parking || null;
    this.balcony = data.balcony || null;
    this.garden = data.garden || null;
    this.elevator = data.elevator || null;
    this.furnished = data.furnished || null;

    // Metadatos internos
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
    this.normalizedAt = data.normalizedAt || new Date().toISOString();
    this.normalizationVersion = data.normalizationVersion || '1.0';
  }

  /**
   * Valida que el objeto Property tenga todos los campos obligatorios
   */
  isValid() {
    const requiredFields = [
      'id', 'source', 'externalId', 'url', 'title',
      'price', 'squareMeters', 'mainImage', 'location', 'propertyType'
    ];

    return requiredFields.every(field => {
      const value = this[field];
      return value !== null && value !== undefined && value !== '';
    });
  }

  /**
   * Convierte el objeto a formato JSON para API responses
   */
  toJSON() {
    return {
      id: this.id,
      source: this.source,
      externalId: this.externalId,
      url: this.url,
      title: this.title,
      price: this.price,
      squareMeters: this.squareMeters,
      mainImage: this.mainImage,
      location: this.location,
      propertyType: this.propertyType,
      publishedDate: this.publishedDate,
      description: this.description,
      rooms: this.rooms,
      floor: this.floor,
      totalFloors: this.totalFloors,
      constructionYear: this.constructionYear,
      energyEfficiency: this.energyEfficiency,
      heatingType: this.heatingType,
      features: {
        parking: this.parking,
        balcony: this.balcony,
        garden: this.garden,
        elevator: this.elevator,
        furnished: this.furnished
      },
      metadata: {
        createdAt: this.createdAt,
        updatedAt: this.updatedAt,
        normalizedAt: this.normalizedAt,
        normalizationVersion: this.normalizationVersion
      }
    };
  }

  /**
   * Convierte el objeto a formato para base de datos
   */
  toDatabase() {
    return {
      id: this.id,
      source: this.source,
      external_id: this.externalId,
      url: this.url,
      title: this.title,
      price: this.price,
      square_meters: this.squareMeters,
      main_image: this.mainImage,
      location: this.location,
      property_type: this.propertyType,
      published_date: this.publishedDate,
      description: this.description,
      rooms: this.rooms,
      floor: this.floor,
      total_floors: this.totalFloors,
      construction_year: this.constructionYear,
      energy_efficiency: this.energyEfficiency,
      heating_type: this.heatingType,
      parking: this.parking,
      balcony: this.balcony,
      garden: this.garden,
      elevator: this.elevator,
      furnished: this.furnished,
      created_at: this.createdAt,
      updated_at: this.updatedAt,
      normalized_at: this.normalizedAt,
      normalization_version: this.normalizationVersion
    };
  }

  /**
   * Crea una instancia Property desde datos de base de datos
   */
  static fromDatabase(dbRow) {
    return new Property({
      id: dbRow.id,
      source: dbRow.source,
      externalId: dbRow.external_id,
      url: dbRow.url,
      title: dbRow.title,
      price: dbRow.price,
      squareMeters: dbRow.square_meters,
      mainImage: dbRow.main_image,
      location: dbRow.location,
      propertyType: dbRow.property_type,
      publishedDate: dbRow.published_date,
      description: dbRow.description,
      rooms: dbRow.rooms,
      floor: dbRow.floor,
      totalFloors: dbRow.total_floors,
      constructionYear: dbRow.construction_year,
      energyEfficiency: dbRow.energy_efficiency,
      heatingType: dbRow.heating_type,
      parking: dbRow.parking,
      balcony: dbRow.balcony,
      garden: dbRow.garden,
      elevator: dbRow.elevator,
      furnished: dbRow.furnished,
      createdAt: dbRow.created_at,
      updatedAt: dbRow.updated_at,
      normalizedAt: dbRow.normalized_at,
      normalizationVersion: dbRow.normalization_version
    });
  }

  /**
   * Normaliza tipos de propiedad a valores estándar
   */
  static normalizePropertyType(type) {
    if (!type) return null;

    const typeMap = {
      // Apartamentos
      'apartment': 'apartment',
      'wohnung': 'apartment',
      'flat': 'apartment',
      'appartement': 'apartment',

      // Habitaciones
      'room': 'room',
      'zimmer': 'room',
      'wg-zimmer': 'room',
      'shared-room': 'room',

      // Casas
      'house': 'house',
      'haus': 'house',
      'villa': 'house',
      'cottage': 'house',

      // Estudios
      'studio': 'studio',
      '1-zimmer': 'studio',
      'ein-zimmer': 'studio'
    };

    return typeMap[type.toLowerCase()] || type.toLowerCase();
  }

  /**
   * Normaliza precios a formato estándar
   */
  static normalizePrice(price) {
    if (!price) return null;

    // Extraer números y convertir a formato estándar
    const match = price.toString().match(/(\d+(?:[.,]\d+)?)/);
    if (match) {
      const numericPrice = parseFloat(match[1].replace(',', '.'));
      return `${numericPrice} €`;
    }

    return price;
  }

  /**
   * Normaliza áreas a formato estándar
   */
  static normalizeArea(area) {
    if (!area) return null;

    // Extraer números
    const match = area.toString().match(/(\d+(?:[.,]\d+)?)/);
    if (match) {
      return parseFloat(match[1].replace(',', '.'));
    }

    return null;
  }
}

module.exports = Property;
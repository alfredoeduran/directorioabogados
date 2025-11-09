// Elementos del DOM
const searchForm = document.getElementById('searchForm');
const searchButton = document.getElementById('searchButton');
const loading = document.getElementById('loading');
const errorMessage = document.getElementById('errorMessage');
const resultsSection = document.getElementById('resultsSection');
const resultsCount = document.getElementById('resultsCount');
const cacheBadge = document.getElementById('cacheBadge');
const propertiesGrid = document.getElementById('propertiesGrid');
const noResults = document.getElementById('noResults');

// Estado de la aplicación
let currentSearch = null;

// Inicialización
document.addEventListener('DOMContentLoaded', function() {
  console.log('🚀 Hispaleman cargado correctamente');
    
  // Cargar datos de ejemplo al inicio
  loadExampleData();
    
  // Event listeners
  searchForm.addEventListener('submit', handleSearch);
    
  // Auto-completado básico para ciudades
  setupCityAutocomplete();
});

// Manejar envío del formulario
async function handleSearch(event) {
  event.preventDefault();
    
  const formData = new FormData(searchForm);
  const searchParams = {
    city: formData.get('city')?.trim() || '',
    type: formData.get('type') || '',
    rooms: formData.get('rooms') || '',
    budget: formData.get('budget') || ''
  };
    
  // Validación básica
  if (!searchParams.city && !searchParams.type && !searchParams.rooms && !searchParams.budget) {
    showError('Por favor, ingresa al menos un criterio de búsqueda');
    return;
  }
    
  currentSearch = searchParams;
  await performSearch(searchParams);
}

// Variables globales
let currentPage = 1;
let currentQuery = {};

// Realizar búsqueda
async function performSearch(params, page = 1) {
  try {
    showLoading(true);
    hideError();
    hideResults();
        
    // Actualizar variables globales
    currentPage = page;
    currentQuery = params;
        
    // Construir URL de búsqueda
    const searchUrl = new URL('/api/search', window.location.origin);
    Object.keys(params).forEach(key => {
      if (params[key]) {
        searchUrl.searchParams.append(key, params[key]);
      }
    });
        
    // Agregar parámetros de paginación
    searchUrl.searchParams.append('page', page.toString());
    searchUrl.searchParams.append('limit', '6');
        
    console.log('🔍 Buscando:', searchUrl.toString());
        
    const response = await fetch(searchUrl);
    const data = await response.json();
        
    if (!response.ok) {
      throw new Error(data.error || 'Error en la búsqueda');
    }
        
    if (data.success) {
      displayResults(data);
    } else {
      throw new Error(data.error || 'Error desconocido');
    }
        
  } catch (error) {
    console.error('❌ Error en búsqueda:', error);
    showError(`Error: ${error.message}`);
  } finally {
    showLoading(false);
  }
}

// Mostrar resultados
function displayResults(data) {
  const { results, total, cached, source, pagination } = data;
    
  if (results.length === 0) {
    showNoResults();
    return;
  }
    
  // Actualizar contador con información de paginación
  if (pagination) {
    resultsCount.textContent = `Mostrando ${results.length} de ${pagination.totalResults} propiedades (Página ${pagination.currentPage} de ${pagination.totalPages})`;
  } else {
    resultsCount.textContent = `${total} propiedad${total !== 1 ? 'es' : ''} encontrada${total !== 1 ? 's' : ''}`;
  }
    
  // Actualizar badge de cache
  if (cached) {
    cacheBadge.textContent = '📦 Desde cache';
    cacheBadge.className = 'cache-badge cached';
  } else {
    cacheBadge.textContent = '🆕 Nuevos resultados';
    cacheBadge.className = 'cache-badge';
  }
    
  // Limpiar grid anterior
  propertiesGrid.innerHTML = '';
    
  // Crear tarjetas de propiedades
  results.forEach(property => {
    const card = createPropertyCard(property);
    propertiesGrid.appendChild(card);
  });
    
  // Agregar paginación si existe
  if (pagination && pagination.totalPages > 1) {
    const paginationElement = createPaginationElement(pagination);
    propertiesGrid.appendChild(paginationElement);
  }
    
  // Mostrar sección de resultados
  showResults();
    
  // Scroll suave a resultados
  resultsSection.scrollIntoView({ 
    behavior: 'smooth', 
    block: 'start' 
  });
}

// Función para ver detalles de propiedad - redirige al sitio original
async function viewPropertyDetail(propertyId) {
  try {
    // Obtener los datos de la propiedad para conseguir la URL original
    const response = await fetch(`/api/property/${propertyId}`);
    const data = await response.json();
        
    if (data.success && data.property && data.property.url) {
      // Redirigir directamente al sitio web original
      window.open(data.property.url, '_blank');
    } else {
      console.error('No se pudo obtener la URL de la propiedad');
      alert('Error: No se pudo acceder a los detalles de la propiedad');
    }
  } catch (error) {
    console.error('Error al obtener detalles de la propiedad:', error);
    alert('Error: No se pudo acceder a los detalles de la propiedad');
  }
}

// Función para obtener fuente de imagen
function getImageSource(imageUrl) {
  if (!imageUrl) return 'Sin imagen';
  if (imageUrl.includes('wg-gesucht')) return 'WG-Gesucht';
  if (imageUrl.includes('kleinanzeigen')) return 'Kleinanzeigen';
  return 'Externa';
}

// Crear elemento de paginación
function createPaginationElement(pagination) {
  const paginationDiv = document.createElement('div');
  paginationDiv.className = 'pagination';
    
  let paginationHTML = '';
    
  // Botón anterior
  if (pagination.hasPrevPage) {
    paginationHTML += `<button class="pagination-btn" onclick="performSearch(currentQuery, ${pagination.currentPage - 1})">« Anterior</button>`;
  }
    
  // Números de página
  const startPage = Math.max(1, pagination.currentPage - 2);
  const endPage = Math.min(pagination.totalPages, pagination.currentPage + 2);
    
  if (startPage > 1) {
    paginationHTML += '<button class="pagination-btn" onclick="performSearch(currentQuery, 1)">1</button>';
    if (startPage > 2) {
      paginationHTML += '<span class="pagination-dots">...</span>';
    }
  }
    
  for (let i = startPage; i <= endPage; i++) {
    const isActive = i === pagination.currentPage ? 'active' : '';
    paginationHTML += `<button class="pagination-btn ${isActive}" onclick="performSearch(currentQuery, ${i})">${i}</button>`;
  }
    
  if (endPage < pagination.totalPages) {
    if (endPage < pagination.totalPages - 1) {
      paginationHTML += '<span class="pagination-dots">...</span>';
    }
    paginationHTML += `<button class="pagination-btn" onclick="performSearch(currentQuery, ${pagination.totalPages})">${pagination.totalPages}</button>`;
  }
    
  // Botón siguiente
  if (pagination.hasNextPage) {
    paginationHTML += `<button class="pagination-btn" onclick="performSearch(currentQuery, ${pagination.currentPage + 1})">Siguiente »</button>`;
  }
    
  paginationDiv.innerHTML = paginationHTML;
  return paginationDiv;
}

// Crear tarjeta de propiedad
function createPropertyCard(property) {
  const card = document.createElement('div');
  card.className = 'property-card';
    
  // Determinar clase y nombre de fuente
  let sourceClass = 'source-other';
  let sourceName = 'Desconocido';
    
  switch(property.source) {
  case 'wg-gesucht':
    sourceClass = 'source-wg';
    sourceName = 'WG-Gesucht';
    break;
  case 'kleinanzeigen':
    sourceClass = 'source-kleinanzeigen';
    sourceName = 'Kleinanzeigen';
    break;
  case 'immobilienscout24':
    sourceClass = 'source-is24';
    sourceName = 'ImmobilienScout24';
    break;
  case 'immowelt':
    sourceClass = 'source-immowelt';
    sourceName = 'Immowelt';
    break;
  case 'immonet':
    sourceClass = 'source-immonet';
    sourceName = 'Immonet';
    break;
  default:
    sourceName = property.source || 'Desconocido';
  }
    
  // Formatear habitaciones
  const roomsText = property.rooms ? `${property.rooms} hab.` : 'N/A';
    
  card.innerHTML = `
        <img 
            src="${property.image || 'https://via.placeholder.com/350x200?text=Sin+Imagen'}" 
            alt="${property.title}"
            class="property-image"
            onerror="this.src='https://via.placeholder.com/350x200?text=Sin+Imagen'"
        >
        <div class="property-content">
            <h3 class="property-title">${escapeHtml(property.title)}</h3>
            <div class="property-location">
                📍 ${escapeHtml(property.location || 'Ubicación no especificada')}
            </div>
            <div class="property-details">
                <div class="property-price">${escapeHtml(property.price || 'Precio no disponible')}</div>
                <div class="property-rooms">${roomsText}</div>
            </div>
            <div class="property-source ${sourceClass}">
                ${sourceName}
            </div>
        </div>
    `;
    
  // Hacer clic para abrir enlace
  card.addEventListener('click', () => {
    if (property.url) {
      window.open(property.url, '_blank', 'noopener,noreferrer');
    }
  });
    
  return card;
}

// Funciones de UI
function showLoading(show) {
  loading.style.display = show ? 'block' : 'none';
  searchButton.disabled = show;
  searchButton.textContent = show ? '🔄 Buscando...' : '🔍 Buscar Vivienda';
}

function showError(message) {
  errorMessage.textContent = message;
  errorMessage.style.display = 'block';
}

function hideError() {
  errorMessage.style.display = 'none';
}

function showResults() {
  resultsSection.style.display = 'block';
  noResults.style.display = 'none';
}

function hideResults() {
  resultsSection.style.display = 'none';
  noResults.style.display = 'none';
}

function showNoResults() {
  resultsSection.style.display = 'none';
  noResults.style.display = 'block';
}

// Cargar datos de ejemplo al inicio
async function loadExampleData() {
  try {
    const response = await fetch('/api/stats');
    const data = await response.json();
        
    if (data.success) {
      console.log('📊 Estadísticas cargadas:', data.stats);
    }
  } catch (error) {
    console.warn('⚠️ No se pudieron cargar las estadísticas:', error.message);
  }
}

// Auto-completado básico para ciudades
function setupCityAutocomplete() {
  const cityInput = document.getElementById('city');
  const commonCities = [
    'Berlin', 'München', 'Hamburg', 'Köln', 'Frankfurt am Main',
    'Stuttgart', 'Düsseldorf', 'Dortmund', 'Essen', 'Leipzig',
    'Bremen', 'Dresden', 'Hannover', 'Nürnberg', 'Duisburg'
  ];
    
  cityInput.addEventListener('input', function() {
    const value = this.value.toLowerCase();
        
    // Remover lista anterior si existe
    const existingList = document.getElementById('cityList');
    if (existingList) {
      existingList.remove();
    }
        
    if (value.length < 2) return;
        
    // Filtrar ciudades
    const matches = commonCities.filter(city => 
      city.toLowerCase().includes(value)
    ).slice(0, 5);
        
    if (matches.length === 0) return;
        
    // Crear lista de sugerencias
    const datalist = document.createElement('datalist');
    datalist.id = 'cityList';
        
    matches.forEach(city => {
      const option = document.createElement('option');
      option.value = city;
      datalist.appendChild(option);
    });
        
    cityInput.setAttribute('list', 'cityList');
    cityInput.parentNode.appendChild(datalist);
  });
}

// Utilidad para escapar HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Manejar errores globales
window.addEventListener('error', function(event) {
  console.error('❌ Error global:', event.error);
});

// Manejar errores de fetch
window.addEventListener('unhandledrejection', function(event) {
  console.error('❌ Promise rechazada:', event.reason);
});

// Exportar funciones para testing (si es necesario)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    performSearch,
    createPropertyCard,
    escapeHtml
  };
}
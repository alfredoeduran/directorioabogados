// Variables globales
let allLawyers = [];
let filteredLawyers = [];

// Configuración de la API
const API_BASE_URL = window.location.origin.includes('localhost') 
    ? 'http://localhost:3000' 
    : window.location.origin;

// Función para cargar los datos de abogados
async function loadLawyers() {
    const resultsEl = document.getElementById('results');
    const statsEl = document.getElementById('stats');
    
    try {
        resultsEl.innerHTML = '<p class="loading">Cargando abogados...</p>';
        
        // Intentar cargar desde el archivo JSON convertido primero
        let data;
        try {
            const response = await fetch('./abogados-completos.json');
            if (response.ok) {
                data = await response.json();
                allLawyers = data;
                console.log('Datos cargados desde abogados-completos.json:', allLawyers.length, 'abogados');
            } else {
                throw new Error('No se pudo cargar el archivo convertido');
            }
        } catch (error) {
            // Si falla el archivo convertido, intentar desde el archivo original
            console.log('Intentando cargar desde archivo original...');
            try {
                const response = await fetch('../hispaleman-express/public/data/abogados.json');
                if (response.ok) {
                    data = await response.json();
                    allLawyers = data.lawyers || data;
                } else {
                    throw new Error('No se pudo cargar el archivo local');
                }
            } catch (error2) {
                // Si falla local, intentar desde la API
                console.log('Intentando cargar desde API...');
                const response = await fetch(`${API_BASE_URL}/api/abogados`);
                if (!response.ok) {
                    throw new Error('Error al cargar datos de abogados');
                }
                data = await response.json();
                allLawyers = data;
            }
        }
        
        // Si los datos tienen la estructura del JSON, extraer los abogados
        if (data && data.lawyers) {
            allLawyers = data.lawyers;
        } else if (Array.isArray(data)) {
            allLawyers = data;
        } else if (data && data.data) {
            allLawyers = data.data;
        } else {
            allLawyers = [];
        }
        
        // Asegurar que allLawyers sea un array válido
        if (!Array.isArray(allLawyers)) {
            allLawyers = [];
        }
        
        // Filtrar abogados válidos (con nombre)
        allLawyers = allLawyers.filter(lawyer => 
            lawyer && (lawyer.nameAddress || lawyer.name || lawyer.nombre || (lawyer.nombre && lawyer.nombre.trim() !== ''))
        );
        
        filteredLawyers = [...allLawyers];
        
        // Cargar especialidades en el filtro
        loadSpecialties();
        
        // Mostrar estadísticas
        updateStats();
        
        // Mostrar abogados
        displayLawyers();
        
    } catch (error) {
        console.error('Error:', error);
        resultsEl.innerHTML = '<p class="error">Error al cargar los datos. Por favor, intenta más tarde.</p>';
        
        // Intentar cargar datos de muestra
        loadSampleData();
    }
}

// Función para cargar datos de muestra si no se puede acceder a los reales
function loadSampleData() {
    allLawyers = [
        {
            nameAddress: "Juan García López - C/ Mayor 123, 28001 Madrid",
            specialty: "Derecho civil y familiar",
            contact: "Tel.: 91 123 4567",
            website: "www.juangarcia.es",
            postalCode: "28001"
        },
        {
            nameAddress: "María González Pérez - Av. Constitución 45, 41001 Sevilla",
            specialty: "Derecho mercantil y laboral",
            contact: "Tel.: 95 456 7890",
            website: "www.mariagonzalez.es",
            postalCode: "41001"
        }
    ];
    
    filteredLawyers = [...allLawyers];
    loadSpecialties();
    updateStats();
    displayLawyers();
}

// Función para cargar especialidades en el filtro
function loadSpecialties() {
    const specialtySelect = document.getElementById('specialtySelect');
    const specialties = new Set();
    
    // Asegurar que allLawyers sea un array válido
    if (!Array.isArray(allLawyers)) {
        allLawyers = [];
    }
    
    allLawyers.forEach(lawyer => {
        // Nuevo formato: especialidades es un array
        if (lawyer.especialidades && Array.isArray(lawyer.especialidades)) {
            lawyer.especialidades.forEach(esp => {
                if (esp && esp.trim() !== '') {
                    specialties.add(esp.trim());
                }
            });
        } 
        // Formato antiguo: specialty es un string
        else if (lawyer.specialty) {
            // Extraer la primera línea de la especialidad
            const firstLine = lawyer.specialty.split('.')[0].split(',')[0].trim();
            if (firstLine && firstLine.length > 5) {
                specialties.add(firstLine);
            }
        }
    });
    
    // Limpiar opciones existentes (mantener la primera)
    specialtySelect.innerHTML = '<option value="">Todas las especialidades</option>';
    
    // Agregar especialidades ordenadas
    Array.from(specialties).sort().forEach(specialty => {
        const option = document.createElement('option');
        option.value = specialty;
        option.textContent = specialty;
        specialtySelect.appendChild(option);
    });
}

// Función para actualizar estadísticas
function updateStats() {
    const statsEl = document.getElementById('stats');
    statsEl.innerHTML = `<p>Total de abogados: <strong>${filteredLawyers.length}</strong></p>`;
}

// Función para mostrar abogados
function displayLawyers() {
    const resultsEl = document.getElementById('results');
    resultsEl.innerHTML = '';
    
    if (filteredLawyers.length === 0) {
        resultsEl.innerHTML = '<p class="no-results">No se encontraron abogados.</p>';
        return;
    }
    
    filteredLawyers.forEach(lawyer => {
        const lawyerCard = createLawyerCard(lawyer);
        resultsEl.appendChild(lawyerCard);
    });
}

// Función para crear tarjeta de abogado
function createLawyerCard(lawyer) {
    const card = document.createElement('article');
    card.className = 'lawyer-card';
    
    // Nuevo formato: usar nombre directo
    const name = lawyer.nombre || extractName(lawyer.nameAddress || lawyer.name || '');
    
    // Construir dirección completa del nuevo formato
    let fullAddress = '';
    if (lawyer.direccion) {
        const parts = [];
        if (lawyer.direccion.calle) parts.push(lawyer.direccion.calle);
        if (lawyer.direccion.codigoPostal) parts.push(lawyer.direccion.codigoPostal);
        if (lawyer.direccion.localidad) parts.push(lawyer.direccion.localidad);
        fullAddress = parts.join(', ');
    }
    
    // Obtener especialidades del nuevo formato o especialidad antigua
    let specialtiesDisplay = '';
    if (lawyer.especialidades && Array.isArray(lawyer.especialidades) && lawyer.especialidades.length > 0) {
        specialtiesDisplay = lawyer.especialidades.join(', ');
    } else if (lawyer.specialty) {
        specialtiesDisplay = getMainSpecialty(lawyer.specialty);
    }
    
    // Construir información de contacto del nuevo formato
    let contactInfo = '';
    if (lawyer.contacto) {
        const contactParts = [];
        if (lawyer.contacto.telefono) contactParts.push(`Tel: ${lawyer.contacto.telefono}`);
        if (lawyer.contacto.email) contactParts.push(`Email: ${lawyer.contacto.email}`);
        if (lawyer.contacto.web) contactParts.push(`Web: ${lawyer.contacto.web}`);
        contactInfo = contactParts.join(' | ');
    }
    
    // Crear contenido de la tarjeta
    card.innerHTML = `
        <h3 class="lawyer-name">${name}</h3>
        ${specialtiesDisplay ? `<p class="lawyer-specialty">${specialtiesDisplay}</p>` : ''}
        ${fullAddress ? `<p class="lawyer-address">${fullAddress}</p>` : ''}
        ${contactInfo ? `<p class="lawyer-contact">${contactInfo}</p>` : ''}
        ${lawyer.comentario ? `<p class="lawyer-notes">${lawyer.comentario}</p>` : ''}
        ${lawyer.postalCode ? `<p class="lawyer-postal">${lawyer.postalCode}</p>` : ''}
    `;
    
    return card;
}

// Función para extraer el nombre del campo nameAddress
function extractName(nameAddress) {
    if (!nameAddress) return 'Nombre no disponible';
    
    // Buscar patrones comunes de nombres
    const patterns = [
        /^([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)*)/, // Nombre simple
        /^([^-,–]+)/, // Todo antes de la primera coma o guión
        /^([^\d]+)/ // Todo antes del primer número
    ];
    
    for (const pattern of patterns) {
        const match = nameAddress.match(pattern);
        if (match && match[1].trim().length > 3) {
            return match[1].trim();
        }
    }
    
    return nameAddress.split(',')[0].split('-')[0].trim() || 'Nombre no disponible';
}

// Función para obtener especialidad principal
function getMainSpecialty(specialty) {
    if (!specialty) return '';
    
    // Tomar la primera oración o línea
    const firstSentence = specialty.split(/[.!]/)[0].trim();
    
    // Limitar longitud
    if (firstSentence.length > 100) {
        return firstSentence.substring(0, 100) + '...';
    }
    
    return firstSentence;
}

// Función para filtrar abogados con el formulario
function filterLawyers() {
    const locality = document.getElementById('locality').value.toLowerCase();
    const postal = document.getElementById('postal').value.toLowerCase();
    const specialty = document.getElementById('specialtySelect').value;
    const hasWebsite = document.getElementById('hasWebsite').checked;
    
    // Asegurar que allLawyers sea un array válido
    if (!Array.isArray(allLawyers)) {
        allLawyers = [];
    }
    
    filteredLawyers = allLawyers.filter(lawyer => {
        // Verificar localidad
        if (locality) {
            const address = (lawyer.direccion?.localidad || lawyer.direccion?.calle || lawyer.nameAddress || '').toLowerCase();
            if (!address.includes(locality)) return false;
        }
        
        // Verificar código postal
        if (postal) {
            const postalCode = (lawyer.direccion?.codigoPostal || lawyer.postalCode || '').toLowerCase();
            if (!postalCode.includes(postal)) return false;
        }
        
        // Verificar especialidad
        if (specialty) {
            let hasSpecialty = false;
            if (lawyer.especialidades && Array.isArray(lawyer.especialidades)) {
                hasSpecialty = lawyer.especialidades.some(esp => esp.toLowerCase().includes(specialty.toLowerCase()));
            } else if (lawyer.specialty) {
                hasSpecialty = lawyer.specialty.toLowerCase().includes(specialty.toLowerCase());
            }
            if (!hasSpecialty) return false;
        }
        
        // Verificar que tenga web
        if (hasWebsite) {
            const hasWeb = lawyer.contacto?.web || lawyer.website || false;
            if (!hasWeb) return false;
        }
        
        return true;
    });
    
    updateStats();
    displayLawyers();
}

// Función para búsqueda por IA
function searchByAI() {
    const query = document.getElementById('aiQuery').value.toLowerCase().trim();
    
    if (!query) {
        filteredLawyers = [...allLawyers];
        updateStats();
        displayLawyers();
        return;
    }
    
    // Asegurar que allLawyers sea un array válido
    if (!Array.isArray(allLawyers)) {
        allLawyers = [];
    }
    
    filteredLawyers = allLawyers.filter(lawyer => {
        const name = (lawyer.nombre || lawyer.nameAddress || lawyer.name || '').toLowerCase();
        const specialty = (lawyer.specialty || lawyer.especialidades?.join(' ') || '').toLowerCase();
        const address = (lawyer.direccion?.calle || lawyer.direccion?.localidad || lawyer.nameAddress || '').toLowerCase();
        const notes = (lawyer.comentario || '').toLowerCase();
        
        return name.includes(query) || 
               specialty.includes(query) || 
               address.includes(query) || 
               notes.includes(query);
    });
    
    updateStats();
    displayLawyers();
}

// Función para reiniciar formulario
function resetForm() {
    document.getElementById('locality').value = '';
    document.getElementById('postal').value = '';
    document.getElementById('specialtySelect').value = '';
    document.getElementById('hasWebsite').checked = false;
    document.getElementById('aiQuery').value = '';
    
    filteredLawyers = [...allLawyers];
    updateStats();
    displayLawyers();
}

// Función para cambiar entre pestañas
function switchTab(tabName) {
    // Actualizar pestañas activas
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    
    // Mostrar/ocultar paneles
    document.querySelectorAll('.search-panel').forEach(panel => {
        panel.hidden = true;
    });
    document.getElementById(`tab-${tabName}`).hidden = false;
}

// Event listeners
document.addEventListener('DOMContentLoaded', function() {
    loadLawyers();
    
    // Pestañas
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => switchTab(tab.dataset.tab));
    });
    
    // Formulario
    document.getElementById('locality').addEventListener('input', filterLawyers);
    document.getElementById('postal').addEventListener('input', filterLawyers);
    document.getElementById('specialtySelect').addEventListener('change', filterLawyers);
    document.getElementById('hasWebsite').addEventListener('change', filterLawyers);
    document.getElementById('resetForm').addEventListener('click', resetForm);
    
    // Búsqueda por IA
    document.getElementById('aiQuery').addEventListener('input', searchByAI);
});

// Manejo de errores de CORS
window.addEventListener('error', function(e) {
    if (e.message.includes('CORS') || e.message.includes('cross-origin')) {
        console.log('Error de CORS detectado, usando datos de muestra');
        loadSampleData();
    }
});
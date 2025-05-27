// ============ PWA FUNCTIONALITY ============

// Variables para PWA
let deferredPrompt;
let isAppInstalled = false;

// Registrar Service Worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
        try {
            const registration = await navigator.serviceWorker.register('./sw.js');
            console.log('✅ Service Worker registrado:', registration);
            updateSWStatus('Service Worker activo');
            
            // Escuchar actualizaciones
            registration.addEventListener('updatefound', () => {
                const newWorker = registration.installing;
                newWorker.addEventListener('statechange', () => {
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        showUpdateButton();
                    }
                });
            });
            
        } catch (error) {
            console.error('❌ Error al registrar Service Worker:', error);
            updateSWStatus('Service Worker no disponible');
        }
    });
}

// Eventos PWA
window.addEventListener('beforeinstallprompt', (e) => {
    console.log('🎉 PWA: Evento de instalación detectado');
    e.preventDefault();
    deferredPrompt = e;
    showInstallBanner();
});

window.addEventListener('appinstalled', () => {
    console.log('✅ PWA: Aplicación instalada');
    isAppInstalled = true;
    hideInstallBanner();
});

// Funciones PWA
function showInstallBanner() {
    const banner = document.getElementById('installBanner');
    if (banner && !isAppInstalled) {
        banner.style.display = 'block';
        
        // Configurar botones solo una vez
        const installBtn = document.getElementById('installBtn');
        const dismissBtn = document.getElementById('dismissBtn');
        
        // Remover listeners anteriores
        installBtn.replaceWith(installBtn.cloneNode(true));
        dismissBtn.replaceWith(dismissBtn.cloneNode(true));
        
        // Agregar nuevos listeners
        document.getElementById('installBtn').addEventListener('click', async () => {
            if (deferredPrompt) {
                deferredPrompt.prompt();
                const { outcome } = await deferredPrompt.userChoice;
                console.log('Resultado de instalación:', outcome);
                deferredPrompt = null;
                hideInstallBanner();
            }
        });
        
        document.getElementById('dismissBtn').addEventListener('click', () => {
            hideInstallBanner();
        });
    }
}

function hideInstallBanner() {
    const banner = document.getElementById('installBanner');
    if (banner) {
        banner.style.display = 'none';
    }
}

function showUpdateButton() {
    const updateBtn = document.getElementById('updateBtn');
    if (updateBtn) {
        updateBtn.style.display = 'block';
        updateBtn.addEventListener('click', () => {
            window.location.reload();
        });
    }
}

function updateSWStatus(status) {
    const swStatus = document.getElementById('swStatus');
    if (swStatus) {
        swStatus.textContent = status;
    }
}

function updateConnectionStatus() {
    const statusElement = document.getElementById('connectionStatus');
    const statusText = document.getElementById('connectionText');
    
    if (navigator.onLine) {
        if (statusElement) statusElement.style.display = 'none';
    } else {
        if (statusElement) statusElement.style.display = 'block';
        if (statusText) statusText.textContent = 'Sin conexión - Modo offline';
    }
}

// Escuchar cambios de conexión
window.addEventListener('online', updateConnectionStatus);
window.addEventListener('offline', updateConnectionStatus);

// ============ APLICACIÓN PRINCIPAL ============

// Variables globales
let allWantedData = [];
let favorites = JSON.parse(localStorage.getItem('favorites')) || [];

// Inicialización
window.addEventListener('load', () => {
    setTimeout(() => {
        document.getElementById('splashScreen').style.display = 'none';
        document.querySelector('.app-container').style.display = 'block';
        updateConnectionStatus();
        checkURLParams();
    }, 2500);
    
    loadWantedData();
});

// Deep linking
function checkURLParams() {
    const urlParams = new URLSearchParams(window.location.search);
    const tab = urlParams.get('tab');
    
    if (tab && ['home', 'wanted', 'favorites', 'search', 'register', 'about'].includes(tab)) {
        showTab(tab);
    }
}

// Navegación entre pestañas
function showTab(tabId) {
    const tabs = document.querySelectorAll('.tab-content');
    tabs.forEach(tab => {
        tab.classList.remove('active');
    });
    document.getElementById(tabId).classList.add('active');
    
    // Actualizar URL
    const newURL = new URL(window.location);
    newURL.searchParams.set('tab', tabId);
    window.history.pushState({ tab: tabId }, '', newURL);
    
    // Cargar contenido específico
    if (tabId === 'favorites') {
        renderFavorites();
    }
}

// Navegación con botones del navegador
window.addEventListener('popstate', (event) => {
    if (event.state && event.state.tab) {
        showTab(event.state.tab);
    }
});

// Cargar datos de la API
function loadWantedData() {
    const loadBtn = document.getElementById('loadDataBtn');
    if (loadBtn) {
        loadBtn.addEventListener('click', loadWantedData);
    }
    
    const apiUrl = 'https://api.fbi.gov/wanted/v1/list';
    const wantedList = document.getElementById('wantedList');
    
    if (wantedList) {
        wantedList.innerHTML = '<div class="loading"></div>';
    }
    
    const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Tiempo de espera agotado')), 10000);
    });
    
    Promise.race([fetch(apiUrl), timeoutPromise])
    .then(response => {
        if (!response.ok) {
            throw new Error(`Error HTTP: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        if (!data || !data.items || data.items.length === 0) {
            throw new Error('No se encontraron datos');
        }
        
        allWantedData = data.items;
        renderWantedList(allWantedData);
        prepareFilters();
        
        // Registrar sync si está disponible
        if ('serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype) {
            navigator.serviceWorker.ready.then(registration => {
                return registration.sync.register('background-sync');
            });
        }
    })
    .catch(error => {
        console.error('Error al obtener los datos:', error);
        loadBackupData();
        
        if (wantedList) {
            wantedList.innerHTML = `
                <div class="error-message">
                    <p>⚠️ No se pudieron cargar los datos desde la API del FBI.</p>
                    <p>Usando datos de ejemplo.</p>
                    <button onclick="loadWantedData()" class="retry-btn">🔄 Reintentar</button>
                </div>
            `;
        }
    });
}

// Datos de respaldo
function loadBackupData() {
    allWantedData = [
        {
            uid: "1",
            title: "John Doe",
            field_offices: ["Washington", "New York"],
            images: [{ original: "https://via.placeholder.com/250?text=John+Doe" }],
            reward_text: "$10,000",
            description: "Buscado por múltiples cargos de fraude bancario",
            sex: "Male",
            nationality: "American",
            publication: "2023-01-15",
            url: "https://www.fbi.gov/"
        },
        {
            uid: "2",
            title: "Jane Smith",
            field_offices: ["Los Angeles", "Miami"],
            images: [{ original: "https://via.placeholder.com/250?text=Jane+Smith" }],
            reward_text: "$5,000",
            description: "Buscada por cibercrimen y robo de identidad",
            sex: "Female",
            nationality: "Canadian",
            publication: "2023-02-20",
            url: "https://www.fbi.gov/"
        }
    ];
    
    renderWantedList(allWantedData);
    prepareFilters();
}

// Renderizar lista
function renderWantedList(dataArray) {
    const wantedList = document.getElementById('wantedList');
    if (!wantedList) return;
    
    wantedList.innerHTML = '';
    
    if (dataArray.length === 0) {
        wantedList.innerHTML = '<div class="empty-message"><p>No se encontraron personas buscadas.</p></div>';
        return;
    }
    
    dataArray.forEach(item => {
        const div = document.createElement('div');
        div.classList.add('wanted-item');

        const photoUrl = item.images && item.images[0] ? item.images[0].original : 'https://via.placeholder.com/250?text=No+Image';
        const name = item.title || 'Nombre no disponible';
        const offices = item.field_offices?.join(', ') || 'Oficinas no disponibles';
        const reward = item.reward_text || 'Sin información de recompensa';
        
        const isFavorite = favorites.some(fav => fav.id === item.uid);
        const favoriteClass = isFavorite ? 'favorite-active' : '';
        const favoriteText = isFavorite ? 'Quitar de Favoritos' : 'Añadir a Favoritos';

        div.innerHTML = `
            <img src="${photoUrl}" alt="${name}" onerror="this.src='https://via.placeholder.com/250?text=Error+Image'" loading="lazy">
            <h3>${name}</h3>
            <p><strong>Oficinas:</strong> ${offices}</p>
            <p><strong>Recompensa:</strong> ${reward}</p>
            <button class="favorite-btn ${favoriteClass}" data-id="${item.uid}">
                ${isFavorite ? '❤️' : '🤍'} ${favoriteText}
            </button>
            <button class="details-btn" data-id="${item.uid}">Ver Detalles</button>
        `;

        wantedList.appendChild(div);
        
        // Eventos
        div.querySelector('.favorite-btn').addEventListener('click', (e) => {
            toggleFavorite(item);
            e.target.classList.toggle('favorite-active');
            e.target.innerHTML = e.target.classList.contains('favorite-active') 
                ? '❤️ Quitar de Favoritos' 
                : '🤍 Añadir a Favoritos';
        });
        
        div.querySelector('.details-btn').addEventListener('click', () => {
            showPersonDetails(item);
        });
    });
}

// Filtros
function prepareFilters() {
    const filterSection = document.getElementById('filterOptions');
    if (!filterSection) return;
    
    filterSection.innerHTML = '';
    
    const allOffices = new Set();
    allWantedData.forEach(item => {
        if (item.field_offices && Array.isArray(item.field_offices)) {
            item.field_offices.forEach(office => allOffices.add(office));
        }
    });
    
    const filterHTML = `
        <h3>Filtros</h3>
        <label for="officeFilter">Oficina:</label>
        <select id="officeFilter">
            <option value="">Todas las oficinas</option>
            ${Array.from(allOffices).sort().map(office => `<option value="${office}">${office}</option>`).join('')}
        </select>
        <br>
        <label for="nameFilter">Nombre:</label>
        <input type="text" id="nameFilter" placeholder="Filtrar por nombre...">
        <br>
        <div class="filter-buttons">
            <button id="applyFilters">🔍 Aplicar Filtros</button>
            <button id="resetFilters">🔄 Reiniciar Filtros</button>
        </div>
    `;
    
    filterSection.innerHTML = filterHTML;
    
    // Eventos de filtros
    document.getElementById('applyFilters').addEventListener('click', applyFilters);
    document.getElementById('resetFilters').addEventListener('click', resetFilters);
    document.getElementById('nameFilter').addEventListener('input', debounce(applyFilters, 300));
    document.getElementById('officeFilter').addEventListener('change', applyFilters);
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function applyFilters() {
    const officeFilter = document.getElementById('officeFilter')?.value || '';
    const nameFilter = document.getElementById('nameFilter')?.value.toLowerCase() || '';
    
    let filteredData = [...allWantedData];
    
    if (officeFilter) {
        filteredData = filteredData.filter(item => 
            item.field_offices && item.field_offices.includes(officeFilter)
        );
    }
    
    if (nameFilter) {
        filteredData = filteredData.filter(item => 
            item.title && item.title.toLowerCase().includes(nameFilter)
        );
    }
    
    renderWantedList(filteredData);
    showFilterResults(filteredData.length, allWantedData.length);
}

function showFilterResults(filtered, total) {
    let resultCounter = document.getElementById('filterResults');
    if (!resultCounter) {
        resultCounter = document.createElement('p');
        resultCounter.id = 'filterResults';
        resultCounter.className = 'filter-results';
        document.getElementById('filterOptions').appendChild(resultCounter);
    }
    
    resultCounter.textContent = filtered === total 
        ? `Mostrando todos los ${total} resultados`
        : `Mostrando ${filtered} de ${total} resultados`;
}

function resetFilters() {
    const officeFilter = document.getElementById('officeFilter');
    const nameFilter = document.getElementById('nameFilter');
    
    if (officeFilter) officeFilter.value = '';
    if (nameFilter) nameFilter.value = '';
    
    renderWantedList(allWantedData);
    showFilterResults(allWantedData.length, allWantedData.length);
}

// Favoritos
function toggleFavorite(item) {
    const index = favorites.findIndex(fav => fav.id === item.uid);
    
    if (index === -1) {
        favorites.push({
            id: item.uid,
            title: item.title,
            image: item.images && item.images[0] ? item.images[0].original : 'https://via.placeholder.com/250?text=No+Image',
            offices: item.field_offices,
            reward: item.reward_text,
            dateAdded: new Date().toISOString()
        });
        showNotification(`${item.title} añadido a favoritos`);
    } else {
        favorites.splice(index, 1);
        showNotification(`${item.title} eliminado de favoritos`);
    }
    
    localStorage.setItem('favorites', JSON.stringify(favorites));
    
    if (document.getElementById('favorites').classList.contains('active')) {
        renderFavorites();
    }
}

function showNotification(message) {
    const notification = document.createElement('div');
    notification.className = 'toast-notification';
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => notification.classList.add('show'), 100);
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

function renderFavorites() {
    const favoriteList = document.getElementById('favoritesList');
    if (!favoriteList) return;
    
    favoriteList.innerHTML = '';
    
    if (favorites.length === 0) {
        favoriteList.innerHTML = '<div class="empty-message"><p>📋 No tienes favoritos guardados.</p></div>';
        return;
    }
    
    favorites.forEach(item => {
        const div = document.createElement('div');
        div.classList.add('wanted-item');
        
        const offices = item.offices?.join(', ') || 'Oficinas no disponibles';
        const reward = item.reward || 'Sin información de recompensa';

        div.innerHTML = `
            <img src="${item.image}" alt="${item.title}" onerror="this.src='https://via.placeholder.com/250?text=Error+Image'" loading="lazy">
            <h3>${item.title}</h3>
            <p><strong>Oficinas:</strong> ${offices}</p>
            <p><strong>Recompensa:</strong> ${reward}</p>
            <p><strong>Añadido el:</strong> ${new Date(item.dateAdded).toLocaleDateString()}</p>
            <button class="remove-favorite-btn" data-id="${item.id}">❌ Eliminar de Favoritos</button>
        `;

        favoriteList.appendChild(div);
        
        div.querySelector('.remove-favorite-btn').addEventListener('click', () => {
            removeFavorite(item.id);
        });
    });
}

function removeFavorite(id) {
    const item = favorites.find(fav => fav.id === id);
    favorites = favorites.filter(item => item.id !== id);
    localStorage.setItem('favorites', JSON.stringify(favorites));
    renderFavorites();
    
    if (item) {
        showNotification(`${item.title} eliminado de favoritos`);
    }
}

// Modal de detalles
function showPersonDetails(item) {
    const modal = document.createElement('div');
    modal.classList.add('modal');
    
    const photoUrl = item.images && item.images[0] ? item.images[0].original : 'https://via.placeholder.com/250?text=No+Image';
    const name = item.title || 'Nombre no disponible';
    
    modal.innerHTML = `
        <div class="modal-content">
            <button class="close-button">&times;</button>
            <img src="${photoUrl}" alt="${name}" class="detail-image" onerror="this.src='https://via.placeholder.com/250?text=Error+Image'">
            <h2>${name}</h2>
            <div class="details-grid">
                <p><strong>Descripción:</strong> ${item.description || 'No disponible'}</p>
                <p><strong>Oficinas:</strong> ${item.field_offices?.join(', ') || 'No disponible'}</p>
                <p><strong>Recompensa:</strong> ${item.reward_text || 'No disponible'}</p>
                <p><strong>Género:</strong> ${item.sex || 'No disponible'}</p>
                <p><strong>Nacionalidad:</strong> ${item.nationality || 'No disponible'}</p>
            </div>
            <div class="details-actions">
                <a href="${item.url || '#'}" target="_blank" class="details-link">🔗 Ver en FBI</a>
                <button id="shareBtn">📤 Compartir</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    document.body.style.overflow = 'hidden';
    
    // Eventos del modal
    modal.querySelector('.close-button').addEventListener('click', () => {
        document.body.removeChild(modal);
        document.body.style.overflow = '';
    });
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            document.body.removeChild(modal);
            document.body.style.overflow = '';
        }
    });
    
    // Compartir
    const shareBtn = modal.querySelector('#shareBtn');
    shareBtn.addEventListener('click', async () => {
        const info = `${name}\nOficinas: ${item.field_offices?.join(', ') || 'No disponible'}\nRecompensa: ${item.reward_text || 'No disponible'}`;
        
        if (navigator.share) {
            try {
                await navigator.share({
                    title: `FBI Wanted: ${name}`,
                    text: info,
                    url: item.url || window.location.href
                });
            } catch (error) {
                console.log('Error al compartir:', error);
            }
        } else {
            try {
                await navigator.clipboard.writeText(info);
                shareBtn.textContent = '✅ ¡Copiado!';
                setTimeout(() => {
                    shareBtn.textContent = '📤 Compartir';
                }, 2000);
            } catch (error) {
                console.log('Error al copiar:', error);
            }
        }
    });
}

// Búsqueda
function setupSearch() {
    const searchInput = document.getElementById('searchInput');
    if (!searchInput) return;
    
    searchInput.addEventListener('input', debounce(() => {
        const query = searchInput.value.toLowerCase();
        const resultsContainer = document.getElementById('searchResults');
        
        if (query.length < 3) {
            resultsContainer.innerHTML = '<p class="search-hint">💡 Ingresa al menos 3 caracteres para buscar</p>';
            return;
        }
        
        const results = allWantedData.filter(item => 
            item.title?.toLowerCase().includes(query) ||
            item.description?.toLowerCase().includes(query) ||
            item.field_offices?.some(office => office.toLowerCase().includes(query))
        );
        
        resultsContainer.innerHTML = '';
        
        if (results.length === 0) {
            resultsContainer.innerHTML = '<div class="empty-message"><p>🔍 No se encontraron coincidencias.</p></div>';
            return;
        }
        
        const resultHeader = document.createElement('p');
        resultHeader.className = 'search-results-header';
        resultHeader.textContent = `Encontrados ${results.length} resultado${results.length > 1 ? 's' : ''}:`;
        resultsContainer.appendChild(resultHeader);
        
        results.forEach(item => {
            const div = document.createElement('div');
            div.classList.add('wanted-item');

            const photoUrl = item.images && item.images[0] ? item.images[0].original : 'https://via.placeholder.com/250?text=No+Image';
            const name = item.title || 'Nombre no disponible';
            const offices = item.field_offices?.join(', ') || 'Oficinas no disponibles';
            
            div.innerHTML = `
                <img src="${photoUrl}" alt="${name}" loading="lazy">
                <h3>${name}</h3>
                <p><strong>Oficinas:</strong> ${offices}</p>
                <button class="details-btn">Ver Detalles</button>
            `;
            
            resultsContainer.appendChild(div);
            
            div.querySelector('.details-btn').addEventListener('click', () => {
                showPersonDetails(item);
            });
        });
    }, 300));
}

// Registro
function setupRegistration() {
    const registerForm = document.getElementById('registerForm');
    if (!registerForm) return;
    
    registerForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const name = document.getElementById('name').value;
        const email = document.getElementById('email').value;
        const interests = [];
        
        document.querySelectorAll('input[type="checkbox"]:checked').forEach(checkbox => {
            interests.push(checkbox.value);
        });
        
        if (interests.length === 0) {
            alert('Por favor selecciona al menos un interés.');
            return;
        }
        
        showNotification(`¡Registro exitoso! Bienvenido ${name}`);
        
        const userData = {
            name,
            email,
            interests,
            registrationDate: new Date().toISOString()
        };
        localStorage.setItem('userData', JSON.stringify(userData));
        
        this.reset();
    });
}

// ============ PWA CODESPACES ============

function setupCodespacesPWA() {
    if (!window.location.hostname.includes('.app.github.dev')) return;
    
    console.log('🚧 Configurando PWA para Codespaces...');
    
    // Crear botón de instalación
    const installBtn = document.createElement('button');
    installBtn.innerHTML = '📱 Instalar App';
    installBtn.style.cssText = `
        position: fixed;
        top: 80px;
        right: 20px;
        z-index: 9999;
        background: #007BFF;
        color: white;
        border: none;
        padding: 10px 15px;
        border-radius: 20px;
        cursor: pointer;
        font-weight: bold;
        box-shadow: 0 2px 10px rgba(0,123,255,0.3);
    `;
    
    installBtn.addEventListener('click', () => {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            deferredPrompt.userChoice.then((choiceResult) => {
                if (choiceResult.outcome === 'accepted') {
                    showNotification('🎉 ¡Instalación iniciada!');
                }
                deferredPrompt = null;
            });
        } else {
            alert(`📱 INSTALAR FBI WANTED

🖥️ CHROME: Menú ⋮ → "Instalar FBI Wanted"
🖥️ EDGE: Menú ... → "Aplicaciones" → "Instalar este sitio"
📱 MÓVIL: Menú ⋮ → "Añadir a pantalla de inicio"`);
        }
    });
    
    document.body.appendChild(installBtn);
    
    // Ocultar si ya está instalada
    if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) {
        installBtn.style.display = 'none';
    }
}

// Diagnóstico PWA
function runPWADiagnostic() {
    console.clear();
    console.log('🔍 DIAGNÓSTICO PWA');
    console.log('================');
    
    console.log('1. Protocolo:', window.location.protocol);
    console.log('2. Service Worker:', 'serviceWorker' in navigator ? '✅ Soportado' : '❌ No soportado');
    console.log('3. Manifest:', document.querySelector('link[rel="manifest"]') ? '✅ Encontrado' : '❌ No encontrado');
    console.log('4. PWA instalada:', window.matchMedia && window.matchMedia('(display-mode: standalone)').matches ? '✅ Sí' : '❌ No');
    
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(registrations => {
            console.log(`5. Service Workers activos: ${registrations.length}`);
        });
    }
}

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
    setupSearch();
    setupRegistration();
    
    // Configurar PWA para Codespaces
    setTimeout(() => {
        setupCodespacesPWA();
    }, 1000);
});

// Hacer funciones disponibles globalmente
window.runPWADiagnostic = runPWADiagnostic;
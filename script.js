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

// ============ MEJORAS PARA MÓVIL ============

// Detectar dispositivo móvil
function isMobileDevice() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

// Mejorar PWA para móvil
function setupMobilePWA() {
    if (!isMobileDevice()) return;
    
    console.log('📱 Configurando PWA para móvil...');
    
    // Crear banner móvil específico
    createMobileBanner();
    
    // Configurar eventos táctiles
    setupTouchEvents();
    
    // Verificar criterios específicos de móvil
    checkMobilePWACriteria();
}

// Banner específico para móvil
function createMobileBanner() {
    // Esperar un poco para que cargue todo
    setTimeout(() => {
        if (isAppAlreadyInstalled()) {
            console.log('📱 App ya instalada en móvil');
            return;
        }
        
        const mobileBanner = document.createElement('div');
        mobileBanner.id = 'mobilePWABanner';
        mobileBanner.style.cssText = `
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            background: linear-gradient(135deg, #007BFF, #0056b3);
            color: white;
            padding: 15px;
            z-index: 9999;
            text-align: center;
            box-shadow: 0 -2px 10px rgba(0,0,0,0.3);
            transform: translateY(100%);
            transition: transform 0.3s ease;
        `;
        
        mobileBanner.innerHTML = `
            <div style="margin-bottom: 10px;">
                <strong>📱 ¡Instala FBI Wanted!</strong><br>
                <small>Acceso rápido desde tu pantalla de inicio</small>
            </div>
            <div style="display: flex; gap: 10px; justify-content: center;">
                <button id="mobileInstallBtn" style="
                    background: white;
                    color: #007BFF;
                    border: none;
                    padding: 10px 20px;
                    border-radius: 20px;
                    font-weight: bold;
                    cursor: pointer;
                ">Instalar</button>
                <button id="mobileDismissBtn" style="
                    background: transparent;
                    color: white;
                    border: 2px solid white;
                    padding: 10px 20px;
                    border-radius: 20px;
                    cursor: pointer;
                ">Cerrar</button>
            </div>
        `;
        
        document.body.appendChild(mobileBanner);
        
        // Mostrar banner con animación
        setTimeout(() => {
            mobileBanner.style.transform = 'translateY(0)';
        }, 500);
        
        // Eventos
        document.getElementById('mobileInstallBtn').addEventListener('click', handleMobileInstall);
        document.getElementById('mobileDismissBtn').addEventListener('click', () => {
            mobileBanner.style.transform = 'translateY(100%)';
            setTimeout(() => {
                if (mobileBanner.parentNode) {
                    mobileBanner.parentNode.removeChild(mobileBanner);
                }
            }, 300);
        });
        
        // Auto-ocultar después de 30 segundos
        setTimeout(() => {
            if (mobileBanner.parentNode) {
                mobileBanner.style.transform = 'translateY(100%)';
            }
        }, 30000);
        
    }, 3000);
}

// Verificar si la app ya está instalada
function isAppAlreadyInstalled() {
    // Verificar si se ejecuta en modo standalone
    if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) {
        return true;
    }
    
    // Verificar si se ejecuta desde pantalla de inicio (iOS)
    if (window.navigator.standalone === true) {
        return true;
    }
    
    return false;
}

// Manejar instalación en móvil
function handleMobileInstall() {
    console.log('📱 Instalación móvil iniciada...');
    
    if (deferredPrompt) {
        // Usar prompt nativo si está disponible
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then((choiceResult) => {
            console.log('Resultado móvil:', choiceResult.outcome);
            if (choiceResult.outcome === 'accepted') {
                showNotification('🎉 ¡Instalación iniciada!');
            } else {
                showMobileInstructions();
            }
            deferredPrompt = null;
        });
    } else {
        // Mostrar instrucciones manuales
        showMobileInstructions();
    }
}

// Instrucciones específicas para móvil
function showMobileInstructions() {
    const userAgent = navigator.userAgent.toLowerCase();
    let instructions = '';
    
    if (userAgent.includes('android')) {
        if (userAgent.includes('chrome')) {
            instructions = `
📱 ANDROID + CHROME:

1️⃣ Toca el menú (⋮) en la esquina superior derecha
2️⃣ Busca "Añadir a pantalla de inicio" o "Instalar aplicación"
3️⃣ Toca "Instalar" o "Añadir"
4️⃣ ¡Listo! La app aparecerá en tu pantalla de inicio

💡 TIP: Si no ves la opción, prueba:
• Recargar la página
• Usar el navegador Chrome actualizado
• Verificar que tengas espacio en tu dispositivo
            `;
        } else {
            instructions = `
📱 ANDROID:

1️⃣ Abre esta página en Google Chrome
2️⃣ Menú (⋮) → "Añadir a pantalla de inicio"
3️⃣ Confirma la instalación

Chrome es el navegador recomendado para instalar PWAs.
            `;
        }
    } else if (userAgent.includes('iphone') || userAgent.includes('ipad')) {
        instructions = `
📱 iPhone/iPad + SAFARI:

1️⃣ Toca el botón Compartir 📤 (abajo en el centro)
2️⃣ Desplázate y busca "Añadir a pantalla de inicio"
3️⃣ Toca "Añadir" en la esquina superior derecha
4️⃣ Confirma el nombre de la app
5️⃣ ¡Listo! La app aparecerá en tu pantalla de inicio

⚠️ IMPORTANTE: Debe usarse Safari, no Chrome en iOS.
        `;
    } else {
        instructions = `
📱 INSTALACIÓN EN MÓVIL:

🤖 ANDROID:
• Chrome: Menú → "Añadir a pantalla de inicio"
• Otros navegadores: Usar Chrome

🍎 iOS:
• Safari: Botón Compartir → "Añadir a pantalla de inicio"
• No funciona en Chrome iOS
        `;
    }
    
    // Crear modal con instrucciones
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.9);
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
        box-sizing: border-box;
    `;
    
    modal.innerHTML = `
        <div style="
            background: white;
            padding: 25px;
            border-radius: 15px;
            max-width: 400px;
            width: 100%;
            max-height: 80vh;
            overflow-y: auto;
            position: relative;
        ">
            <button id="closeModal" style="
                position: absolute;
                top: 10px;
                right: 15px;
                background: none;
                border: none;
                font-size: 24px;
                cursor: pointer;
                color: #666;
            ">&times;</button>
            
            <h2 style="color: #007BFF; margin-top: 0; text-align: center;">
                📱 Cómo Instalar
            </h2>
            
            <div style="
                white-space: pre-line;
                line-height: 1.5;
                font-size: 14px;
                color: #333;
            ">${instructions}</div>
            
            <div style="text-align: center; margin-top: 20px;">
                <button onclick="this.parentElement.parentElement.parentElement.remove()" style="
                    background: #007BFF;
                    color: white;
                    border: none;
                    padding: 12px 24px;
                    border-radius: 8px;
                    font-weight: bold;
                    cursor: pointer;
                ">Entendido</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Cerrar modal
    modal.querySelector('#closeModal').addEventListener('click', () => {
        modal.remove();
    });
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
}

// Configurar eventos táctiles para mejor experiencia móvil
function setupTouchEvents() {
    // Mejorar la experiencia táctil de los botones
    const buttons = document.querySelectorAll('button');
    buttons.forEach(button => {
        button.addEventListener('touchstart', function() {
            this.style.transform = 'scale(0.95)';
        });
        
        button.addEventListener('touchend', function() {
            this.style.transform = 'scale(1)';
        });
    });
}

// Verificar criterios específicos de PWA en móvil
function checkMobilePWACriteria() {
    console.log('📱 Verificando criterios PWA móvil...');
    
    // Verificar que los meta tags estén presentes
    const requiredMetas = [
        'viewport',
        'theme-color',
        'mobile-web-app-capable'
    ];
    
    requiredMetas.forEach(metaName => {
        const meta = document.querySelector(`meta[name="${metaName}"]`);
        console.log(`📱 Meta ${metaName}:`, meta ? '✅' : '❌');
    });
    
    // Verificar manifest
    const manifestLink = document.querySelector('link[rel="manifest"]');
    console.log('📱 Manifest link:', manifestLink ? '✅' : '❌');
    
    // Verificar Service Worker
    console.log('📱 Service Worker:', 'serviceWorker' in navigator ? '✅' : '❌');
    
    // Verificar HTTPS
    console.log('📱 HTTPS:', window.location.protocol === 'https:' ? '✅' : '❌');
}

// Mejorar el manifest para móvil
function addMobileMetas() {
    const metasToAdd = [
        { name: 'mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-status-bar-style', content: 'default' },
        { name: 'apple-mobile-web-app-title', content: 'FBI Wanted' }
    ];
    
    metasToAdd.forEach(metaData => {
        if (!document.querySelector(`meta[name="${metaData.name}"]`)) {
            const meta = document.createElement('meta');
            meta.name = metaData.name;
            meta.content = metaData.content;
            document.head.appendChild(meta);
            console.log(`📱 Meta agregado: ${metaData.name}`);
        }
    });
}

// Función de debug específica para móvil
function debugMobilePWA() {
    console.clear();
    console.log('📱 DEBUG PWA MÓVIL');
    console.log('==================');
    
    const isMobile = isMobileDevice();
    console.log('📱 Es móvil:', isMobile ? '✅' : '❌');
    console.log('📱 User Agent:', navigator.userAgent);
    console.log('📱 Standalone (iOS):', window.navigator.standalone);
    console.log('📱 Display mode:', window.matchMedia('(display-mode: standalone)').matches ? 'standalone' : 'browser');
    
    if (isMobile) {
        checkMobilePWACriteria();
    }
    
    // Verificar si beforeinstallprompt se disparó
    setTimeout(() => {
        console.log('📱 deferredPrompt disponible:', !!deferredPrompt);
    }, 5000);
}

// Inicializar mejoras móviles
document.addEventListener('DOMContentLoaded', () => {
    if (isMobileDevice()) {
        console.log('📱 Dispositivo móvil detectado');
        addMobileMetas();
        
        setTimeout(() => {
            setupMobilePWA();
        }, 2000);
    }
});

// Hacer funciones disponibles globalmente para debug
window.debugMobilePWA = debugMobilePWA;
window.showMobileInstructions = showMobileInstructions;
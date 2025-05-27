// ============ PWA FUNCTIONALITY ============

// Variables para PWA
let deferredPrompt;
let isInstalled = false;

// Registrar Service Worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
        try {
            const registration = await navigator.serviceWorker.register('/sw.js');
            console.log('Service Worker registrado:', registration);
            
            // Actualizar estado en la UI
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
            console.error('Error al registrar Service Worker:', error);
            updateSWStatus('Service Worker no disponible');
        }
    });
}

// Manejar evento de instalación PWA
window.addEventListener('beforeinstallprompt', (e) => {
    console.log('PWA: Evento de instalación detectado');
    e.preventDefault();
    deferredPrompt = e;
    showInstallBanner();
});

// Detectar si ya está instalada
window.addEventListener('appinstalled', () => {
    console.log('PWA: Aplicación instalada');
    isInstalled = true;
    hideInstallBanner();
});

// Mostrar banner de instalación
function showInstallBanner() {
    const banner = document.getElementById('installBanner');
    if (banner && !isInstalled) {
        banner.style.display = 'block';
        
        // Evento para instalar
        document.getElementById('installBtn').addEventListener('click', async () => {
            if (deferredPrompt) {
                deferredPrompt.prompt();
                const { outcome } = await deferredPrompt.userChoice;
                console.log('PWA: Resultado de instalación:', outcome);
                deferredPrompt = null;
                hideInstallBanner();
            }
        });
        
        // Evento para cerrar banner
        document.getElementById('dismissBtn').addEventListener('click', () => {
            hideInstallBanner();
        });
    }
}

// Ocultar banner de instalación
function hideInstallBanner() {
    const banner = document.getElementById('installBanner');
    if (banner) {
        banner.style.display = 'none';
    }
}

// Mostrar botón de actualización
function showUpdateButton() {
    const updateBtn = document.getElementById('updateBtn');
    if (updateBtn) {
        updateBtn.style.display = 'block';
        updateBtn.addEventListener('click', () => {
            if (navigator.serviceWorker.controller) {
                navigator.serviceWorker.controller.postMessage({ command: 'skipWaiting' });
            }
            window.location.reload();
        });
    }
}

// Actualizar estado del Service Worker en la UI
function updateSWStatus(status) {
    const swStatus = document.getElementById('swStatus');
    if (swStatus) {
        swStatus.textContent = status;
    }
}

// Detectar estado de conexión
function updateConnectionStatus() {
    const statusElement = document.getElementById('connectionStatus');
    const statusText = document.getElementById('connectionText');
    
    if (navigator.onLine) {
        statusElement.style.display = 'none';
    } else {
        statusElement.style.display = 'block';
        statusText.textContent = 'Sin conexión - Modo offline';
    }
}

// Escuchar cambios de conexión
window.addEventListener('online', updateConnectionStatus);
window.addEventListener('offline', updateConnectionStatus);

// ============ APLICACIÓN ORIGINAL ============

// Ocultar splash después de 2.5 segundos
window.addEventListener('load', () => {
    setTimeout(() => {
        document.getElementById('splashScreen').style.display = 'none';
        document.querySelector('.app-container').style.display = 'block';
        
        // Verificar estado de conexión
        updateConnectionStatus();
        
        // Verificar parámetros URL para deep linking
        checkURLParams();
    }, 2500);
    
    // Cargar datos automáticamente al iniciar la aplicación
    loadWantedData();
});

// Deep linking - verificar parámetros URL
function checkURLParams() {
    const urlParams = new URLSearchParams(window.location.search);
    const tab = urlParams.get('tab');
    
    if (tab && ['home', 'wanted', 'favorites', 'search', 'register', 'about'].includes(tab)) {
        showTab(tab);
    }
}

// Variables globales
let allWantedData = []; // Almacena todos los datos de la API
let favorites = JSON.parse(localStorage.getItem('favorites')) || []; // Carga favoritos del localStorage

// Mostrar la pestaña correspondiente
function showTab(tabId) {
    const tabs = document.querySelectorAll('.tab-content');
    tabs.forEach(tab => {
        tab.classList.remove('active');
    });
    document.getElementById(tabId).classList.add('active');
    
    // Actualizar URL para deep linking
    const newURL = new URL(window.location);
    newURL.searchParams.set('tab', tabId);
    window.history.pushState({ tab: tabId }, '', newURL);
    
    // Cargar contenido específico según la pestaña seleccionada
    if (tabId === 'favorites') {
        renderFavorites();
    }
}

// Manejar navegación con botones del navegador
window.addEventListener('popstate', (event) => {
    if (event.state && event.state.tab) {
        showTab(event.state.tab);
    }
});

// Cargar datos de la API
document.getElementById('loadDataBtn').addEventListener('click', loadWantedData);

function loadWantedData() {
    const apiUrl = 'https://api.fbi.gov/wanted/v1/list';
    
    // Mostrar indicador de carga
    document.getElementById('wantedList').innerHTML = '<div class="loading"></div>';
    
    // Agregar un tiempo de espera para la solicitud fetch
    const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Tiempo de espera agotado')), 10000);
    });
    
    // Competir entre el fetch y el timeout
    Promise.race([
        fetch(apiUrl),
        timeoutPromise
    ])
    .then(response => {
        if (!response.ok) {
            throw new Error(`Error HTTP: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        if (!data || !data.items) {
            throw new Error('Datos no válidos recibidos de la API');
        }
        
        allWantedData = data.items || [];
        
        if (allWantedData.length === 0) {
            throw new Error('No se encontraron datos en la respuesta de la API');
        }
        
        renderWantedList(allWantedData);
        
        // Preparar los filtros una vez que tengamos los datos
        prepareFilters();
        
        // Registrar sincronización en segundo plano
        if ('serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype) {
            navigator.serviceWorker.ready.then(registration => {
                return registration.sync.register('background-sync');
            });
        }
    })
    .catch(error => {
        console.error('Error al obtener los datos:', error);
        
        // Cargar datos de respaldo
        loadBackupData();
        
        document.getElementById('wantedList').innerHTML = `
            <div class="error-message">
                <p>⚠️ No se pudieron cargar los datos desde la API del FBI.</p>
                <p>Usando datos de ejemplo ${navigator.onLine ? '(problema de servidor)' : '(modo offline)'}.</p>
                <button onclick="loadWantedData()" class="retry-btn">🔄 Reintentar</button>
            </div>
        `;
    });
}

// Función para cargar datos de respaldo si la API falla
function loadBackupData() {
    // Ejemplo de datos estáticos como respaldo
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
        },
        {
            uid: "3",
            title: "Robert Johnson",
            field_offices: ["Chicago", "Detroit"],
            images: [{ original: "https://via.placeholder.com/250?text=Robert+Johnson" }],
            reward_text: "$15,000",
            description: "Buscado por tráfico de drogas",
            sex: "Male",
            nationality: "American",
            publication: "2023-03-10",
            url: "https://www.fbi.gov/"
        },
        {
            uid: "4",
            title: "Maria Rodriguez",
            field_offices: ["San Diego", "Phoenix"],
            images: [{ original: "https://via.placeholder.com/250?text=Maria+Rodriguez" }],
            reward_text: "$8,000",
            description: "Buscada por fraude y estafa",
            sex: "Female",
            nationality: "Mexican",
            publication: "2023-04-05",
            url: "https://www.fbi.gov/"
        },
        {
            uid: "5",
            title: "David Lee",
            field_offices: ["Boston", "Philadelphia"],
            images: [{ original: "https://via.placeholder.com/250?text=David+Lee" }],
            reward_text: "$20,000",
            description: "Buscado por secuestro y extorsión",
            sex: "Male",
            nationality: "Chinese",
            publication: "2023-05-18",
            url: "https://www.fbi.gov/"
        }
    ];
    
    renderWantedList(allWantedData);
    prepareFilters();
}

// Renderizar la lista de personas buscadas
function renderWantedList(dataArray) {
    const wantedList = document.getElementById('wantedList');
    wantedList.innerHTML = '';
    
    if (dataArray.length === 0) {
        wantedList.innerHTML = '<div class="empty-message"><p>No se encontraron personas buscadas con los criterios seleccionados.</p></div>';
        return;
    }
    
    dataArray.forEach(item => {
        const div = document.createElement('div');
        div.classList.add('wanted-item');

        const photoUrl = item.images && item.images[0] ? item.images[0].original : 'https://via.placeholder.com/250?text=No+Image';
        const name = item.title || 'Nombre no disponible';
        const offices = item.field_offices?.join(', ') || 'Oficinas no disponibles';
        const reward = item.reward_text || 'Sin información de recompensa';
        
        // Verificar si está en favoritos
        const isFavorite = favorites.some(fav => fav.id === item.uid);
        const favoriteClass = isFavorite ? 'favorite-active' : '';
        const favoriteText = isFavorite ? 'Quitar de Favoritos' : 'Añadir a Favoritos';

        div.innerHTML = `
            <img src="${photoUrl}" alt="${name}" onerror="this.src='https://via.placeholder.com/250?text=Error+Image'" loading="lazy">
            <h3>${name}</h3>
            <p><strong>Oficinas:</strong> ${offices}</p>
            <p><strong>Recompensa:</strong> ${reward}</p>
            <button class="favorite-btn ${favoriteClass}" data-id="${item.uid}" aria-label="${favoriteText}">
                ${isFavorite ? '❤️' : '🤍'} ${favoriteText}
            </button>
            <button class="details-btn" data-id="${item.uid}" aria-label="Ver detalles de ${name}">Ver Detalles</button>
        `;

        wantedList.appendChild(div);
        
        // Añadir eventos a los botones
        div.querySelector('.favorite-btn').addEventListener('click', (e) => {
            toggleFavorite(item);
            e.target.classList.toggle('favorite-active');
            if (e.target.classList.contains('favorite-active')) {
                e.target.innerHTML = `❤️ Quitar de Favoritos`;
                e.target.setAttribute('aria-label', 'Quitar de Favoritos');
            } else {
                e.target.innerHTML = `🤍 Añadir a Favoritos`;
                e.target.setAttribute('aria-label', 'Añadir a Favoritos');
            }
        });
        
        div.querySelector('.details-btn').addEventListener('click', () => {
            showPersonDetails(item);
        });
    });
}

// Preparar filtros basados en los datos
function prepareFilters() {
    const filterSection = document.getElementById('filterOptions');
    filterSection.innerHTML = '';
    
    // Extraer todas las oficinas disponibles
    const allOffices = new Set();
    allWantedData.forEach(item => {
        if (item.field_offices && Array.isArray(item.field_offices)) {
            item.field_offices.forEach(office => allOffices.add(office));
        }
    });
    
    // Crear selector de oficinas
    const officeSelect = document.createElement('select');
    officeSelect.id = 'officeFilter';
    officeSelect.innerHTML = '<option value="">Todas las oficinas</option>';
    officeSelect.setAttribute('aria-label', 'Filtrar por oficina');
    
    Array.from(allOffices).sort().forEach(office => {
        officeSelect.innerHTML += `<option value="${office}">${office}</option>`;
    });
    
    // Crear campo de búsqueda por nombre
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.id = 'nameFilter';
    nameInput.placeholder = 'Filtrar por nombre...';
    nameInput.setAttribute('aria-label', 'Filtrar por nombre');
    
    // Crear botón para aplicar filtros
    const applyBtn = document.createElement('button');
    applyBtn.textContent = '🔍 Aplicar Filtros';
    applyBtn.id = 'applyFilters';
    applyBtn.setAttribute('aria-label', 'Aplicar filtros seleccionados');
    
    // Crear botón para reiniciar filtros
    const resetBtn = document.createElement('button');
    resetBtn.textContent = '🔄 Reiniciar Filtros';
    resetBtn.id = 'resetFilters';
    resetBtn.setAttribute('aria-label', 'Reiniciar todos los filtros');
    
    // Añadir elementos al contenedor de filtros
    const filterTitle = document.createElement('h3');
    filterTitle.textContent = 'Filtros';
    filterSection.appendChild(filterTitle);
    
    const officeLabel = document.createElement('label');
    officeLabel.textContent = 'Oficina: ';
    officeLabel.htmlFor = 'officeFilter';
    filterSection.appendChild(officeLabel);
    filterSection.appendChild(officeSelect);
    filterSection.appendChild(document.createElement('br'));
    
    const nameLabel = document.createElement('label');
    nameLabel.textContent = 'Nombre: ';
    nameLabel.htmlFor = 'nameFilter';
    filterSection.appendChild(nameLabel);
    filterSection.appendChild(nameInput);
    filterSection.appendChild(document.createElement('br'));
    
    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'filter-buttons';
    buttonContainer.appendChild(applyBtn);
    buttonContainer.appendChild(resetBtn);
    filterSection.appendChild(buttonContainer);
    
    // Añadir eventos a los filtros
    document.getElementById('applyFilters').addEventListener('click', applyFilters);
    document.getElementById('resetFilters').addEventListener('click', resetFilters);
    
    // Aplicar filtros en tiempo real
    nameInput.addEventListener('input', debounce(applyFilters, 300));
    officeSelect.addEventListener('change', applyFilters);
}

// Función debounce para optimizar búsquedas
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

// Aplicar filtros a la lista
function applyFilters() {
    const officeFilter = document.getElementById('officeFilter')?.value || '';
    const nameFilter = document.getElementById('nameFilter')?.value.toLowerCase() || '';
    
    let filteredData = [...allWantedData];
    
    // Filtrar por oficina
    if (officeFilter) {
        filteredData = filteredData.filter(item => 
            item.field_offices && item.field_offices.includes(officeFilter)
        );
    }
    
    // Filtrar por nombre
    if (nameFilter) {
        filteredData = filteredData.filter(item => 
            item.title && item.title.toLowerCase().includes(nameFilter)
        );
    }
    
    // Mostrar resultados filtrados
    renderWantedList(filteredData);
    
    // Mostrar contador de resultados
    showFilterResults(filteredData.length, allWantedData.length);
}

// Mostrar contador de resultados de filtros
function showFilterResults(filtered, total) {
    let resultCounter = document.getElementById('filterResults');
    if (!resultCounter) {
        resultCounter = document.createElement('p');
        resultCounter.id = 'filterResults';
        resultCounter.className = 'filter-results';
        document.getElementById('filterOptions').appendChild(resultCounter);
    }
    
    if (filtered === total) {
        resultCounter.textContent = `Mostrando todos los ${total} resultados`;
    } else {
        resultCounter.textContent = `Mostrando ${filtered} de ${total} resultados`;
    }
}

// Reiniciar filtros
function resetFilters() {
    const officeFilter = document.getElementById('officeFilter');
    const nameFilter = document.getElementById('nameFilter');
    
    if (officeFilter) officeFilter.value = '';
    if (nameFilter) nameFilter.value = '';
    
    renderWantedList(allWantedData);
    showFilterResults(allWantedData.length, allWantedData.length);
}

// CRUD para favoritos
function toggleFavorite(item) {
    const index = favorites.findIndex(fav => fav.id === item.uid);
    
    if (index === -1) {
        // Añadir a favoritos
        favorites.push({
            id: item.uid,
            title: item.title,
            image: item.images && item.images[0] ? item.images[0].original : 'https://via.placeholder.com/250?text=No+Image',
            offices: item.field_offices,
            reward: item.reward_text,
            dateAdded: new Date().toISOString()
        });
        
        // Mostrar notificación
        showNotification(`${item.title} añadido a favoritos`);
    } else {
        // Eliminar de favoritos
        favorites.splice(index, 1);
        showNotification(`${item.title} eliminado de favoritos`);
    }
    
    // Guardar en localStorage
    localStorage.setItem('favorites', JSON.stringify(favorites));
    
    // Si estamos en la pestaña de favoritos, actualizarla
    if (document.getElementById('favorites').classList.contains('active')) {
        renderFavorites();
    }
}

// Mostrar notificación toast
function showNotification(message) {
    // Crear elemento de notificación
    const notification = document.createElement('div');
    notification.className = 'toast-notification';
    notification.textContent = message;
    
    // Añadir al DOM
    document.body.appendChild(notification);
    
    // Mostrar con animación
    setTimeout(() => {
        notification.classList.add('show');
    }, 100);
    
    // Ocultar después de 3 segundos
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

// Renderizar lista de favoritos
function renderFavorites() {
    const favoriteList = document.getElementById('favoritesList');
    favoriteList.innerHTML = '';
    
    if (favorites.length === 0) {
        favoriteList.innerHTML = '<div class="empty-message"><p>📋 No tienes favoritos guardados.</p><p>Marca personas como favoritas desde la lista de buscados.</p></div>';
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
            <button class="remove-favorite-btn" data-id="${item.id}" aria-label="Eliminar ${item.title} de favoritos">❌ Eliminar de Favoritos</button>
        `;

        favoriteList.appendChild(div);
        
        // Añadir evento para eliminar favorito
        div.querySelector('.remove-favorite-btn').addEventListener('click', () => {
            removeFavorite(item.id);
        });
    });
}

// Eliminar favorito
function removeFavorite(id) {
    const item = favorites.find(fav => fav.id === id);
    favorites = favorites.filter(item => item.id !== id);
    localStorage.setItem('favorites', JSON.stringify(favorites));
    renderFavorites();
    
    if (item) {
        showNotification(`${item.title} eliminado de favoritos`);
    }
}

// Función para mostrar detalles de una persona (funcionalidad única)
function showPersonDetails(item) {
    // Crear un modal para los detalles
    const modal = document.createElement('div');
    modal.classList.add('modal');
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-labelledby', 'modal-title');
    modal.setAttribute('aria-modal', 'true');
    
    const modalContent = document.createElement('div');
    modalContent.classList.add('modal-content');
    
    const closeButton = document.createElement('button');
    closeButton.classList.add('close-button');
    closeButton.innerHTML = '&times;';
    closeButton.setAttribute('aria-label', 'Cerrar modal');
    closeButton.addEventListener('click', () => {
        document.body.removeChild(modal);
        document.body.style.overflow = ''; // Restaurar scroll
    });
    
    // Obtener más detalles de la persona
    const photoUrl = item.images && item.images[0] ? item.images[0].original : 'https://via.placeholder.com/250?text=No+Image';
    const name = item.title || 'Nombre no disponible';
    const details = `
        <img src="${photoUrl}" alt="${name}" class="detail-image" onerror="this.src='https://via.placeholder.com/250?text=Error+Image'" loading="lazy">
        <h2 id="modal-title">${name}</h2>
        <div class="details-grid">
            <p><strong>Descripción:</strong> ${item.description || 'No disponible'}</p>
            <p><strong>Oficinas:</strong> ${item.field_offices?.join(', ') || 'No disponible'}</p>
            <p><strong>Recompensa:</strong> ${item.reward_text || 'No disponible'}</p>
            <p><strong>Género:</strong> ${item.sex || 'No disponible'}</p>
            <p><strong>Nacionalidad:</strong> ${item.nationality || 'No disponible'}</p>
            <p><strong>Fecha de Publicación:</strong> ${new Date(item.publication || '').toLocaleDateString() || 'No disponible'}</p>
        </div>
        <div class="details-actions">
            <a href="${item.url || '#'}" target="_blank" rel="noopener noreferrer" class="details-link">🔗 Ver en la web del FBI</a>
            <button id="shareBtn" aria-label="Compartir información">📤 Compartir</button>
        </div>
    `;
    
    modalContent.appendChild(closeButton);
    modalContent.innerHTML += details;
    
    modal.appendChild(modalContent);
    document.body.appendChild(modal);
    
    // Prevenir scroll del body
    document.body.style.overflow = 'hidden';
    
    // Focus en el modal
    modalContent.focus();
    
    // Añadir función de compartir (Web Share API)
    const shareBtn = document.getElementById('shareBtn');
    if (navigator.share) {
        shareBtn.addEventListener('click', async () => {
            try {
                await navigator.share({
                    title: `FBI Wanted: ${name}`,
                    text: `Información de persona buscada: ${name}`,
                    url: item.url || window.location.href
                });
            } catch (error) {
                console.log('Error al compartir:', error);
            }
        });
    } else {
        // Si Web Share API no está disponible, cambiar el botón por uno de copiar info
        shareBtn.textContent = '📋 Copiar Información';
        shareBtn.addEventListener('click', async () => {
            const info = `${name}\nOficinas: ${item.field_offices?.join(', ') || 'No disponible'}\nRecompensa: ${item.reward_text || 'No disponible'}\nURL: ${item.url || window.location.href}`;
            
            try {
                await navigator.clipboard.writeText(info);
                shareBtn.textContent = '✅ ¡Copiado!';
                setTimeout(() => {
                    shareBtn.textContent = '📋 Copiar Información';
                }, 2000);
            } catch (error) {
                // Fallback para navegadores sin clipboard API
                const textArea = document.createElement('textarea');
                textArea.value = info;
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
                
                shareBtn.textContent = '✅ ¡Copiado!';
                setTimeout(() => {
                    shareBtn.textContent = '📋 Copiar Información';
                }, 2000);
            }
        });
    }
    
    // Cerrar modal al hacer clic fuera del contenido
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            document.body.removeChild(modal);
            document.body.style.overflow = ''; // Restaurar scroll
        }
    });
    
    // Cerrar modal con tecla Escape
    const handleEscape = (e) => {
        if (e.key === 'Escape') {
            document.body.removeChild(modal);
            document.body.style.overflow = ''; // Restaurar scroll
            document.removeEventListener('keydown', handleEscape);
        }
    };
    document.addEventListener('keydown', handleEscape);
}

// Manejar la búsqueda en la pestaña "Buscar"
document.getElementById('searchInput').addEventListener('input', debounce(() => {
    const query = document.getElementById('searchInput').value.toLowerCase();
    
    if (query.length < 3) {
        document.getElementById('searchResults').innerHTML = '<p class="search-hint">💡 Ingresa al menos 3 caracteres para buscar</p>';
        return;
    }
    
    const results = allWantedData.filter(item => 
        item.title?.toLowerCase().includes(query) ||
        item.description?.toLowerCase().includes(query) ||
        item.field_offices?.some(office => office.toLowerCase().includes(query))
    );
    
    const resultsContainer = document.getElementById('searchResults');
    resultsContainer.innerHTML = '';
    
    if (results.length === 0) {
        resultsContainer.innerHTML = '<div class="empty-message"><p>🔍 No se encontraron coincidencias.</p><p>Intenta con otros términos de búsqueda.</p></div>';
        return;
    }
    
    // Mostrar contador de resultados
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
            <img src="${photoUrl}" alt="${name}" onerror="this.src='https://via.placeholder.com/250?text=Error+Image'" loading="lazy">
            <h3>${name}</h3>
            <p><strong>Oficinas:</strong> ${offices}</p>
            <button class="details-btn" data-id="${item.uid}" aria-label="Ver detalles de ${name}">Ver Detalles</button>
        `;
        
        resultsContainer.appendChild(div);
        
        // Añadir evento para ver detalles
        div.querySelector('.details-btn').addEventListener('click', () => {
            showPersonDetails(item);
        });
    });
}, 300));

// Formulario de registro (solo simulación)
document.getElementById('registerForm')?.addEventListener('submit', function(e) {
    e.preventDefault();
    
    const name = document.getElementById('name').value;
    const email = document.getElementById('email').value;
    const interests = [];
    
    // Obtener intereses seleccionados
    document.querySelectorAll('input[type="checkbox"]:checked').forEach(checkbox => {
        interests.push(checkbox.value);
    });
    
    if (interests.length === 0) {
        alert('Por favor selecciona al menos un interés.');
        return;
    }
    
    // Simular registro
    showNotification(`¡Registro exitoso! Bienvenido ${name}`);
    
    // Guardar en localStorage para futuras funcionalidades
    const userData = {
        name,
        email,
        interests,
        registrationDate: new Date().toISOString()
    };
    localStorage.setItem('userData', JSON.stringify(userData));
    
    this.reset();
});

// Función para exportar favoritos (funcionalidad adicional)
function exportFavorites() {
    if (favorites.length === 0) {
        showNotification('No tienes favoritos para exportar');
        return;
    }
    
    const dataStr = JSON.stringify(favorites, null, 2);
    const dataBlob = new Blob([dataStr], {type: 'application/json'});
    
    const link = document.createElement('a');
    link.href = URL.createObjectURL(dataBlob);
    link.download = 'fbi-wanted-favoritos.json';
    link.click();
    
    showNotification('Favoritos exportados correctamente');
}

// Función para importar favoritos
function importFavorites(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const importedFavorites = JSON.parse(e.target.result);
            
            if (Array.isArray(importedFavorites)) {
                favorites = [...favorites, ...importedFavorites];
                // Eliminar duplicados
                favorites = favorites.filter((item, index, self) => 
                    index === self.findIndex(t => t.id === item.id)
                );
                localStorage.setItem('favorites', JSON.stringify(favorites));
                renderFavorites();
                showNotification(`${importedFavorites.length} favoritos importados`);
            } else {
                throw new Error('Formato de archivo inválido');
            }
        } catch (error) {
            showNotification('Error al importar favoritos');
            console.error('Error:', error);
        }
    };
    reader.readAsText(file);
}

// Inicializar funcionalidades adicionales al cargar
document.addEventListener('DOMContentLoaded', () => {
    // Verificar si hay datos de usuario guardados
    const userData = localStorage.getItem('userData');
    if (userData) {
        const user = JSON.parse(userData);
        console.log('Usuario registrado:', user.name);
    }
    
    // Configurar lazy loading para imágenes
    if ('IntersectionObserver' in window) {
        const imageObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    img.src = img.dataset.src;
                    img.classList.remove('lazy');
                    observer.unobserve(img);
                }
            });
        });
        
        // Observar todas las imágenes con clase lazy
        document.querySelectorAll('img[data-src]').forEach(img => {
            imageObserver.observe(img);
        });
    }
});
// Script de diagnóstico PWA - Agregar al final de script.js o crear archivo separado

// Función para diagnosticar PWA
function diagnosticPWA() {
    console.log('🔍 DIAGNÓSTICO PWA');
    console.log('================');
    
    // 1. Verificar HTTPS
    console.log('1. Protocolo:', window.location.protocol);
    if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
        console.error('❌ ERROR: Se requiere HTTPS para PWA');
        alert('⚠️ HTTPS requerido: Las PWA necesitan HTTPS para funcionar (excepto en localhost)');
    } else {
        console.log('✅ Protocolo correcto');
    }
    
    // 2. Verificar Service Worker
    if ('serviceWorker' in navigator) {
        console.log('✅ Service Worker soportado');
        navigator.serviceWorker.getRegistrations().then(registrations => {
            console.log('2. Service Workers registrados:', registrations.length);
            registrations.forEach((registration, i) => {
                console.log(`   SW ${i+1}:`, registration.scope);
            });
        });
    } else {
        console.error('❌ Service Worker no soportado');
    }
    
    // 3. Verificar Manifest
    const manifestLink = document.querySelector('link[rel="manifest"]');
    console.log('3. Manifest link:', manifestLink ? '✅ Encontrado' : '❌ No encontrado');
    
    if (manifestLink) {
        fetch(manifestLink.href)
            .then(response => response.json())
            .then(manifest => {
                console.log('✅ Manifest cargado:', manifest);
                
                // Verificar campos críticos
                const requiredFields = ['name', 'short_name', 'start_url', 'display', 'icons'];
                requiredFields.forEach(field => {
                    if (manifest[field]) {
                        console.log(`   ✅ ${field}:`, manifest[field]);
                    } else {
                        console.error(`   ❌ Falta ${field}`);
                    }
                });
            })
            .catch(error => {
                console.error('❌ Error cargando manifest:', error);
            });
    }
    
    // 4. Verificar evento beforeinstallprompt
    let installPromptFired = false;
    window.addEventListener('beforeinstallprompt', (e) => {
        installPromptFired = true;
        console.log('✅ Evento beforeinstallprompt disparado');
    });
    
    setTimeout(() => {
        if (!installPromptFired) {
            console.warn('⚠️ Evento beforeinstallprompt no disparado después de 5 segundos');
            console.log('Posibles razones:');
            console.log('- La PWA ya está instalada');
            console.log('- No cumple criterios de instalación');
            console.log('- Navegador no compatible');
        }
    }, 5000);
    
    // 5. Verificar si ya está instalada
    if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) {
        console.log('✅ PWA ya está instalada y ejecutándose en modo standalone');
        alert('🎉 ¡La PWA ya está instalada! Estás ejecutando la versión instalada.');
    }
    
    // 6. Verificar criterios de instalación
    setTimeout(() => {
        console.log('📋 CRITERIOS DE INSTALACIÓN:');
        console.log('- ✅ Manifest válido');
        console.log('- ✅ Service Worker registrado');
        console.log('- ✅ Servido por HTTPS');
        console.log('- ⏳ Verificando engagement del usuario...');
    }, 2000);
}

// Función para forzar mostrar opción de instalación
function showInstallOption() {
    console.log('🔧 Intentando mostrar opción de instalación...');
    
    // Crear botón de instalación manual
    const installButton = document.createElement('button');
    installButton.textContent = '📱 Instalar PWA';
    installButton.style.cssText = `
        position: fixed;
        top: 10px;
        right: 10px;
        z-index: 10000;
        background: #007BFF;
        color: white;
        border: none;
        padding: 10px 15px;
        border-radius: 5px;
        cursor: pointer;
        font-weight: bold;
        box-shadow: 0 2px 10px rgba(0,0,0,0.3);
    `;
    
    installButton.addEventListener('click', () => {
        // Verificar si hay deferredPrompt disponible
        if (window.deferredPrompt) {
            window.deferredPrompt.prompt();
            window.deferredPrompt.userChoice.then((choiceResult) => {
                console.log('Resultado de instalación:', choiceResult.outcome);
                if (choiceResult.outcome === 'accepted') {
                    console.log('✅ Usuario aceptó la instalación');
                    alert('🎉 ¡Instalación iniciada!');
                } else {
                    console.log('❌ Usuario rechazó la instalación');
                }
                window.deferredPrompt = null;
            });
        } else {
            // Mostrar instrucciones manuales
            showManualInstallInstructions();
        }
    });
    
    document.body.appendChild(installButton);
    
    // Auto-remover después de 30 segundos
    setTimeout(() => {
        if (installButton.parentNode) {
            installButton.parentNode.removeChild(installButton);
        }
    }, 30000);
}

// Mostrar instrucciones manuales
function showManualInstallInstructions() {
    const userAgent = navigator.userAgent.toLowerCase();
    let instructions = '';
    
    if (userAgent.includes('chrome') && !userAgent.includes('edg')) {
        instructions = `
📱 CHROME - Para instalar:
1. Menú (⋮) → "Instalar FBI Wanted"
2. O busca el ícono + en la barra de direcciones
        `;
    } else if (userAgent.includes('edg')) {
        instructions = `
📱 EDGE - Para instalar:
1. Menú (...) → "Aplicaciones" → "Instalar este sitio como aplicación"
2. O busca el ícono + en la barra de direcciones
        `;
    } else if (userAgent.includes('safari')) {
        instructions = `
📱 SAFARI - Para añadir a pantalla de inicio:
1. Botón Compartir 📤
2. "Añadir a pantalla de inicio"
3. Confirmar nombre
        `;
    } else {
        instructions = `
📱 INSTALACIÓN MANUAL:
1. Busca en el menú del navegador la opción "Instalar" o "Añadir a pantalla de inicio"
2. O busca un ícono + en la barra de direcciones
        `;
    }
    
    alert(instructions);
}

// Ejecutar diagnóstico automáticamente
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Iniciando diagnóstico PWA...');
    diagnosticPWA();
    
    // Mostrar botón de instalación después de 3 segundos
    setTimeout(() => {
        showInstallOption();
    }, 3000);
});

// Hacer funciones disponibles globalmente para debugging manual
window.diagnosticPWA = diagnosticPWA;
window.showInstallOption = showInstallOption;
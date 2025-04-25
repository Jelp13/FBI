// Ocultar splash después de 2.5 segundos
window.addEventListener('load', () => {
    setTimeout(() => {
        document.getElementById('splashScreen').style.display = 'none';
        
        // Mostrar el contenedor principal
        document.querySelector('.app-container').style.display = 'block';
        
        // Aplicar estilos específicos según el tamaño de pantalla
        checkScreenSize();
        
        // Agregar un evento para verificar el tamaño de pantalla al redimensionar
        window.addEventListener('resize', checkScreenSize);
    }, 2500);
    
    // Cargar datos automáticamente al iniciar la aplicación
    loadWantedData();
});

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
    
    // Cargar contenido específico según la pestaña seleccionada
    if (tabId === 'favorites') {
        renderFavorites();
    }
}

// Cargar datos de la API
document.getElementById('loadDataBtn').addEventListener('click', loadWantedData);

function loadWantedData() {
    const apiUrl = 'https://api.fbi.gov/wanted/v1/list';
    
    // Mostrar indicador de carga
    document.getElementById('wantedList').innerHTML = '<p>Cargando datos...</p>';
    
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
    })
    .catch(error => {
        console.error('Error al obtener los datos:', error);
        
        // Cargar datos de respaldo
        loadBackupData();
        
        document.getElementById('wantedList').innerHTML = `
            <p>No se pudieron cargar los datos desde la API del FBI. Se han cargado datos de ejemplo.</p>
            <button onclick="loadWantedData()" class="retry-btn">Reintentar</button>
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
        wantedList.innerHTML = '<p>No se encontraron personas buscadas con los criterios seleccionados.</p>';
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
            <img src="${photoUrl}" alt="${name}" onerror="this.src='https://via.placeholder.com/250?text=Error+Image'">
            <h3>${name}</h3>
            <p><strong>Oficinas:</strong> ${offices}</p>
            <p><strong>Recompensa:</strong> ${reward}</p>
            <button class="favorite-btn ${favoriteClass}" data-id="${item.uid}">
                ${isFavorite ? '❤️' : '🤍'} ${favoriteText}
            </button>
            <button class="details-btn" data-id="${item.uid}">Ver Detalles</button>
        `;

        wantedList.appendChild(div);
        
        // Añadir eventos a los botones
        div.querySelector('.favorite-btn').addEventListener('click', (e) => {
            toggleFavorite(item);
            e.target.classList.toggle('favorite-active');
            if (e.target.classList.contains('favorite-active')) {
                e.target.innerHTML = `❤️ Quitar de Favoritos`;
            } else {
                e.target.innerHTML = `🤍 Añadir a Favoritos`;
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
    
    Array.from(allOffices).sort().forEach(office => {
        officeSelect.innerHTML += `<option value="${office}">${office}</option>`;
    });
    
    // Crear campo de búsqueda por nombre
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.id = 'nameFilter';
    nameInput.placeholder = 'Filtrar por nombre...';
    
    // Crear botón para aplicar filtros
    const applyBtn = document.createElement('button');
    applyBtn.textContent = 'Aplicar Filtros';
    applyBtn.id = 'applyFilters';
    
    // Crear botón para reiniciar filtros
    const resetBtn = document.createElement('button');
    resetBtn.textContent = 'Reiniciar Filtros';
    resetBtn.id = 'resetFilters';
    
    // Añadir elementos al contenedor de filtros
    filterSection.appendChild(document.createElement('h3')).textContent = 'Filtros';
    filterSection.appendChild(document.createTextNode('Oficina: '));
    filterSection.appendChild(officeSelect);
    filterSection.appendChild(document.createElement('br'));
    filterSection.appendChild(document.createTextNode('Nombre: '));
    filterSection.appendChild(nameInput);
    filterSection.appendChild(document.createElement('br'));
    filterSection.appendChild(applyBtn);
    filterSection.appendChild(resetBtn);
    
    // Añadir eventos a los filtros
    document.getElementById('applyFilters').addEventListener('click', applyFilters);
    document.getElementById('resetFilters').addEventListener('click', resetFilters);
}

// Aplicar filtros a la lista
function applyFilters() {
    const officeFilter = document.getElementById('officeFilter').value;
    const nameFilter = document.getElementById('nameFilter').value.toLowerCase();
    
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
}

// Reiniciar filtros
function resetFilters() {
    document.getElementById('officeFilter').value = '';
    document.getElementById('nameFilter').value = '';
    renderWantedList(allWantedData);
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
    } else {
        // Eliminar de favoritos
        favorites.splice(index, 1);
    }
    
    // Guardar en localStorage
    localStorage.setItem('favorites', JSON.stringify(favorites));
    
    // Si estamos en la pestaña de favoritos, actualizarla
    if (document.getElementById('favorites').classList.contains('active')) {
        renderFavorites();
    }
}

// Renderizar lista de favoritos
function renderFavorites() {
    const favoriteList = document.getElementById('favoritesList');
    favoriteList.innerHTML = '';
    
    if (favorites.length === 0) {
        favoriteList.innerHTML = '<p>No tienes favoritos guardados.</p>';
        return;
    }
    
    favorites.forEach(item => {
        const div = document.createElement('div');
        div.classList.add('wanted-item');
        
        const offices = item.offices?.join(', ') || 'Oficinas no disponibles';
        const reward = item.reward || 'Sin información de recompensa';

        div.innerHTML = `
            <img src="${item.image}" alt="${item.title}" onerror="this.src='https://via.placeholder.com/250?text=Error+Image'">
            <h3>${item.title}</h3>
            <p><strong>Oficinas:</strong> ${offices}</p>
            <p><strong>Recompensa:</strong> ${reward}</p>
            <p><strong>Añadido el:</strong> ${new Date(item.dateAdded).toLocaleDateString()}</p>
            <button class="remove-favorite-btn" data-id="${item.id}">❌ Eliminar de Favoritos</button>
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
    favorites = favorites.filter(item => item.id !== id);
    localStorage.setItem('favorites', JSON.stringify(favorites));
    renderFavorites();
}

// Función para mostrar detalles de una persona (funcionalidad única)
function showPersonDetails(item) {
    // Crear un modal para los detalles
    const modal = document.createElement('div');
    modal.classList.add('modal');
    
    const modalContent = document.createElement('div');
    modalContent.classList.add('modal-content');
    
    const closeButton = document.createElement('span');
    closeButton.classList.add('close-button');
    closeButton.innerHTML = '&times;';
    closeButton.addEventListener('click', () => {
        document.body.removeChild(modal);
    });
    
    // Obtener más detalles de la persona
    const photoUrl = item.images && item.images[0] ? item.images[0].original : 'https://via.placeholder.com/250?text=No+Image';
    const name = item.title || 'Nombre no disponible';
    const details = `
        <img src="${photoUrl}" alt="${name}" class="detail-image" onerror="this.src='https://via.placeholder.com/250?text=Error+Image'">
        <h2>${name}</h2>
        <div class="details-grid">
            <p><strong>Descripción:</strong> ${item.description || 'No disponible'}</p>
            <p><strong>Oficinas:</strong> ${item.field_offices?.join(', ') || 'No disponible'}</p>
            <p><strong>Recompensa:</strong> ${item.reward_text || 'No disponible'}</p>
            <p><strong>Género:</strong> ${item.sex || 'No disponible'}</p>
            <p><strong>Nacionalidad:</strong> ${item.nationality || 'No disponible'}</p>
            <p><strong>Fecha de Publicación:</strong> ${new Date(item.publication || '').toLocaleDateString() || 'No disponible'}</p>
        </div>
        <div class="details-actions">
            <a href="${item.url || '#'}" target="_blank" class="details-link">Ver en la web del FBI</a>
            <button id="shareBtn">Compartir</button>
        </div>
    `;
    
    modalContent.appendChild(closeButton);
    modalContent.innerHTML += details;
    
    modal.appendChild(modalContent);
    document.body.appendChild(modal);
    
    // Añadir función de compartir (Web Share API)
    if (navigator.share) {
        document.getElementById('shareBtn').addEventListener('click', () => {
            navigator.share({
                title: name,
                text: `Información de persona buscada: ${name}`,
                url: item.url || window.location.href
            })
            .catch(console.error);
        });
    } else {
        // Si Web Share API no está disponible, cambiar el botón por uno de copiar info
        const shareBtn = document.getElementById('shareBtn');
        shareBtn.textContent = 'Copiar Información';
        shareBtn.addEventListener('click', () => {
            const info = `${name}\nOficinas: ${item.field_offices?.join(', ') || 'No disponible'}\nRecompensa: ${item.reward_text || 'No disponible'}`;
            navigator.clipboard.writeText(info)
                .then(() => {
                    shareBtn.textContent = '¡Copiado!';
                    setTimeout(() => {
                        shareBtn.textContent = 'Copiar Información';
                    }, 2000);
                })
                .catch(() => {
                    alert('No se pudo copiar la información');
                });
        });
    }
    
    // Cerrar modal al hacer clic fuera del contenido
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            document.body.removeChild(modal);
        }
    });
}

// Manejar la búsqueda en la pestaña "Buscar"
document.getElementById('searchInput').addEventListener('input', () => {
    const query = document.getElementById('searchInput').value.toLowerCase();
    
    if (query.length < 3) {
        document.getElementById('searchResults').innerHTML = '';
        return;
    }
    
    const results = allWantedData.filter(item => item.title?.toLowerCase().includes(query));
    
    const resultsContainer = document.getElementById('searchResults');
    resultsContainer.innerHTML = '';
    
    if (results.length === 0) {
        resultsContainer.innerHTML = '<p>No se encontraron coincidencias.</p>';
        return;
    }
    
    results.forEach(item => {
        const div = document.createElement('div');
        div.classList.add('wanted-item');

        const photoUrl = item.images && item.images[0] ? item.images[0].original : 'https://via.placeholder.com/250?text=No+Image';
        const name = item.title || 'Nombre no disponible';
        const offices = item.field_offices?.join(', ') || 'Oficinas no disponibles';
        
        div.innerHTML = `
            <img src="${photoUrl}" alt="${name}" onerror="this.src='https://via.placeholder.com/250?text=Error+Image'">
            <h3>${name}</h3>
            <p><strong>Oficinas:</strong> ${offices}</p>
            <button class="details-btn" data-id="${item.uid}">Ver Detalles</button>
        `;
        
        resultsContainer.appendChild(div);
        
        // Añadir evento para ver detalles
        div.querySelector('.details-btn').addEventListener('click', () => {
            showPersonDetails(item);
        });
    });
});

// Formulario de registro (solo simulación)
document.getElementById('registerForm')?.addEventListener('submit', function(e) {
    e.preventDefault();
    
    const name = document.getElementById('name').value;
    const email = document.getElementById('email').value;
    
    alert(`Gracias, ${name}. Tu registro ha sido recibido en ${email}. Esta es una simulación, no se ha enviado información real.`);
    this.reset();
});

// Ocultar splash después de 2.5 segundos
window.addEventListener('load', () => {
    setTimeout(() => {
        document.getElementById('splashScreen').style.display = 'none';
        document.querySelector('.app-container').style.display = 'block';
    }, 2500);
});

// Mostrar la pestaña correspondiente
function showTab(tabId) {
    const tabs = document.querySelectorAll('.tab-content');
    tabs.forEach(tab => {
        tab.classList.remove('active');
    });
    document.getElementById(tabId).classList.add('active');
}

// Cargar datos de la API
document.getElementById('loadDataBtn').addEventListener('click', loadWantedData);

function loadWantedData() {
    const apiUrl = 'https://api.fbi.gov/wanted/v1/list';
    
    fetch(apiUrl)
        .then(response => response.json())
        .then(data => {
            const wantedList = document.getElementById('wantedList');
            wantedList.innerHTML = '';

            if (data.items && data.items.length > 0) {
                data.items.forEach(item => {
                    const wantedItem = document.createElement('div');
                    wantedItem.classList.add('wanted-item');

                    const photoUrl = item.images && item.images[0] ? item.images[0].original : 'https://via.placeholder.com/250';
                    const name = item.title || 'No disponible';
                    const description = item.field_offices ? item.field_offices.join(', ') : 'Sin oficinas';

                    wantedItem.innerHTML = `
                        <img src="${photoUrl}" alt="${name}">
                        <h3>${name}</h3>
                        <p><strong>Oficinas:</strong> ${description}</p>
                    `;

                    wantedList.appendChild(wantedItem);
                });
            } else {
                wantedList.innerHTML = '<p>No se encontraron personas buscadas.</p>';
            }
        })
        .catch(error => {
            console.error('Error al obtener los datos:', error);
            document.getElementById('wantedList').innerHTML = '<p>Error al cargar los datos.</p>';
        });
}

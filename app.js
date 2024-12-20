const CLIENT_ID = '753842432555-gop0b5be9p1h315hrdm89ag1injqgj1b.apps.googleusercontent.com';
const SCOPES = 'https://www.googleapis.com/auth/photoslibrary';

async function initializeApp() {
    const tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: handleAuthResponse
    });
    
    document.getElementById('authorize').onclick = () => {
        tokenClient.requestAccessToken();
    };
}

async function handleAuthResponse(response) {
    if (response.access_token) {
        document.getElementById('process').style.display = 'block';
        await loadAlbums(response.access_token);
    }
}

async function loadAlbums(accessToken) {
    const response = await fetch('https://photoslibrary.googleapis.com/v1/albums', {
        headers: {
            'Authorization': 'Bearer ' + accessToken
        }
    });
    
    const data = await response.json();
    const albumSelector = document.getElementById('album-selector');
    
    // Create source album dropdown
    const sourceSelect = document.createElement('select');
    sourceSelect.id = 'source-album';
    
    // Create destination album dropdown
    const destSelect = document.createElement('select');
    destSelect.id = 'dest-album';
    
    data.albums.forEach(album => {
        const sourceOption = document.createElement('option');
        sourceOption.value = album.id;
        sourceOption.textContent = album.title;
        sourceSelect.appendChild(sourceOption);
        
        const destOption = document.createElement('option');
        destOption.value = album.id;
        destOption.textContent = album.title;
        destSelect.appendChild(destOption);
    });
    
    albumSelector.innerHTML = '<div>Source Album: </div>';
    albumSelector.appendChild(sourceSelect);
    albumSelector.innerHTML += '<div>Destination Album: </div>';
    albumSelector.appendChild(destSelect);
}

window.onload = initializeApp;

function resizeImage(imageUrl, maxWidth, maxHeight) {
    return new Promise((resolve) => {
        const img = new Image();
        img.src = imageUrl;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            let width = img.width;
            let height = img.height;
            
            if (width > height) {
                if (width > maxWidth) {
                    height *= maxWidth / width;
                    width = maxWidth;
                }
            } else {
                if (height > maxHeight) {
                    width *= maxHeight / height;
                    height = maxHeight;
                }
            }
            
            canvas.width = width;
            canvas.height = height;
            
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', 0.8));
        };
    });
}

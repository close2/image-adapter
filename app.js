const API_KEY = 'YOUR_API_KEY';
const CLIENT_ID = 'YOUR_CLIENT_ID';
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
        // Load albums and show selector
        await loadAlbums();
    }
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

const CLIENT_ID = '753842432555-gop0b5be9p1h315hrdm89ag1injqgj1b.apps.googleusercontent.com';
const SCOPES = 'https://www.googleapis.com/auth/photoslibrary';

class AuthStep {

    constructor() {
        this.tokenClient = this.initializeGoogleAuth_();
        this.authorizeButton = document.getElementById('authorize');
    }

    displayElement() {
        return "auth-step"
    }

    initializeGoogleAuth_() {
        return google.accounts.oauth2.initTokenClient({
            client_id: CLIENT_ID,
            scope: SCOPES,
            callback: (response) => this.handleAuthCallback_(response)
        });
    }

    handleAuthCallback_(response) {
        if (response.access_token) {
            this.accessToken = response.access_token;
            StepManager.showStep(new AlbumStep(this.accessToken));
        }
    }

    setup() {
        this.authorizeButton.onclick = () => {
            this.tokenClient.requestAccessToken();
        };
    }
}

class AlbumStep {
    constructor(accessToken) {
        this.accessToken = accessToken;
        this.albumNextButton = document.getElementById('albumNext');
        this.loadAlbums();
        this.setup();
    }

    displayElement() {
        return "album-select-step"
    }

    async loadAlbums() {
        const response = await fetch('https://photoslibrary.googleapis.com/v1/albums', {
            headers: {
                'Authorization': 'Bearer ' + this.accessToken
            }
        });
        
        const data = await response.json();
        this.renderAlbumSelectors(data.albums);
    }

    renderAlbumSelectors(albums) {
        const albumSelector = document.getElementById('album-selector');
        const sourceSelect = document.createElement('select');
        const destSelect = document.createElement('select');
        
        sourceSelect.id = 'source-album';
        destSelect.id = 'dest-album';
        
        albums.forEach(album => {
            sourceSelect.appendChild(this.createOption(album));
            destSelect.appendChild(this.createOption(album));
        });
        
        albumSelector.innerHTML = '<div>Source Album: </div>';
        albumSelector.appendChild(sourceSelect);
        albumSelector.innerHTML += '<div>Destination Album: </div>';
        albumSelector.appendChild(destSelect);
    }

    createOption(album) {
        const option = document.createElement('option');
        option.value = album.id;
        option.textContent = album.title;
        return option;
    }

    setup() {
        this.albumNextButton.addEventListener('click', () => {
            StepManager.showStep(new PreviewStep());
        });
    }
}

class PreviewStep {
    constructor() {
        this.previewNextButton = document.getElementById('previewNext');
        this.setup();
    }

    displayElement() {
        return "preview-step"
    }

    setup() {
        this.previewNextButton.addEventListener('click', () => {
            this.handlePreview();
        });
    }

    handlePreview() {
        console.log('Ready to process images');
    }
}

class StepManager {
    static showStep(step) {
        document.querySelectorAll('.step').forEach(step => step.classList.remove('active'));
        document.getElementById(step.displayElement()).classList.add('active');
        step.setup();
    }
}


StepManager.showStep(new AuthStep());




async function resizeImage(imageUrl, maxWidth, maxHeight) {
    return new Promise((resolve) => {
        const img = new Image();
        img.src = imageUrl;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            let [width, height] = this.calculateDimensions(img, maxWidth, maxHeight);
            
            canvas.width = width;
            canvas.height = height;
            
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', 0.8));
        };
    });
}

function calculateDimensions(img, maxWidth, maxHeight) {
    let width = img.width;
    let height = img.height;
    
    if (width > height && width > maxWidth) {
        height *= maxWidth / width;
        width = maxWidth;
    } else if (height > maxHeight) {
        width *= maxHeight / height;
        height = maxHeight;
    }
    
    return [width, height];
}


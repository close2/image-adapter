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
            StepManager.transitionToStep(new AlbumStep(this.accessToken));
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
        this.albumNextButton = document.getElementById('album-next');
        this.selectedPhotos = [];
        this.setup();
    }

    displayElement() {
        return "album-select-step"
    }

    setup() {
        const photoPicker = new google.photos.Picker({
            clientId: CLIENT_ID,
            select: 'multi',
            mimeTypes: 'image/*',
            onSelect: (photos) => {
                this.selectedPhotos = photos;
                StepManager.transitionToStep(new DestinationAlbumStep(
                    this.accessToken,
                    this.selectedPhotos
                ));
            }
        });

        this.albumNextButton.addEventListener('click', () => {
            photoPicker.open();
        });
    }
}

class ProcessCopyStep {
    constructor(accessToken, selectedPhotos) {
        this.api = new GooglePhotosAPI(accessToken);
        this.selectedPhotos = selectedPhotos;
        this.processImages();
    }

    displayElement() {
        return "process-step"
    }

    async processImages() {
        const GOOGLE_HOME_RATIO = 16/9;
        
        for (const photo of this.selectedPhotos) {
            const processedImage = await this.processImage(photo, GOOGLE_HOME_RATIO);
            await this.uploadToAlbum(processedImage);
        }
    }
    
    async processImage(image, targetRatio) {
        const baseUrl = `${image.baseUrl}=d`;
        const img = new Image();
        
        await new Promise((resolve) => {
            img.onload = resolve;
            img.src = baseUrl;
        });
        
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        const currentRatio = img.width / img.height;
        let newWidth = img.width;
        let newHeight = img.height;
        
        if (currentRatio > targetRatio) {
            newHeight = img.width / targetRatio;
            canvas.width = img.width;
            canvas.height = newHeight;
            
            const blackSpace = (newHeight - img.height) / 2;
            ctx.fillStyle = 'black';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, blackSpace);
        } else {
            newWidth = img.height * targetRatio;
            canvas.width = newWidth;
            canvas.height = img.height;
            
            const blackSpace = (newWidth - img.width) / 2;
            ctx.fillStyle = 'black';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, blackSpace, 0);
        }
        
        return new Promise(resolve => {
            canvas.toBlob(resolve, 'image/jpeg', 0.95);
        });
    }
    
    async uploadToAlbum(imageBlob) {
        const uploadToken = await this.api.uploadImage(imageBlob);
        await this.api.createMediaItem(uploadToken, this.destAlbum.id);
    }

    async setup() {
        await this.processImages();
    }
}
class StepManager {
    static transitionToStep(step) {
        console.log("Switching to step: " + step.displayElement());
        document.querySelectorAll('.step').forEach(step => step.classList.remove('active'));
        document.getElementById(step.displayElement()).classList.add('active');
        step.setup();
    }
}



document.addEventListener('DOMContentLoaded', () => {
    StepManager.transitionToStep(new AuthStep());
});




class GooglePhotosAPI {
    constructor(accessToken) {
        this.accessToken = accessToken;
        this.baseUrl = 'https://photoslibrary.googleapis.com/v1';
    }

    async getAlbums() {
        const response = await fetch(`${this.baseUrl}/albums`, {
            headers: this.getHeaders()
        });
        const data = await response.json();
        return data.albums;
    }

    async getAlbumMedia(albumId) {
        const response = await fetch(`${this.baseUrl}/mediaItems:search`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify({
                albumId: albumId,
                pageSize: 50
            })
        });
        const data = await response.json();
        return data.mediaItems;
    }

    async uploadImage(blob) {
        const response = await fetch(`${this.baseUrl}/uploads`, {
            method: 'POST',
            headers: {
                ...this.getHeaders(),
                'Content-Type': 'application/octet-stream',
                'X-Goog-Upload-Protocol': 'raw'
            },
            body: blob
        });
        return await response.text();
    }

    async createMediaItem(uploadToken, albumId) {
        return fetch(`${this.baseUrl}/mediaItems:batchCreate`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify({
                albumId: albumId,
                newMediaItems: [{
                    simpleMediaItem: {
                        uploadToken: uploadToken
                    }
                }]
            })
        });
    }

    getHeaders() {
        return {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json'
        };
    }

    async createAlbum(albumName) {
        const response = await fetch(`${this.baseUrl}/albums`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify({
                album: {
                    title: albumName
                }
            })
        });
        return response.json();
    }
}
class DestinationAlbumStep {
    constructor(accessToken, selectedPhotos) {
        this.api = new GooglePhotosAPI(accessToken);
        this.selectedPhotos = selectedPhotos;
        this.albumNameInput = document.getElementById('album-name-input');
        this.createAlbumButton = document.getElementById('create-album-button');
        this.setup();
    }

    displayElement() {
        return "destination-album-step"
    }

    setup() {
        // Set default album name
        this.albumNameInput.value = 'google-home';

        this.createAlbumButton.addEventListener('click', async () => {
            const albumName = this.albumNameInput.value.trim();
            
            // Check if album exists
            const albums = await this.api.getAlbums();
            let targetAlbum = albums.find(album => album.title === albumName);

            // Create album if it doesn't exist
            if (!targetAlbum) {
                targetAlbum = await this.api.createAlbum(albumName);
            }

            StepManager.transitionToStep(new ProcessCopyStep(
                this.api.accessToken,
                this.selectedPhotos,
                targetAlbum
            ));
        });
    }
}

const CLIENT_ID = '753842432555-gop0b5be9p1h315hrdm89ag1injqgj1b.apps.googleusercontent.com';
const SCOPES = 'https://www.googleapis.com/auth/photoslibrary https://www.googleapis.com/auth/photoslibrary.readonly.appcreateddata';

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
            StepManager.transitionToStep(new SelectImagesStep(this.accessToken));
        }
    }

    setup() {
        this.authorizeButton.onclick = () => {
            this.tokenClient.requestAccessToken();
        };
    }
}

class SelectImagesStep {
    constructor(accessToken) {
        this.pickerApi = new PhotosPickerAPI(accessToken);
        this.selectButton = document.getElementById('select-images-button');
        this.selectedPhotos = [];
        this.setup();
    }

    displayElement() {
        return "select-images-step"
    }

    async setup() {
        this.selectButton.addEventListener('click', async () => {
            const session = await this.pickerApi.createSession();
            window.open(session.pickerUri, '_blank');
            this.pollSession(session.id);
        });
    }

    async pollSession(sessionId) {
        const checkSession = async () => {
            const status = await this.pickerApi.checkSession(sessionId);
            
            if (status.mediaItemsSet) {
                const items = await this.pickerApi.getSelectedItems(sessionId);
                this.selectedPhotos = items.mediaItems;
                
                StepManager.transitionToStep(new DestinationAlbumStep(
                    this.pickerApi.accessToken,
                    this.selectedPhotos
                ));
            } else {
                setTimeout(checkSession, status.recommendedIntervalMs || 5000);
            }
        };
        
        checkSession();
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
    
    getHeaders() {
        return {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json'
        };
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

class PhotosPickerAPI {
    constructor(accessToken) {
        this.accessToken = accessToken;
        this.baseUrl = 'https://photoslibrary.googleapis.com/v1/photos/picker';
    }

    getHeaders() {
        return {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST',
            'Access-Control-Allow-Headers': 'Content-Type'
        };
    }

    async createSession() {
        const response = await fetch(`${this.baseUrl}/sessions`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify({
                mimeTypes: ['image/jpeg', 'image/png'],
                allowMultipleSelection: true
            })
        });
        return response.json();
    }

    async checkSession(sessionId) {
        const response = await fetch(`${this.baseUrl}/sessions/${sessionId}`, {
            headers: this.getHeaders()
        });
        return response.json();
    }

    async getSelectedItems(sessionId) {
        const response = await fetch(`${this.baseUrl}/sessions/${sessionId}/items`, {
            headers: this.getHeaders()
        });
        return response.json();
    }
}
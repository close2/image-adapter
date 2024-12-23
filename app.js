const CLIENT_ID = '753842432555-gop0b5be9p1h315hrdm89ag1injqgj1b.apps.googleusercontent.com';
const SCOPES = 'https://www.googleapis.com/auth/photospicker.mediaitems.readonly https://www.googleapis.com/auth/photoslibrary.readonly.appcreateddata https://www.googleapis.com/auth/photoslibrary.edit.appcreateddata'

class AuthStep {

    constructor() {
        console.log("AuthStep constructor");
        this.tokenClient = this.initializeGoogleAuth_();
        this.authorizeButton = document.getElementById('authorize');
    }

    displayElement() {
        return "auth-step"
    }

    initializeGoogleAuth_() {
        console.log("Initializing Google Auth");
        return google.accounts.oauth2.initTokenClient({
            client_id: CLIENT_ID,
            scope: SCOPES,
            callback: (response) => {
                console.log("Auth callback received", response);
                this.handleAuthCallback_(response)
            }
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
                
                console.log("Selected photos: ", JSON.stringify(this.selectedPhotos));

                StepManager.transitionToStep(new DestinationAlbumStep(
                    this.pickerApi.accessToken,
                    this.selectedPhotos
                ));
            } else {
                setTimeout(checkSession, status.pollingConfig.pollInterval || 5000);
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

            StepManager.transitionToStep(new ProcessImagesStep(
                this.api.accessToken,
                this.selectedPhotos,
                targetAlbum
            ));
        });
    }
}
class ProcessImagesStep {
    constructor(accessToken, selectedPhotos, destAlbum) {
        this.api = new GooglePhotosAPI(accessToken);
        this.selectedPhotos = selectedPhotos;
        this.destAlbum = destAlbum;
        this.processedImages = [];
        this.previewContainer = document.getElementById('preview-container');
        this.continueButton = document.getElementById('continue-to-copy-button');
    }

    displayElement() {
        return "process-preview-step"
    }

    async processImages() {
        const GOOGLE_HOME_RATIO = 16/9;
        
        for (const photo of this.selectedPhotos) {
            const processedImage = await this.processImage(photo, GOOGLE_HOME_RATIO);
            this.processedImages.push(processedImage);
            this.displayPreview(processedImage);
        }
    }
    
    displayPreview(imageBlob) {
        const img = document.createElement('img');
        img.src = URL.createObjectURL(imageBlob);
        img.className = 'preview-image';
        this.previewContainer.appendChild(img);
    }

    async processImage(image, targetRatio) {
        console.log("Processing image: ", JSON.stringify(image));

        const imageBlob = await this.api.fetchImage(image.mediaFile.baseUrl);
        const img = new Image();
        
        await new Promise((resolve) => {
            img.onload = resolve;
            img.src = URL.createObjectURL(imageBlob);
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

    async setup() {
        await this.processImages();
        this.continueButton.addEventListener('click', () => {
            StepManager.transitionToStep(new CopyImagesStep(
                this.api.accessToken,
                this.processedImages,
                this.destAlbum
            ));
        });
    }
}

class CopyImagesStep {
    constructor(accessToken, processedImages, destAlbum) {
        this.api = new GooglePhotosAPI(accessToken);
        this.processedImages = processedImages;
        this.destAlbum = destAlbum;
        this.progressElement = document.getElementById('copy-progress');
        this.statusElement = document.getElementById('copy-status');
    }

    displayElement() {
        return "copy-step"
    }

    async checkExistingImages() {
        this.updateStatus('Checking for existing images...');
        const existingMedia = await this.api.getAlbumMedia(this.destAlbum.id);
        return new Set(existingMedia?.map(item => item.description));
    }

    generateImageIdentifier(index) {
        return `google-home-adapted-${this.destAlbum.id}-${index}`;
    }

    async copyImages() {
        const existingImages = await this.checkExistingImages();
        let completed = 0;
        
        for (const [index, imageBlob] of this.processedImages.entries()) {
            const identifier = this.generateImageIdentifier(index);
            
            if (existingImages.has(identifier)) {
                this.updateStatus(`Skipping existing image ${completed + 1}/${this.processedImages.length}`);
                completed++;
                continue;
            }

            this.updateStatus(`Uploading image ${completed + 1}/${this.processedImages.length}`);
            const uploadToken = await this.api.uploadImage(imageBlob);
            
            this.updateStatus(`Creating media item ${completed + 1}/${this.processedImages.length}`);
            await this.api.createMediaItem(uploadToken, this.destAlbum.id, identifier);
            
            completed++;
            this.updateProgress(completed);
        }
        this.updateStatus('All images processed successfully!');
    }

    updateProgress(completed) {
        const percentage = (completed / this.processedImages.length) * 100;
        this.progressElement.textContent = `Progress: ${completed}/${this.processedImages.length} (${percentage.toFixed(1)}%)`;
    }

    updateStatus(message) {
        this.statusElement.textContent = message;
    }

    async setup() {
        this.updateStatus('Starting upload process...');
        await this.copyImages();
    }
}class StepManager {
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

    async fetchImage(imageUrl) {
        // Because of CORS we need to go through a proxy.
        // I've setup a proxy at https://cors.hexe.monster using the project https://github.com/close2/cloudflare-cors-anywhere
        const response = await fetch(`https://cors.hexe.monster/?${imageUrl}=w6400-h4800`, {
            headers: this.getHeaders()
        });
        return response.blob();
    }
}

class PhotosPickerAPI {
    constructor(accessToken) {
        this.accessToken = accessToken;
        this.baseUrl = 'https://photospicker.googleapis.com/v1';
    }

    getHeaders() {
        return {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json'
        };
    }

    async createSession() {
        const response = await fetch(`${this.baseUrl}/sessions`, {
            method: 'POST',
            headers: this.getHeaders()
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
        const response = await fetch(`${this.baseUrl}/mediaItems?sessionId=${sessionId}`, {
            headers: this.getHeaders()
        });
        return response.json();
    }
}
const CLIENT_ID = '753842432555-gop0b5be9p1h315hrdm89ag1injqgj1b.apps.googleusercontent.com';
const SCOPES = 'https://www.googleapis.com/auth/photospicker.mediaitems.readonly https://www.googleapis.com/auth/photoslibrary.readonly.appcreateddata https://www.googleapis.com/auth/photoslibrary.edit.appcreateddata'

class AuthStep {
    constructor() {
        console.log("AuthStep constructor");
        this.tokenClient = this.initializeGoogleAuth_();
        this.authorizeButton = document.getElementById('authorize');
        this.switchAccountButton = document.getElementById('switch-account');
        this.loginStatus = document.getElementById('login-status');
        this.continueButton = document.getElementById('continue-button');
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
            localStorage.setItem('googleAccessToken', response.access_token);
            StepManager.transitionToStep(new SelectImagesStep(this.accessToken));
        }
    }

    setup() {
        const storedToken = localStorage.getItem('googleAccessToken');
        if (storedToken) {
            this.authorizeButton.style.display = 'none';
            this.loginStatus.style.display = 'block';
            this.continueButton.style.display = 'block';
            
            this.continueButton.onclick = () => {
                this.handleAuthCallback_({ access_token: storedToken });
            };
        } else {
            this.authorizeButton.style.display = 'block';
            this.loginStatus.style.display = 'none';
            this.continueButton.style.display = 'none';
        }

        this.authorizeButton.onclick = () => {
            this.tokenClient.requestAccessToken();
        };

        this.switchAccountButton.onclick = () => {
            localStorage.removeItem('googleAccessToken');
            this.tokenClient.requestAccessToken({ prompt: 'select_account' });
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
        console.log("Setting up SelectImagesStep");
        console.trace();
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
        // Get stored album name
        const storedAlbumName = localStorage.getItem('lastUsedAlbum') || 'google-home';
        this.albumNameInput.value = storedAlbumName;

        this.createAlbumButton.addEventListener('click', async () => {
            const albumName = this.albumNameInput.value.trim();
            localStorage.setItem('lastUsedAlbum', albumName);
            
            const albums = await this.api.getAlbums();
            let targetAlbum = albums.find(album => album.title === albumName);

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
        this.statusElement = document.getElementById('process-status');
        this.backgroundStyle = localStorage.getItem('backgroundStyle') || 'black';
        
        // Add style selector
        this.styleSelector = document.getElementById('background-style');
        this.styleSelector.value = this.backgroundStyle;
        this.styleSelector.addEventListener('change', () => {
            this.backgroundStyle = this.styleSelector.value;
            localStorage.setItem('backgroundStyle', this.backgroundStyle);
            this.reprocessImages();
        });
        
        this.continueButton.disabled = true;
    }

    displayElement() {
        return "process-preview-step"
    }

    async processImages() {
        this.continueButton.disabled = true;

        const GOOGLE_HOME_RATIO = 16/9;
        const total = this.selectedPhotos.length;
        
        for (const photo of this.selectedPhotos) {
            this.updateStatus(`Processing image ${this.processedImages.length + 1}/${total}`);
            const processedImage = await this.processImage(photo, GOOGLE_HOME_RATIO);
            
            // Create identifier from filename and id if available
            const identifier = `google-home-adapted-${this.backgroundStyle}-${photo.mediaFile.filename}-${photo.id || ''}`;
            
            this.processedImages.push({
                blob: processedImage,
                identifier: identifier,
                originalPhoto: photo
            });
            
            this.displayPreview(processedImage);
        }
        
        this.updateStatus(`Completed processing ${total} images`);
        this.continueButton.disabled = false;
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
            ctx.drawImage(img, 0, blackSpace);
            this.fillBars(ctx, canvas.width, blackSpace, true);
            ctx.drawImage(img, 0, blackSpace);
        } else {
            newWidth = img.height * targetRatio;
            canvas.width = newWidth;
            canvas.height = img.height;
        
            const blackSpace = (newWidth - img.width) / 2;
            ctx.drawImage(img, blackSpace, 0);
            this.fillBars(ctx, blackSpace, canvas.height, false);
            ctx.drawImage(img, blackSpace, 0);
        }
    
        return new Promise(resolve => {
            canvas.toBlob(resolve, 'image/jpeg', 0.95);
        });
    }    

    fillBars(ctx, width, size, isVertical) {
        if (this.backgroundStyle === 'black') {
            ctx.fillStyle = 'black';
            if (isVertical) {
                ctx.fillRect(0, 0, width, size);
                ctx.fillRect(0, ctx.canvas.height - size, width, size);
            } else {
                ctx.fillRect(0, 0, size, ctx.canvas.height);
                ctx.fillRect(ctx.canvas.width - size, 0, size, ctx.canvas.height);
            }
            return;
        }

        if (isVertical) {
            // Sample colors along the top and bottom edges
            const numSamples = width;
            const topColors = [];
            const bottomColors = [];
            
            for (let x = 0; x < width; x++) {
                topColors.push(ctx.getImageData(x, size, 1, 1).data);
                bottomColors.push(ctx.getImageData(x, ctx.canvas.height - size - 1, 1, 1).data);
            }

            // Create gradients for top and bottom bars
            for (let x = 0; x < width; x++) {
                const topGradient = ctx.createLinearGradient(0, 0, 0, size);
                topGradient.addColorStop(0, 'black');
                topGradient.addColorStop(1, `rgba(${topColors[x][0]}, ${topColors[x][1]}, ${topColors[x][2]}, 1)`);
                
                const bottomGradient = ctx.createLinearGradient(0, ctx.canvas.height - size, 0, ctx.canvas.height);
                bottomGradient.addColorStop(0, `rgba(${bottomColors[x][0]}, ${bottomColors[x][1]}, ${bottomColors[x][2]}, 1)`);
                bottomGradient.addColorStop(1, 'black');
                
                ctx.fillStyle = topGradient;
                ctx.fillRect(x, 0, 1, size);
                ctx.fillStyle = bottomGradient;
                ctx.fillRect(x, ctx.canvas.height - size, 1, size);
            }
        } else {
            // Sample colors along the left and right edges
            const numSamples = ctx.canvas.height;
            const leftColors = [];
            const rightColors = [];
            
            for (let y = 0; y < ctx.canvas.height; y++) {
                leftColors.push(ctx.getImageData(size, y, 1, 1).data);
                rightColors.push(ctx.getImageData(ctx.canvas.width - size - 1, y, 1, 1).data);
            }

            // Create gradients for left and right bars
            for (let y = 0; y < ctx.canvas.height; y++) {
                const leftGradient = ctx.createLinearGradient(0, 0, size, 0);
                leftGradient.addColorStop(0, 'black');
                leftGradient.addColorStop(1, `rgba(${leftColors[y][0]}, ${leftColors[y][1]}, ${leftColors[y][2]}, 1)`);
                
                const rightGradient = ctx.createLinearGradient(ctx.canvas.width - size, 0, ctx.canvas.width, 0);
                rightGradient.addColorStop(0, `rgba(${rightColors[y][0]}, ${rightColors[y][1]}, ${rightColors[y][2]}, 1)`);
                rightGradient.addColorStop(1, 'black');
                
                ctx.fillStyle = leftGradient;
                ctx.fillRect(0, y, size, 1);
                ctx.fillStyle = rightGradient;
                ctx.fillRect(ctx.canvas.width - size, y, size, 1);
            }
        }
    } 
    
    updateStatus(message) {
        this.statusElement.textContent = message;
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

    async reprocessImages() {
        this.processedImages = [];
        this.previewContainer.innerHTML = '';
        await this.processImages();
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

    async copyImages() {
        const existingImages = await this.checkExistingImages();
        let completed = 0;
        
        for (const processedImage of this.processedImages) {
            const blob = processedImage.blob
            const identifier = processedImage.identifier;

            if (existingImages.has(identifier)) {
                this.updateStatus(`Skipping existing image ${completed + 1}/${this.processedImages.length}`);
                completed++;
                continue;
            }

            this.updateStatus(`Uploading image ${completed + 1}/${this.processedImages.length}`);
            const uploadToken = await this.api.uploadImage(blob);
            
            this.updateStatus(`Creating media item ${completed + 1}/${this.processedImages.length}`);
            await this.api.createMediaItem(uploadToken, this.destAlbum.id, identifier);
            
            completed++;
            this.updateProgress(completed);
        }

        this.updateStatus('All images processed successfully!');

        StepManager.transitionToStep(new CleanupStep(
            this.api.accessToken,
            this.processedImages,
            this.destAlbum
        ));
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
}


class CleanupStep {
    constructor(accessToken, processedImages, destAlbum) {
        this.api = new GooglePhotosAPI(accessToken);
        this.processedImages = processedImages;
        this.destAlbum = destAlbum;
        this.previewContainer = document.getElementById('cleanup-preview-container');
        this.deleteButton = document.getElementById('delete-old-images-button');
        this.skipButton = document.getElementById('skip-cleanup-button');
        this.unselectedImages = [];
    }

    displayElement() {
        return "cleanup-step"
    }

    async findUnselectedImages() {
        const allAlbumMedia = await this.api.getAlbumMedia(this.destAlbum.id);
        
        // Generate the set of identifiers for the current selection
        const processedIdentifiers = new Set(
            this.processedImages.map((_) => _.identifier)
        );
        
        // Filter images whose description (identifier) is not in the current selection
        this.unselectedImages = allAlbumMedia.filter(item => 
            !processedIdentifiers.has(item.description)
        );
    }

    displayUnselectedPreviews() {
        this.previewContainer.innerHTML = '';
        this.unselectedImages.forEach(image => {
            const img = document.createElement('img');
            img.src = `${image.baseUrl}=w200-h200`;
            img.className = 'preview-image';
            this.previewContainer.appendChild(img);
        });
    }

    async deleteUnselectedImages() {
        const imageIds = this.unselectedImages.map(img => img.id);
        await this.api.removeMediaItems(this.destAlbum.id, imageIds);
    }

    async setup() {
        await this.findUnselectedImages();
        
        if (this.unselectedImages.length === 0) {
            this.previewContainer.innerHTML = '<p>No old images found to clean up!</p>';
            return;
        }

        this.displayUnselectedPreviews();
        
        this.deleteButton.addEventListener('click', async () => {
            await this.deleteUnselectedImages();
            this.previewContainer.innerHTML = '<p>Old images deleted successfully!</p>';
        });
    }
}


class StepManager {
    static transitionToStep(step) {
        console.log("Switching to step: " + step.displayElement());
        
        // Hide all steps
        document.querySelectorAll('.step').forEach(step => step.classList.remove('active'));
        
        // Show current step
        document.getElementById(step.displayElement()).classList.add('active');
        
        // Update step indicator
        const currentStepItem = document.querySelector(`[data-step="${step.displayElement()}"]`);
        document.querySelectorAll('.step-item').forEach(item => {
            item.classList.remove('active');
            if (item.dataset.step === step.displayElement()) {
                item.classList.add('active');
            } else if (Array.from(document.querySelectorAll('.step-item'))
                .indexOf(item) < Array.from(document.querySelectorAll('.step-item'))
                .indexOf(currentStepItem)) {
                item.classList.add('done');
            }
        });
        
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

    async createMediaItem(uploadToken, albumId, description) {
        const response = await fetch(`${this.baseUrl}/mediaItems:batchCreate`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify({
                albumId: albumId,
                newMediaItems: [{
                    description: description,
                    simpleMediaItem: {
                        uploadToken: uploadToken
                    }
                }]
            })
        });
        return response.json();
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

    async removeMediaItems(albumId, mediaItemIds) {
        return fetch(`${this.baseUrl}/albums/${albumId}:batchRemoveMediaItems`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify({
                mediaItemIds: mediaItemIds
            })
        });
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


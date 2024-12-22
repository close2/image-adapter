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
        this.api = new GooglePhotosAPI(accessToken);
        this.albumNextButton = document.getElementById('albumNext');
        this.loadAlbums();
        this.setup();
    }

    displayElement() {
        return "album-select-step"
    }

    async loadAlbums() {
        const albums = await this.api.getAlbums();
        this.renderAlbumSelectors(albums);
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
            const sourceAlbum = document.getElementById('source-album');
            const destAlbum = document.getElementById('dest-album');
            StepManager.transitionToStep(new PreviewStep(
                this.api.accessToken,
                {
                    id: sourceAlbum.value,
                    title: sourceAlbum.options[sourceAlbum.selectedIndex].text
                },
                {
                    id: destAlbum.value,
                    title: destAlbum.options[destAlbum.selectedIndex].text
                }
            ));
        });
    }
}

class PreviewStep {
    constructor(accessToken, sourceAlbum, destAlbum) {
        this.api = new GooglePhotosAPI(accessToken);
        this.sourceAlbum = sourceAlbum;
        this.destAlbum = destAlbum;
        this.previewNextButton = document.getElementById('previewNext');
        this.previewContainer = document.getElementById('preview-container');
        this.selectedImages = new Set();
        this.loadSourceImages();
        this.setup();
    }

    displayElement() {
        return "preview-step"
    }

    setup() {
        this.previewNextButton.addEventListener('click', () => {
            StepManager.transitionToStep(new ProcessCopyStep(
                this.api.accessToken,
                Array.from(this.selectedImages),
                this.destAlbum
            ));
        });
    }

    async loadSourceImages() {
        const mediaItems = await this.api.getAlbumMedia(this.sourceAlbum.id);
        this.renderPreviews(mediaItems);
    }

    renderPreviews(mediaItems) {
        this.previewContainer.innerHTML = '';
        
        mediaItems.forEach(item => {
            const previewCard = document.createElement('div');
            previewCard.className = 'preview-card';
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = true;
            checkbox.dataset.imageId = item.id;
            checkbox.addEventListener('change', () => this.toggleImageSelection(item));
            
            const img = document.createElement('img');
            img.src = `${item.baseUrl}=w200-h200`;
            img.alt = item.filename;
            
            const title = document.createElement('div');
            title.className = 'preview-title';
            title.textContent = item.filename;
            
            previewCard.appendChild(checkbox);
            previewCard.appendChild(img);
            previewCard.appendChild(title);
            this.previewContainer.appendChild(previewCard);
            
            this.selectedImages.add(item);
        });
    }

    toggleImageSelection(item) {
        if (this.selectedImages.has(item)) {
            this.selectedImages.delete(item);
        } else {
            this.selectedImages.add(item);
        }
    }
}

class ProcessCopyStep {
    constructor(accessToken, selectedImages, destAlbum) {
        this.api = new GooglePhotosAPI(accessToken);
        this.selectedImages = selectedImages;
        this.destAlbum = destAlbum;
        this.processImages();
    }

    displayElement() {
        return "process-step"
    }

    async processImages() {
        const GOOGLE_HOME_RATIO = 16/9;
        
        for (const image of this.selectedImages) {
            const processedImage = await this.processImage(image, GOOGLE_HOME_RATIO);
            await this.uploadToAlbum(processedImage);
        }
    }

    async processImage(image, targetRatio) {
        const baseUrl = `${image.baseUrl}=w${image.mediaMetadata.width}-h${image.mediaMetadata.height}`;
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
}

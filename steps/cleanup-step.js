import { StepManager } from '../step-manager.js';
import { GooglePhotosAPI } from '../api/google-photos-api.js';

export class CleanupStep {
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


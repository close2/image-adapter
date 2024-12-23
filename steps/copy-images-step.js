import { StepManager } from '../step-manager.js';
import { GooglePhotosAPI } from '../api/google-photos-api.js';
import { CleanupStep } from './cleanup-step.js';

export class CopyImagesStep {
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


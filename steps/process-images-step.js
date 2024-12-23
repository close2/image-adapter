import { StepManager } from '../step-manager.js';
import { GooglePhotosAPI } from '../api/google-photos-api.js';
import { CopyImagesStep } from './copy-images-step.js';

export class ProcessImagesStep {
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

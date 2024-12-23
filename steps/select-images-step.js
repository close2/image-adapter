import { StepManager } from '../step-manager.js';
import { PhotosPickerAPI } from '../api/photos-picker-api.js';
import { DestinationAlbumStep } from './destination-album-step.js';

export class SelectImagesStep {
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

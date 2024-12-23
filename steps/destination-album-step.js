import { StepManager } from '../step-manager.js';
import { GooglePhotosAPI } from '../api/google-photos-api.js';
import { ProcessImagesStep } from './process-images-step.js';

export class DestinationAlbumStep {
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

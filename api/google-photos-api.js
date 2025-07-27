export class GooglePhotosAPI {
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
        return data.albums || [];
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

    async updateMediaItemDescription(mediaItemId, description) {
        // Because of CORS we need to go through a proxy.
        // I've setup a proxy at https://cors.hexe.monster using the project https://github.com/close2/cloudflare-cors-anywhere
        return fetch(`https://cors.hexe.monster/?${this.baseUrl}/mediaItems/${mediaItemId}?updateMask=description`, {
            method: 'PATCH',
            headers: {
                ...this.getHeaders(),
                'X-Goog-Field-Mask': 'description'
            },
            body: JSON.stringify({
                description: `${description}`
            })
        });
    }
}



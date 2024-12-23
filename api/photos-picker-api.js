export class PhotosPickerAPI {
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

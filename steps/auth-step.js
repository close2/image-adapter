import { CLIENT_ID, SCOPES } from '../constants.js';
import { StepManager } from '../step-manager.js';
import { SelectImagesStep } from './select-images-step.js';

export class AuthStep {
    constructor() {
        console.log("AuthStep constructor");
        this.tokenClient = this.initializeGoogleAuth_();
        this.authorizeButton = document.getElementById('authorize');
        this.switchAccountButton = document.getElementById('switch-account');
        this.loginStatus = document.getElementById('login-status');
        this.continueButton = document.getElementById('continue-button');
        this.userInfoElement = document.getElementById('user-info');
    }

    displayElement() {
        return "auth-step"
    }


    async handleAuthCallback_(response) {
        if (response.access_token) {
            this.accessToken = response.access_token;
            localStorage.setItem('googleAccessToken', response.access_token);
            StepManager.transitionToStep(new SelectImagesStep(this.accessToken));
        }
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

    async checkTokenValidity(accessToken) {
        try {
            const response = await fetch('https://oauth2.googleapis.com/tokeninfo?access_token=' + accessToken);
            const tokenInfo = await response.json();
            return tokenInfo && tokenInfo.expires_in > 0;
        } catch (error) {
            console.log('Token validation error:', error);
            return false;
        }
    }

    handleCredentialResponse(response) {
        const payload = google.accounts.id.decode(response.credential);
        if (this.userInfoElement && payload) {
            this.userInfoElement.textContent = `Logged in as: ${payload.email}`;
            this.userInfoElement.style.display = 'block';
        }
    }

    async setup() {
        const storedToken = localStorage.getItem('googleAccessToken');
        
        if (storedToken && await this.checkTokenValidity(storedToken)) {
            this.authorizeButton.style.display = 'none';
            this.loginStatus.style.display = 'block';
            this.continueButton.style.display = 'block';
            this.continueButton.addEventListener('click', () => {
                StepManager.transitionToStep(new SelectImagesStep(storedToken));
            });
        } else {
            localStorage.removeItem('googleAccessToken');
            this.showLoginButtons();
        }

        this.authorizeButton.onclick = () => {
            this.tokenClient.requestAccessToken({ prompt: 'select_account' });
        };

        this.switchAccountButton.onclick = () => {
            localStorage.removeItem('googleAccessToken');
            this.tokenClient.requestAccessToken({ prompt: 'select_account' });
        };
    }
    showLoginButtons() {
        this.authorizeButton.style.display = 'block';
        this.loginStatus.style.display = 'none';
        this.continueButton.style.display = 'none';
        if (this.userInfoElement) {
            this.userInfoElement.style.display = 'none';
        }
    }
}
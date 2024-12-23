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

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
        return google.accounts.oauth2.hasGrantedAllScopes(
            accessToken,
            SCOPES.split(' ')
        );
    }

    async updateUserInfo(accessToken) {
        const isValid = await this.checkTokenValidity(accessToken);
        if (isValid) {
            // Use the token to fetch user info from Google's userinfo endpoint
            const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            });
            const userInfo = await response.json();
            if (this.userInfoElement) {
                this.userInfoElement.textContent = `Logged in as: ${userInfo.email}`;
                this.userInfoElement.style.display = 'block';
            }
            return true;
        }
        return false;
    }

    async setup() {
        const storedToken = localStorage.getItem('googleAccessToken');
        
        if (storedToken && await this.checkTokenValidity(storedToken)) {
            await this.updateUserInfo(storedToken);
            this.authorizeButton.style.display = 'none';
            this.loginStatus.style.display = 'block';
            this.continueButton.style.display = 'block';
            
            this.continueButton.onclick = () => {
                this.handleAuthCallback_({ access_token: storedToken });
            };
        } else {
            localStorage.removeItem('googleAccessToken');
            this.showLoginButtons();
        }

        this.authorizeButton.onclick = () => {
            this.tokenClient.requestAccessToken();
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

    async handleAuthCallback_(response) {
        if (response.access_token) {
            this.accessToken = response.access_token;
            localStorage.setItem('googleAccessToken', response.access_token);
            await this.updateUserInfo();
            StepManager.transitionToStep(new SelectImagesStep(this.accessToken));
        }
    }
}
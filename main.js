import { AuthStep } from './steps/auth-step.js';
import { StepManager } from './step-manager.js';

document.addEventListener('DOMContentLoaded', () => {
    StepManager.transitionToStep(new AuthStep());
});

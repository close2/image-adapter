export class StepManager {
    static transitionToStep(step) {
        console.log("Switching to step: " + step.displayElement());
        
        // Hide all steps
        document.querySelectorAll('.step').forEach(step => step.classList.remove('active'));
        
        // Show current step
        document.getElementById(step.displayElement()).classList.add('active');
        
        // Update step indicator
        const currentStepItem = document.querySelector(`[data-step="${step.displayElement()}"]`);
        document.querySelectorAll('.step-item').forEach(item => {
            item.classList.remove('active');
            if (item.dataset.step === step.displayElement()) {
                item.classList.add('active');
            } else if (Array.from(document.querySelectorAll('.step-item'))
                .indexOf(item) < Array.from(document.querySelectorAll('.step-item'))
                .indexOf(currentStepItem)) {
                item.classList.add('done');
            }
        });
        
        step.setup();
    }
}

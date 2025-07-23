/**
 * Override Manager - Handles admin space override functionality
 */

class OverrideManager {
    constructor() {
        this.overrideElement = null;
        this.inputElement = null;
        this.init();
    }

    /**
     * Initialize the override manager
     */
    init() {
        // Wait for DOM and dependencies to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.waitForDependencies());
        } else {
            this.waitForDependencies();
        }
    }

    /**
     * Wait for required dependencies to be available
     */
    waitForDependencies() {
        if (window.Utils && window.CONFIG) {
            this.createOverrideUI();
        } else {
            // Retry after a short delay
            setTimeout(() => this.waitForDependencies(), 100);
        }
    }

    /**
     * Create and inject the override UI
     */
    createOverrideUI() {
        const container = document.querySelector('.container');
        const spacesContainer = document.querySelector('.spaces-container');
        
        if (!container || !spacesContainer) {
            console.warn('Override Manager: Required elements not found');
            return;
        }

        // Create override section HTML
        const overrideHTML = `
            <div class="admin-override-section">
                <div class="override-container">
                    <input type="text" 
                           id="overrideInput" 
                           placeholder="https://x.com/i/spaces/..." 
                           class="override-input">
                    <button class="btn btn-secondary override-btn">Add Override</button>
                </div>
            </div>
        `;

        // Insert before spaces container
        spacesContainer.insertAdjacentHTML('beforebegin', overrideHTML);

        // Get references to elements
        this.overrideElement = document.querySelector('.admin-override-section');
        this.inputElement = document.getElementById('overrideInput');
        const buttonElement = document.querySelector('.override-btn');

        // Set up event listeners
        if (buttonElement) {
            buttonElement.addEventListener('click', () => this.submitOverride());
        }

        if (this.inputElement) {
            this.inputElement.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.submitOverride();
                }
            });
        }
    }

    /**
     * Submit override to API
     */
    async submitOverride() {
        if (!this.inputElement) return;

        const url = this.inputElement.value.trim();
        
        if (!url) return;
        
        try {
            const response = await fetch('https://jv5hzflmnb.execute-api.us-east-2.amazonaws.com/prod/spaces/override', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ url: url })
            });
            
            // Try to get response text regardless of status
            const responseText = await response.text();
            
            if (response.ok) {
                Utils.showMessage('Override added successfully', CONFIG.MESSAGE_TYPES.SUCCESS);
                this.inputElement.value = '';
            } else {
                // Show the actual error from the server
                let errorMessage = `Failed to add override (${response.status})`;
                try {
                    const errorData = JSON.parse(responseText);
                    if (errorData.error) {
                        errorMessage += `: ${errorData.error}`;
                    }
                } catch (e) {
                    // If response isn't JSON, show raw text
                    if (responseText) {
                        errorMessage += `: ${responseText}`;
                    }
                }
                Utils.showMessage(errorMessage);
            }
        } catch (error) {
            Utils.showMessage(`Network error: ${error.message}`);
        }
    }
}

// Initialize override manager
const overrideManager = new OverrideManager();

// Make globally available for debugging
window.overrideManager = overrideManager;
/**
 * Main application initialization and event handling
 * Updated to reduce annoying auto-updates and ensure proper dashboard initialization
 */

class App {
    constructor() {
        this.isInitialized = false;
        // Removed auto-refresh properties
        this.init();
    }

    /**
     * Initialize the application
     */
    async init() {
        try {
            // Wait for DOM to be ready
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => this.start());
            } else {
                await this.start();
            }
        } catch (error) {
            console.error('Failed to initialize app:', error);
            Utils.showMessage('Failed to initialize application');
        }
    }

    /**
     * Start the application
     */
    async start() {
        if (this.isInitialized) return;

        try {
            // Ensure dashboard is available before proceeding
            if (typeof dashboard === 'undefined') {
                console.error('Dashboard not available, retrying in 100ms...');
                setTimeout(() => this.start(), 100);
                return;
            }

            Utils.showMessage('Loading data...', CONFIG.MESSAGE_TYPES.SUCCESS);
            
            // Load audio files mapping first (now supports all formats)
            await api.loadAudioFiles();
            
            // Load initial data
            await Promise.all([
                // dashboard.loadHealth(),
                // dashboard.loadStats(),
                dashboard.loadSpaces()
            ]);

            this.setupEventListeners();
            this.isInitialized = true;
            
            // Removed auto-refresh interval setup
        } catch (error) {
            console.error('Failed to start application:', error);
            Utils.showMessage(`Failed to load initial data: ${error.message}`);
        }
    }

    /**
     * Set up event listeners for the application
     */
    setupEventListeners() {
        // Basic connectivity handling only
        window.addEventListener('online', () => {
            Utils.showMessage('Connection restored', CONFIG.MESSAGE_TYPES.SUCCESS);
        });

        window.addEventListener('offline', () => {
            Utils.showMessage('Connection lost - some features may not work');
        });

        // Removed all auto-refresh and visibility change handling

        console.log('Event listeners set up successfully');
    }

    /**
     * Handle application errors
     * @param {Error} error - The error to handle
     * @param {string} context - Context where the error occurred
     */
    handleError(error, context = 'Unknown') {
        console.error(`Error in ${context}:`, error);
        Utils.showMessage(`Error in ${context}: ${error.message}`);
        
        // Could add error reporting here
        // this.reportError(error, context);
    }

    /**
     * Get application status - simplified without auto-refresh info
     */
    getStatus() {
        const audioMap = window.api ? api.getAudioFilesMap() : {};
        const formatCounts = {};
        
        // Count files by format
        Object.values(audioMap).forEach(audioInfo => {
            const format = audioInfo.format || 'unknown';
            formatCounts[format] = (formatCounts[format] || 0) + 1;
        });
        
        return {
            isInitialized: this.isInitialized,
            spacesCount: window.dashboard ? dashboard.allSpaces.length : 0,
            audioFilesCount: Object.keys(audioMap).length,
            formatBreakdown: formatCounts,
            timestamp: new Date().toISOString()
        };
    }
}

// Global error handler
window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
    Utils.showMessage('An unexpected error occurred');
});

// Global unhandled promise rejection handler
window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
    Utils.showMessage('An unexpected error occurred');
});

// Initialize the application
const app = new App();

// Make app globally available for debugging
window.app = app;
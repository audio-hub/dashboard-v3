/**
 * Enhanced application initialization with participants support
 * Updated to use the new parallel API loading for spaces and participants
 */

class App {
    constructor() {
        this.isInitialized = false;
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

            Utils.showMessage('Loading data and participants...', CONFIG.MESSAGE_TYPES.SUCCESS);
            
            // Load audio files mapping first (now supports all formats)
            await api.loadAudioFiles();
            
            // Load initial data with participants using the enhanced method
            await Promise.all([
                dashboard.loadSpaces() // This now uses getSpacesWithParticipants internally
            ]);

            this.setupEventListeners();
            this.isInitialized = true;
            
            console.log('✅ Application initialized successfully with participants support');
            Utils.showMessage('Dashboard loaded with participant data!', CONFIG.MESSAGE_TYPES.SUCCESS);
            
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
     * Get application status - enhanced with participant cache info
     */
    getStatus() {
        const audioMap = window.api ? api.getAudioFilesMap() : {};
        const participantsCache = window.api ? api.getParticipantsCache() : {};
        const formatCounts = {};
        
        // Count files by format
        Object.values(audioMap).forEach(files => {
            if (Array.isArray(files)) {
                files.forEach(audioInfo => {
                    const format = audioInfo.filename?.split('.').pop()?.toLowerCase() || 'unknown';
                    formatCounts[format] = (formatCounts[format] || 0) + 1;
                });
            }
        });
        
        // Count participants cache
        const participantsCacheSize = Object.keys(participantsCache).length;
        const spacesWithParticipants = Object.values(participantsCache).filter(p => p !== null).length;
        
        return {
            isInitialized: this.isInitialized,
            spacesCount: window.dashboard ? dashboard.allSpaces.length : 0,
            audioFilesCount: Object.keys(audioMap).length,
            formatBreakdown: formatCounts,
            participantsCacheSize: participantsCacheSize,
            spacesWithParticipants: spacesWithParticipants,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Refresh data manually - useful for debugging or manual updates
     */
    async refreshData() {
        try {
            Utils.showMessage('Refreshing data...', CONFIG.MESSAGE_TYPES.SUCCESS);
            
            // Clear caches
            if (window.api) {
                api.participantsCache = {};
            }
            
            // Reload data
            await api.loadAudioFiles();
            await dashboard.loadSpaces();
            
            Utils.showMessage('Data refreshed successfully!', CONFIG.MESSAGE_TYPES.SUCCESS);
        } catch (error) {
            console.error('Failed to refresh data:', error);
            Utils.showMessage(`Failed to refresh data: ${error.message}`);
        }
    }

    /**
     * Debug method to show participants cache status
     */
    debugParticipantsCache() {
        const cache = api.getParticipantsCache();
        const stats = {
            totalEntries: Object.keys(cache).length,
            successfulEntries: Object.values(cache).filter(p => p !== null).length,
            failedEntries: Object.values(cache).filter(p => p === null).length,
            sampleEntry: Object.keys(cache)[0] ? {
                spaceId: Object.keys(cache)[0],
                hasData: cache[Object.keys(cache)[0]] !== null,
                participantCount: cache[Object.keys(cache)[0]]?.totalParticipants || 0
            } : null
        };
        
        console.log('Participants Cache Debug:', stats);
        modal.showDebugInfo(`
Participants Cache Status:

Total Cache Entries: ${stats.totalEntries}
Successful API Calls: ${stats.successfulEntries}
Failed API Calls: ${stats.failedEntries}

${stats.sampleEntry ? `Sample Entry:
Space ID: ${stats.sampleEntry.spaceId}
Has Data: ${stats.sampleEntry.hasData}
Participant Count: ${stats.sampleEntry.participantCount}` : 'No cache entries found'}

Cache Keys: ${Object.keys(cache).slice(0, 5).join(', ')}${Object.keys(cache).length > 5 ? '...' : ''}
        `);
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

// Expose debug methods for console usage
window.debugParticipants = () => app.debugParticipantsCache();
window.refreshData = () => app.refreshData();
window.appStatus = () => console.log(app.getStatus());
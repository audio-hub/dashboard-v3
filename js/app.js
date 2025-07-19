/**
 * Updated application initialization with decoupled participant loading
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
     * Start the application with decoupled loading
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

            Utils.showMessage('Loading dashboard...', CONFIG.MESSAGE_TYPES.SUCCESS);
            
            // Load audio files mapping first
            await api.loadAudioFiles();
            
            // Load spaces immediately (without participants)
            // Participants will load in background automatically
            await dashboard.loadSpaces();

            this.setupEventListeners();
            this.isInitialized = true;
            
            console.log('✅ Application initialized successfully with decoupled participant loading');
            Utils.showMessage('Dashboard loaded! Participants loading in background...', CONFIG.MESSAGE_TYPES.SUCCESS);
            
        } catch (error) {
            console.error('Failed to start application:', error);
            Utils.showMessage(`Failed to load initial data: ${error.message}`);
        }
    }

    /**
     * Set up event listeners for the application
     */
    setupEventListeners() {
        // Basic connectivity handling
        window.addEventListener('online', () => {
            Utils.showMessage('Connection restored', CONFIG.MESSAGE_TYPES.SUCCESS);
        });

        window.addEventListener('offline', () => {
            Utils.showMessage('Connection lost - some features may not work');
        });

        // Handle page visibility changes
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                // Page is hidden, cancel participant loading to save resources
                api.cancelParticipantLoading();
                console.log('🛑 Page hidden, cancelled participant loading');
            } else {
                // Page is visible again, resume participant loading if needed
                console.log('👁️ Page visible again');
                // Optionally restart participant loading for visible spaces
            }
        });

        console.log('Event listeners set up successfully');
    }

    /**
     * Handle application errors
     */
    handleError(error, context = 'Unknown') {
        console.error(`Error in ${context}:`, error);
        Utils.showMessage(`Error in ${context}: ${error.message}`);
    }

    /**
     * Get application status with participant loading info
     */
    getStatus() {
        const audioMap = window.api ? api.getAudioFilesMap() : {};
        const participantsCache = window.api ? api.getParticipantsCache() : {};
        const participantProgress = window.api ? api.getParticipantLoadingProgress() : {};
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
            participantLoading: {
                isLoading: participantProgress.isLoading || false,
                queueLength: participantProgress.queueLength || 0,
                cachedCount: participantsCacheSize,
                spacesWithParticipants: spacesWithParticipants,
                progress: participantProgress.progress || 'Not started'
            },
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Refresh data manually
     */
    async refreshData() {
        try {
            Utils.showMessage('Refreshing data...', CONFIG.MESSAGE_TYPES.SUCCESS);
            
            // Cancel any ongoing participant loading
            if (window.api) {
                api.cancelParticipantLoading();
                api.participantsCache = {};
            }
            
            // Reload data
            await api.loadAudioFiles();
            await dashboard.loadSpaces(); // This will restart participant loading automatically
            
            Utils.showMessage('Data refreshed successfully!', CONFIG.MESSAGE_TYPES.SUCCESS);
        } catch (error) {
            console.error('Failed to refresh data:', error);
            Utils.showMessage(`Failed to refresh data: ${error.message}`);
        }
    }

    /**
     * Force load participants for all visible spaces
     */
    async forceLoadParticipants() {
        if (!window.dashboard || !dashboard.allSpaces) {
            Utils.showMessage('No spaces loaded yet');
            return;
        }

        Utils.showMessage('Force loading participants...', CONFIG.MESSAGE_TYPES.SUCCESS);
        
        // Cancel existing loading
        api.cancelParticipantLoading();
        
        // Start fresh participant loading
        dashboard.startBackgroundParticipantLoading(dashboard.allSpaces);
        
        Utils.showMessage('Participant loading restarted', CONFIG.MESSAGE_TYPES.SUCCESS);
    }

    /**
     * Debug method to show participants loading status
     */
    debugParticipantsLoading() {
        const progress = api.getParticipantLoadingProgress();
        const cache = api.getParticipantsCache();
        
        const stats = {
            loadingStatus: progress,
            cacheStats: {
                totalEntries: Object.keys(cache).length,
                successfulEntries: Object.values(cache).filter(p => p !== null).length,
                failedEntries: Object.values(cache).filter(p => p === null).length
            },
            sampleCacheEntry: Object.keys(cache)[0] ? {
                spaceId: Object.keys(cache)[0],
                hasData: cache[Object.keys(cache)[0]] !== null,
                participantCount: cache[Object.keys(cache)[0]]?.totalParticipants || 0
            } : null
        };
        
        console.log('Participant Loading Debug:', stats);
        
        const debugInfo = `
Participant Loading Status:

Current Status: ${progress.isLoading ? 'LOADING' : 'IDLE'}
Queue Length: ${progress.queueLength}
Progress: ${progress.progress}

Cache Statistics:
Total Cache Entries: ${stats.cacheStats.totalEntries}
Successful API Calls: ${stats.cacheStats.successfulEntries}
Failed API Calls: ${stats.cacheStats.failedEntries}

${stats.sampleCacheEntry ? `Sample Cache Entry:
Space ID: ${stats.sampleCacheEntry.spaceId}
Has Data: ${stats.sampleCacheEntry.hasData}
Participant Count: ${stats.sampleCacheEntry.participantCount}` : 'No cache entries found'}

Commands:
- app.forceLoadParticipants() - Restart participant loading
- api.cancelParticipantLoading() - Cancel current loading
- api.getParticipantLoadingProgress() - Get detailed progress
        `;
        
        if (window.modal) {
            modal.showDebugInfo(debugInfo);
        } else {
            console.log(debugInfo);
        }
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
window.debugParticipants = () => app.debugParticipantsLoading();
window.refreshData = () => app.refreshData();
window.forceLoadParticipants = () => app.forceLoadParticipants();
window.cancelParticipants = () => api.cancelParticipantLoading();
window.appStatus = () => console.log(app.getStatus());
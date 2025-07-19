/**
 * Enhanced API Service with decoupled participant loading
 * - Spaces calls are completely independent from participants calls
 * - Participants are loaded serially (one after another)
 * - Background participant loading doesn't block UI updates
 */

class ApiService {
    constructor() {
        this.baseUrl = CONFIG.API_BASE_URL;
        this.s3BaseUrl = CONFIG.S3_BASE_URL;
        this.audioFilesMap = {};
        this.transcriptionMap = {};
        this.participantsCache = {};
        
        // Participant loading state management
        this.participantQueue = [];
        this.isLoadingParticipants = false;
        this.participantLoadingAbortController = null;
    }

    async makeRequest(endpoint, abortSignal = null) {
        try {
            const options = {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            };
            
            if (abortSignal) {
                options.signal = abortSignal;
            }
            
            const response = await fetch(this.baseUrl + endpoint, options);
            
            if (!response.ok) {
                let errorDetails = response.statusText;
                try {
                    const errorJson = await response.json();
                    if (errorJson.message) {
                        errorDetails = errorJson.message;
                    }
                } catch (e) {
                    // Ignore JSON parsing error, use statusText
                }
                throw new Error(`HTTP ${response.status}: ${errorDetails}`);
            }
            
            return await response.json();
        } catch (error) {
            if (error.name === 'AbortError') {
                console.log('Request was aborted:', endpoint);
                throw new Error('Request cancelled');
            }
            console.error('API Request failed:', error);
            throw error;
        }
    }

    async getHealth() {
        return await this.makeRequest('health/status');
    }

    async getStats() {
        return await this.makeRequest('stats');
    }

    async getSpaces(filters = {}) {
        let endpoint = 'spaces?';
        const params = [];
        
        if (filters.limit) params.push(`limit=${filters.limit}`);
        if (filters.offset) params.push(`offset=${filters.offset}`);
        if (filters.status) params.push(`status=${filters.status}`);
        
        endpoint += params.join('&');
        return await this.makeRequest(endpoint);
    }

    async getSpaceDetails(spaceId) {
        return await this.makeRequest(`spaces/${spaceId}`);
    }

    async getSpaceParticipants(spaceId, abortSignal = null) {
        // Check cache first
        if (this.participantsCache[spaceId]) {
            return this.participantsCache[spaceId];
        }

        try {
            const data = await this.makeRequest(`spaces/${spaceId}/participants`, abortSignal);
            // Cache the result
            this.participantsCache[spaceId] = data;
            return data;
        } catch (error) {
            // If 404 or other error, cache null to avoid repeated requests
            if (error.message.includes('404')) {
                this.participantsCache[spaceId] = null;
            }
            throw error;
        }
    }

    /**
     * COMPLETELY DECOUPLED: Load spaces without any participant data
     * This is now the main method used by dashboard
     */
    async getSpacesOnly(filters = {}) {
        console.log('🔄 Loading spaces only (no participants)');
        const spacesData = await this.getSpaces(filters);
        
        if (spacesData.data && spacesData.data.length > 0) {
            console.log(`✅ Loaded ${spacesData.data.length} spaces`);
        }
        
        return spacesData;
    }

    /**
     * Start background participant loading for a set of spaces
     * This runs independently and updates the UI as data becomes available
     */
    startBackgroundParticipantLoading(spaces, onParticipantLoaded = null) {
        if (!spaces || spaces.length === 0) return;
        
        // Cancel any existing participant loading
        this.cancelParticipantLoading();
        
        // Filter out spaces that already have participant data
        const spacesToLoad = spaces.filter(space => 
            !this.participantsCache[space._id] && space._id
        );
        
        if (spacesToLoad.length === 0) {
            console.log('✅ All spaces already have participant data or are invalid');
            return;
        }
        
        console.log(`🔄 Starting background participant loading for ${spacesToLoad.length} spaces`);
        
        // Set up abort controller for cancellation
        this.participantLoadingAbortController = new AbortController();
        
        // Add to queue and start processing
        this.participantQueue = spacesToLoad.map(space => ({
            spaceId: space._id,
            spaceTitle: space.title,
            onLoaded: onParticipantLoaded
        }));
        
        // Start serial processing
        this.processParticipantQueue();
    }

    /**
     * Process participant queue serially (one at a time)
     */
async processParticipantQueue() {
    if (this.isLoadingParticipants || this.participantQueue.length === 0) {
        return;
    }
    
    this.isLoadingParticipants = true;
    
    while (this.participantQueue.length > 0) {
        // Check if loading was cancelled
        if (this.participantLoadingAbortController?.signal.aborted) {
            console.log('🛑 Participant loading was cancelled');
            break;
        }
        
        // Get next batch of 5 items
        const batch = this.participantQueue.splice(0, 5);
        console.log(`🔄 Processing batch of ${batch.length} participants`);
        
        // Process all 5 simultaneously
        const batchPromises = batch.map(async (item) => {
            try {
                console.log(`🔄 Loading participants for space: ${item.spaceId}`);
                
                const participantsData = await this.getSpaceParticipants(
                    item.spaceId, 
                    this.participantLoadingAbortController?.signal
                );
                
                console.log(`✅ Loaded participants for space: ${item.spaceId} (${participantsData?.totalParticipants || 0} participants)`);
                
                // Notify callback if provided
                if (item.onLoaded && typeof item.onLoaded === 'function') {
                    item.onLoaded(item.spaceId, participantsData);
                }
                
            } catch (error) {
                if (error.message === 'Request cancelled') {
                    console.log('🛑 Participant loading cancelled');
                } else {
                    console.warn(`⚠️ Failed to load participants for space ${item.spaceId}:`, error.message);
                }
            }
        });
        
        // Wait for all 5 to complete
        await Promise.allSettled(batchPromises);
        
        // Small delay between batches
        if (this.participantQueue.length > 0) {
            await new Promise(resolve => setTimeout(resolve, 200));
        }
    }
    
    this.isLoadingParticipants = false;
    console.log('✅ Finished loading participants for all spaces');
}

    /**
     * Cancel any ongoing participant loading
     */
    cancelParticipantLoading() {
        if (this.participantLoadingAbortController) {
            console.log('🛑 Cancelling participant loading');
            this.participantLoadingAbortController.abort();
            this.participantLoadingAbortController = null;
        }
        
        this.participantQueue = [];
        this.isLoadingParticipants = false;
    }

    /**
     * Check if participant loading is in progress
     */
    isLoadingParticipantsInBackground() {
        return this.isLoadingParticipants;
    }

    /**
     * Get participant loading progress
     */
    getParticipantLoadingProgress() {
        const totalQueued = this.participantQueue.length;
        const cached = Object.keys(this.participantsCache).length;
        
        return {
            isLoading: this.isLoadingParticipants,
            queueLength: totalQueued,
            cachedCount: cached,
            progress: totalQueued > 0 ? `${cached} loaded, ${totalQueued} remaining` : 'Complete'
        };
    }

    async getFiles() {
        return await this.makeRequest('files');
    }

    /**
     * Extracts spaceId from filename
     */
    extractSpaceIdFromFilename(filename) {
        let cleanFilename = filename.replace(/\.(mp3|aac|m4a|mp4|json|csv)$/i, '');
        return cleanFilename.split('-')[0];
    }

    /**
     * Loads audio files and transcription files, grouping them by spaceId
     */
    async loadAudioFiles() {
        try {
            console.log('🔄 Loading audio files and transcriptions...');
            const data = await this.getFiles();
            this.audioFilesMap = {};
            this.transcriptionMap = {};

            if (data.files && Array.isArray(data.files)) {
                console.log('📁 Processing files:', data.files.length);
                
                data.files.forEach(file => {
                    const filePath = file.name;
                    const parts = filePath.split('/');
                    
                    if (parts.length >= 3) {
                        const hostUsername = parts[0];
                        const date = parts[1];
                        const filename = parts[2];
                        
                        // Process audio files
                        if (/\.(mp3|aac|m4a|mp4)$/i.test(filename)) {
                            const spaceId = this.extractSpaceIdFromFilename(filename);
                            const audioInfo = {
                                url: this.s3BaseUrl + filePath,
                                filename: filename,
                                path: filePath,
                                size: file.size || null,
                                lastModified: file.lastModified || null
                            };
                            
                            if (!this.audioFilesMap[spaceId]) {
                                this.audioFilesMap[spaceId] = [];
                            }
                            
                            const exists = this.audioFilesMap[spaceId].some(existing => 
                                existing.url === audioInfo.url
                            );
                            
                            if (!exists) {
                                this.audioFilesMap[spaceId].push(audioInfo);
                            }
                            
                            // Also add with composite key for fallback
                            const compositeKey = `${hostUsername}/${date}/${spaceId}`;
                            if (!this.audioFilesMap[compositeKey]) {
                                this.audioFilesMap[compositeKey] = [];
                            }
                            
                            const compositeExists = this.audioFilesMap[compositeKey].some(existing => 
                                existing.url === audioInfo.url
                            );
                            
                            if (!compositeExists) {
                                this.audioFilesMap[compositeKey].push(audioInfo);
                            }
                        }
                        
                        // Process transcription files (JSON and CSV)
                        else if (/\.(json|csv)$/i.test(filename)) {
                            const spaceId = this.extractSpaceIdFromFilename(filename);
                            const transcriptionInfo = {
                                url: this.s3BaseUrl + filePath,
                                filename: filename,
                                path: filePath,
                                size: file.size || null,
                                lastModified: file.lastModified || null
                            };
                            
                            // Store transcription (one per space)
                            this.transcriptionMap[spaceId] = transcriptionInfo;
                            
                            // Also add with composite key for fallback
                            const compositeKey = `${hostUsername}/${date}/${spaceId}`;
                            this.transcriptionMap[compositeKey] = transcriptionInfo;
                        }
                    }
                });
                
                const spacesWithAudio = Object.keys(this.audioFilesMap).filter(key => !key.includes('/')).length;
                const totalAudioFiles = Object.values(this.audioFilesMap).reduce((sum, files) => sum + files.length, 0);
                const spacesWithTranscription = Object.keys(this.transcriptionMap).filter(key => !key.includes('/')).length;
                
                console.log(`✅ Loaded ${totalAudioFiles} audio files for ${spacesWithAudio} spaces`);
                console.log(`✅ Loaded ${spacesWithTranscription} transcription files (JSON/CSV)`);
            }
        } catch (error) {
            console.error('Files loading error:', error);
            throw error;
        }
    }

    /**
     * Gets all audio files for a space
     */
    getAllAudioFilesBySpaceId(spaceId, hostUsername = null, createdAt = null) {
        // Try direct lookup first
        let audioFiles = this.audioFilesMap[spaceId];
        if (audioFiles && audioFiles.length > 0) {
            return [...audioFiles];
        }
        
        // Try composite key fallback
        if (hostUsername && createdAt) {
            const cleanHost = hostUsername.replace(/[@=]/g, '').toLowerCase();
            const date = new Date(createdAt).toISOString().split('T')[0];
            const compositeKey = `${cleanHost}/${date}/${spaceId}`;
            
            audioFiles = this.audioFilesMap[compositeKey];
            if (audioFiles && audioFiles.length > 0) {
                return [...audioFiles];
            }
        }
        
        return null;
    }

    /**
     * Gets transcription file for a space
     */
    getTranscriptionBySpaceId(spaceId, hostUsername = null, createdAt = null) {
        // Try direct lookup first
        let transcription = this.transcriptionMap[spaceId];
        if (transcription) {
            return transcription;
        }
        
        // Try composite key fallback
        if (hostUsername && createdAt) {
            const cleanHost = hostUsername.replace(/[@=]/g, '').toLowerCase();
            const date = new Date(createdAt).toISOString().split('T')[0];
            const compositeKey = `${cleanHost}/${date}/${spaceId}`;
            
            transcription = this.transcriptionMap[compositeKey];
            if (transcription) {
                return transcription;
            }
        }
        
        return null;
    }

    /**
     * Gets first audio file for backward compatibility
     */
    getAudioUrlBySpaceId(spaceId, hostUsername = null, createdAt = null) {
        const audioFiles = this.getAllAudioFilesBySpaceId(spaceId, hostUsername, createdAt);
        return audioFiles && audioFiles.length > 0 ? audioFiles[0] : null;
    }

    /**
     * Utility method to enhance image quality
     */
    enhanceImageQuality(imageUrl) {
        if (!imageUrl) return null;
        return imageUrl.replace('_normal.', '_400x400.');
    }

    /**
     * Gets cached participants data
     */
    getCachedParticipants(spaceId) {
        return this.participantsCache[spaceId] || null;
    }

    getAudioFilesMap() {
        return this.audioFilesMap;
    }

    getTranscriptionMap() {
        return this.transcriptionMap;
    }

    getParticipantsCache() {
        return this.participantsCache;
    }
}

const api = new ApiService();
window.api = api;
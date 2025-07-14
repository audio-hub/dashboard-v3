/**
 * Simple multi-source audio mapper with transcription support
 */

class ApiService {
    constructor() {
        this.baseUrl = CONFIG.API_BASE_URL;
        this.s3BaseUrl = CONFIG.S3_BASE_URL;
        this.audioFilesMap = {}; // Stores arrays of audio files per spaceId
        this.transcriptionMap = {}; // Stores transcription files per spaceId
    }

    async makeRequest(endpoint) {
        try {
            const response = await fetch(this.baseUrl + endpoint);
            
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

    async getSpaceParticipants(spaceId) {
        return await this.makeRequest(`spaces/${spaceId}/participants`);
    }

    async getFiles() {
        return await this.makeRequest('files');
    }

    /**
     * Extracts spaceId from filename
     */
    extractSpaceIdFromFilename(filename) {
        // Remove common audio extensions and transcript extensions
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
                Utils.showMessage(`Loaded ${totalAudioFiles} audio files and ${spacesWithTranscription} transcriptions`, CONFIG.MESSAGE_TYPES.SUCCESS);
            }
        } catch (error) {
            Utils.showMessage(`Failed to load files: ${error.message}`);
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

    getAudioFilesMap() {
        return this.audioFilesMap;
    }

    getTranscriptionMap() {
        return this.transcriptionMap;
    }
}

const api = new ApiService();
window.api = api;
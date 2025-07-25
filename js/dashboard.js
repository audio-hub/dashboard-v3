/**
 * Enhanced Dashboard with Robust Participant Loading During Scroll
 * - Tracks all spaces that need participant data
 * - Ensures no spaces are missed during rapid scrolling
 * - Implements retry logic for failed participant loads
 * - Provides better visual feedback for loading state
 */

class Dashboard {
    constructor() {
        this.allSpaces = [];
        this.statsSection = null;
        this.statsGrid = null;
        this.spacesContent = null;

        // Infinite scroll state
        this.currentOffset = 0;
        this.isLoading = false;
        this.hasMore = true;
        this.pageSize = 20;

        // Enhanced participant loading tracking
        this.participantLoadingIndicator = null;
        this.spacesNeedingParticipants = new Set(); // Track all spaces that need participants
        this.participantsLoadingQueue = new Map(); // Track loading status per space
        this.participantRetryAttempts = new Map(); // Track retry attempts
        this.maxRetryAttempts = 3;

        this.init();
    }

    /**
     * Initialize dashboard elements
     */
    init() {
        this.statsSection = Utils.getElementById('stats-section');
        this.statsGrid = Utils.getElementById('statsGrid');
        this.spacesContent = Utils.getElementById('spacesContent');

        // Set up infinite scroll
        this.setupInfiniteScroll();
        
        // Create participant loading indicator
        this.createParticipantLoadingIndicator();
        
        // Set up periodic participant queue check
        this.setupParticipantQueueMonitor();
        this.setupFilterIntegration();
    }
    /**
     * Setup filter integration
     */
    setupFilterIntegration() {
        // Wait for filter manager to be available
        const waitForFilters = () => {
            if (window.filterManager) {
                filterManager.setOnFilterChange((filters) => {
                    this.applyFilters(filters);
                });
            } else {
                setTimeout(waitForFilters, 100);
            }
        };
        waitForFilters();
    }

    /**
     * Apply filters to displayed spaces
     */
    applyFilters(filters) {
        if (!this.allSpaces || this.allSpaces.length === 0) return;
        
        const filteredSpaces = filterManager.applyFiltersToSpaces(this.allSpaces);
        const sortedSpaces = this.sortSpaces(filteredSpaces);
        this.displaySpaces(sortedSpaces, false);
        
        // Update participant tracking for filtered spaces
        this.spacesNeedingParticipants.clear();
        this.trackSpacesNeedingParticipants(sortedSpaces);
        this.startEnhancedParticipantLoading(sortedSpaces);
    }
    /**
     * Create a comprehensive loading indicator for background participant loading
     */
    createParticipantLoadingIndicator() {
        const indicator = document.createElement('div');
        indicator.id = 'participant-loading-indicator';
        indicator.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: rgba(52, 152, 219, 0.95);
            color: white;
            padding: 12px 20px;
            border-radius: 25px;
            font-size: 0.85rem;
            font-weight: 500;
            z-index: 1000;
            display: none;
            transition: all 0.3s ease;
            box-shadow: 0 4px 15px rgba(0,0,0,0.15);
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255,255,255,0.1);
            min-width: 200px;
            text-align: center;
        `;
        indicator.innerHTML = '🔄 Loading participants...';
        document.body.appendChild(indicator);
        
        this.participantLoadingIndicator = indicator;
    }

    /**
     * Enhanced participant loading indicator with detailed progress
     */
    updateParticipantLoadingIndicator() {
        if (!this.participantLoadingIndicator) return;
        
        const progress = api.getParticipantLoadingProgress();
        const needingCount = this.spacesNeedingParticipants.size;
        const loadingCount = this.participantsLoadingQueue.size;
        
        if (progress.isLoading || needingCount > 0 || loadingCount > 0) {
            const pendingText = needingCount > 0 ? ` (${needingCount} pending)` : '';
            const retryText = this.getRetryStatusText();
            
            this.participantLoadingIndicator.innerHTML = 
                `🔄 Loading participants... ${progress.progress}${pendingText}${retryText}`;
            this.participantLoadingIndicator.style.display = 'block';
        } else {
            this.participantLoadingIndicator.style.display = 'none';
        }
    }

    /**
     * Get retry status text for display
     */
    getRetryStatusText() {
        const retryCount = Array.from(this.participantRetryAttempts.values())
            .filter(attempts => attempts > 0).length;
        
        return retryCount > 0 ? ` (${retryCount} retrying)` : '';
    }

    /**
     * Set up periodic monitoring to ensure no spaces are left without participants
     */
    setupParticipantQueueMonitor() {
        setInterval(() => {
            this.processParticipantQueue();
            this.updateParticipantLoadingIndicator();
        }, 2000); // Check every 2 seconds
    }

    /**
     * Enhanced infinite scroll with participant loading coordination
     */
    setupInfiniteScroll() {
        window.addEventListener('scroll', Utils.debounce(() => {
            if (this.isLoading || !this.hasMore) return;

            const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
            const windowHeight = window.innerHeight;
            const documentHeight = document.documentElement.scrollHeight;

            // Load more when user is 300px from bottom
            if (scrollTop + windowHeight >= documentHeight - 300) {
                this.loadMoreSpaces();
            }
        }, 100));
    }

    /**
     * Process any spaces that still need participant data
     */
    async processParticipantQueue() {
        if (this.spacesNeedingParticipants.size === 0) return;

        // Convert set to array and take first few items
        const spacesToProcess = Array.from(this.spacesNeedingParticipants).slice(0, 3);
        
        for (const spaceId of spacesToProcess) {
            // Skip if already being processed
            if (this.participantsLoadingQueue.has(spaceId)) continue;
            
            // Skip if we've exceeded retry attempts
            const retryCount = this.participantRetryAttempts.get(spaceId) || 0;
            if (retryCount >= this.maxRetryAttempts) {
                console.warn(`Max retry attempts reached for space ${spaceId}`);
                this.spacesNeedingParticipants.delete(spaceId);
                this.participantRetryAttempts.delete(spaceId);
                continue;
            }

            // Start loading this space's participants
            this.loadParticipantsForSpace(spaceId);
        }
    }

    /**
     * Load participants for a specific space with retry logic
     */
    async loadParticipantsForSpace(spaceId) {
        if (this.participantsLoadingQueue.has(spaceId)) return;
        
        this.participantsLoadingQueue.set(spaceId, true);
        
        try {
            console.log(`🔄 Loading participants for space: ${spaceId}`);
            
            const participantsData = await api.getSpaceParticipants(spaceId);
            
            console.log(`✅ Loaded participants for space: ${spaceId} (${participantsData?.totalParticipants || 0} participants)`);
            
            // Update UI for this space
            this.onParticipantDataLoaded(spaceId, participantsData);
            
            // Remove from tracking sets
            this.spacesNeedingParticipants.delete(spaceId);
            this.participantsLoadingQueue.delete(spaceId);
            this.participantRetryAttempts.delete(spaceId);
            
        } catch (error) {
            console.warn(`⚠️ Failed to load participants for space ${spaceId}:`, error.message);
            
            // Track retry attempt
            const currentRetries = this.participantRetryAttempts.get(spaceId) || 0;
            this.participantRetryAttempts.set(spaceId, currentRetries + 1);
            
            // Remove from loading queue so it can be retried
            this.participantsLoadingQueue.delete(spaceId);
            
            // If we haven't exceeded max retries, keep it in the needs set
            if (currentRetries + 1 >= this.maxRetryAttempts) {
                this.spacesNeedingParticipants.delete(spaceId);
                console.error(`Max retries exceeded for space ${spaceId}`);
            }
        }
    }

    /**
     * Downloads an audio file with proper filename using fetch to force download
     */
    async downloadAudioFile(url, filename, space) {
        try {
            const hostSlug = Utils.slugify(space.host || 'unknown');
            const titleSlug = Utils.slugify(space.title || 'untitled');
            const dateStr = space.createdAt ?
                new Date(space.createdAt).toISOString().split('T')[0] :
                'unknown-date';

            const extension = filename.match(/\.(mp3|aac|m4a|mp4)$/i)?.[1] || 'mp3';
            const downloadFilename = `${hostSlug}_${titleSlug}_${dateStr}_${space._id}.${extension}`;

            Utils.showMessage(`Starting download: ${downloadFilename}`, CONFIG.MESSAGE_TYPES.SUCCESS);

            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const blob = await response.blob();
            const blobUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = downloadFilename;
            link.style.display = 'none';

            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(blobUrl);

            Utils.showMessage(`Download started: ${downloadFilename}`, CONFIG.MESSAGE_TYPES.SUCCESS);
        } catch (error) {
            console.error('Download failed:', error);
            Utils.showMessage(`Download failed: ${error.message}`);
        }
    }

    /**
     * Calculates estimated audio duration from file size
     */
    calculateAudioDuration(fileSizeBytes, bitrateKbps = 96) {
        if (!fileSizeBytes || fileSizeBytes <= 0) return null;
        
        const durationSeconds = (fileSizeBytes * 8) / (bitrateKbps * 1000);
        return this.formatDurationFromSeconds(durationSeconds);
    }

    /**
     * Formats duration from seconds to human readable format
     */
    formatDurationFromSeconds(durationSeconds) {
        const minutes = Math.floor(durationSeconds / 60);
        const hours = Math.floor(minutes / 60);
        const remainingMinutes = minutes % 60;
        
        if (hours > 0) {
            return `~${hours}h ${remainingMinutes}m`;
        } else {
            return `~${minutes}m`;
        }
    }

    /**
     * Loads statistics from the API and displays them.
     */
    async loadStats() {
        try {
            const data = await api.getStats();
            this.displayStats(data.data);
        } catch (error) {
            Utils.showMessage(`Failed to load stats: ${error.message}`);
            console.error('Stats error:', error);
        }
    }

    /**
     * Displays the fetched statistics in the dashboard.
     */
    displayStats(stats) {
        if (!this.statsGrid) return;

        const totalSpaces = stats.overview.totalSpaces || 0;
        const liveSpaces = stats.overview.liveSpaces || 0;
        const recordingSuccessRate = stats.overview.recordingSuccessRate || 0;
        const avgParticipants = stats.overview.avgParticipants || 0;
        const publicPercentage = stats.privacy.publicPercentage || 0;
        const discoverySuccessRate = stats.discovery.discoverySuccessRate || 0;
        const recentSpaces = stats.activity.recentSpaces || 0;
        const hostDiversity = stats.activity.hostDiversity || 0;

        this.statsGrid.innerHTML = `
        <div class="stat-card">
        <div class="stat-number">${totalSpaces}</div>
        <div class="stat-label">Total Spaces</div>
        </div>
        <div class="stat-card">
        <div class="stat-number">${liveSpaces}</div>
        <div class="stat-label">Currently Live</div>
        </div>
        <div class="stat-card">
        <div class="stat-number">${recordingSuccessRate}%</div>
        <div class="stat-label">Recording Success Rate</div>
        </div>
        <div class="stat-card">
        <div class="stat-number">${publicPercentage}%</div>
        <div class="stat-label">Public Spaces</div>
        </div>
        <div class="stat-card">
        <div class="stat-number">${discoverySuccessRate}%</div>
        <div class="stat-label">Discovery Success Rate</div>
        </div>
        <div class="stat-card">
        <div class="stat-number">${avgParticipants}</div>
        <div class="stat-label">Avg Participants</div>
        </div>
        <div class="stat-card">
        <div class="stat-number">${recentSpaces}</div>
        <div class="stat-label">Recent (24h)</div>
        </div>
        <div class="stat-card">
        <div class="stat-number">${hostDiversity}</div>
        <div class="stat-label">Unique Hosts (24h)</div>
        </div>
        `;
    }

    /**
     * Enhanced load spaces with comprehensive participant tracking
     */
    async loadSpaces() {
        if (!this.spacesContent) return;

        // Reset all tracking state
        this.currentOffset = 0;
        this.hasMore = true;
        this.allSpaces = [];
        this.spacesNeedingParticipants.clear();
        this.participantsLoadingQueue.clear();
        this.participantRetryAttempts.clear();

        // Cancel any ongoing participant loading
        api.cancelParticipantLoading();

        this.spacesContent.innerHTML = '<div class="loading">Loading spaces...</div>';

        try {
            const filters = this.getFilterValues();
            filters.offset = 0;
            filters.limit = this.pageSize;

            // Load ONLY spaces (no participants)
            const data = await api.getSpacesOnly(filters);

            this.allSpaces = data.data;
            this.currentOffset = this.pageSize;
            this.hasMore = data.hasMore;

            // Display spaces immediately
            const sortedSpaces = this.sortSpaces(data.data);
            this.displaySpaces(sortedSpaces, false);

            // Track spaces that need participant data
            this.trackSpacesNeedingParticipants(sortedSpaces);

            // Start enhanced background participant loading
            this.startEnhancedParticipantLoading(sortedSpaces);

        } catch (error) {
            this.spacesContent.innerHTML = `<div class="error">Failed to load spaces: ${error.message}</div>`;
            console.error('Spaces error:', error);
        }
    }

    /**
     * Enhanced load more spaces with proper participant tracking
     */
    async loadMoreSpaces() {
        if (this.isLoading || !this.hasMore) return;

        this.isLoading = true;

        try {
            const filters = this.getFilterValues();
            filters.offset = this.currentOffset;
            filters.limit = this.pageSize;

            // Load ONLY spaces (no participants)
            const data = await api.getSpacesOnly(filters);

            if (data.data && data.data.length > 0) {
                this.allSpaces = [...this.allSpaces, ...data.data];
                this.currentOffset += data.data.length;
                this.hasMore = data.hasMore;

                // Display new spaces immediately
                const sortedSpaces = this.sortSpaces(data.data);
                this.displaySpaces(sortedSpaces, true);

                // Track new spaces that need participant data
                this.trackSpacesNeedingParticipants(sortedSpaces);

                // Add new spaces to enhanced participant loading
                this.addSpacesToEnhancedParticipantLoading(sortedSpaces);
            } else {
                this.hasMore = false;
            }
        } catch (error) {
            console.error('Error loading more spaces:', error);
            Utils.showMessage(`Failed to load more spaces: ${error.message}`);
        } finally {
            this.isLoading = false;
        }
    }

    /**
     * Track spaces that need participant data
     */
    trackSpacesNeedingParticipants(spaces) {
        spaces.forEach(space => {
            if (space._id && !api.getCachedParticipants(space._id)) {
                this.spacesNeedingParticipants.add(space._id);
                console.log(`📝 Tracking space ${space._id} for participant loading`);
            }
        });
        
        console.log(`📊 Total spaces needing participants: ${this.spacesNeedingParticipants.size}`);
    }

    /**
     * Enhanced participant loading with better coordination
     */
    startEnhancedParticipantLoading(spaces) {
        console.log(`🚀 Starting enhanced participant loading for ${spaces.length} spaces`);
        
        // Use the existing API method but with enhanced tracking
        api.startBackgroundParticipantLoading(spaces, (spaceId, participantsData) => {
            // Callback when each participant set is loaded
            this.onParticipantDataLoaded(spaceId, participantsData);
            
            // Remove from our tracking
            this.spacesNeedingParticipants.delete(spaceId);
            this.participantsLoadingQueue.delete(spaceId);
            this.participantRetryAttempts.delete(spaceId);
        });
        
        // Update loading indicator
        this.updateParticipantLoadingIndicator();
    }

    /**
     * Add more spaces to enhanced participant loading
     */
    addSpacesToEnhancedParticipantLoading(spaces) {
        console.log(`➕ Adding ${spaces.length} more spaces to participant loading`);
        
        // This will add to the existing queue and continue serial processing
        api.startBackgroundParticipantLoading(spaces, (spaceId, participantsData) => {
            this.onParticipantDataLoaded(spaceId, participantsData);
            
            // Remove from our tracking
            this.spacesNeedingParticipants.delete(spaceId);
            this.participantsLoadingQueue.delete(spaceId);
            this.participantRetryAttempts.delete(spaceId);
        });
        
        this.updateParticipantLoadingIndicator();
    }

    /**
     * Called when participant data is loaded for a space
     * Updates the UI for that specific space
     */
    onParticipantDataLoaded(spaceId, participantsData) {
        console.log(`✅ Updating UI for space ${spaceId} with participant data`);
        
        // Find the space element in the DOM
        const spaceElement = this.spacesContent.querySelector(`[data-space-id="${spaceId}"]`);
        if (!spaceElement) {
            console.warn(`Space element not found for ${spaceId}`);
            return;
        }

        // Update participant avatars for this space
        const participantContainer = spaceElement.querySelector('.participant-avatars, .participant-avatars-empty');
        if (participantContainer) {
            const newAvatarsHTML = this.createParticipantAvatarsHTML(participantsData);
            participantContainer.outerHTML = newAvatarsHTML;
            
            // Re-setup click handler for this specific space
            this.setupParticipantClickHandlerForSpace(spaceElement);
        }
    }

    /**
     * Setup click handler for a specific space element
     */
    setupParticipantClickHandlerForSpace(spaceElement) {
        const participantAvatars = spaceElement.querySelector('.participant-avatars');
        if (participantAvatars) {
            participantAvatars.addEventListener('click', (e) => {
                const spaceId = spaceElement.dataset.spaceId;
                const spaceTitle = spaceElement.querySelector('.space-title').textContent;
                if (spaceId) {
                    this.showParticipantsModal(spaceId, spaceTitle);
                }
            });
        }
    }

    /**
     * Sorts spaces with live spaces first, then chronologically
     */
    sortSpaces(spaces) {
        if (!spaces || !Array.isArray(spaces)) return [];

        return spaces.sort((a, b) => {
            // First priority: Live spaces come first
            if (a.isLive && !b.isLive) return -1;
            if (!a.isLive && b.isLive) return 1;

            // Second priority: Sort by date
            const dateA = this.getRelevantDate(a);
            const dateB = this.getRelevantDate(b);

            // Sort in descending order (newest first)
            return new Date(dateB) - new Date(dateA);
        });
    }

    /**
     * Gets the most relevant date for sorting a space
     */
    getRelevantDate(space) {
        return space.lastUpdated ||
            space.endedAt ||
            space.startedAt ||
            space.createdAt ||
            new Date(0).toISOString();
    }

    /**
     * Gets current filter values from the UI
     */
    getFilterValues() {
        return {
            limit: this.pageSize
        };
    }

    /**
     * Constructs X.com URL for a space
     */
    getSpaceUrl(space) {
        if (space.spaceId) {
            return `https://x.com/i/spaces/${space.spaceId}`;
        }

        if (space._id && space._id.length > 10) {
            return `https://x.com/i/spaces/${space._id}`;
        }

        if (space.host) {
            const cleanHost = space.host.replace(/[@]/g, '');
            return `https://x.com/${cleanHost}`;
        }

        return null;
    }

    /**
     * Determines the privacy status of a space
     */
    getPrivacyInfo(space) {
        if (typeof space.private === 'boolean') {
            return {
                isPrivate: space.private,
                status: space.private ? 'Private' : 'Public',
                badge: space.private ? 'badge-private' : 'badge-public',
                icon: space.private ? '🔒' : '📢',
                tooltip: space.private ? 'Not recorded - Private space' : 'Recorded - Public space'
            };
        }

        const hasRecording = space.recordingStatus || space.hlsUrl;

        return {
            isPrivate: null,
            status: hasRecording ? 'Public (inferred)' : 'Unknown',
            badge: hasRecording ? 'badge-public' : 'badge-unknown',
            icon: hasRecording ? '📢' : '❓',
            tooltip: hasRecording ? 'Likely recorded based on available data' : 'Recording status unknown (older space)'
        };
    }

    /**
     * Gets anchor information for display
     */
    getAnchorInfo(space) {
        if (!space.anchor) {
            return {
                hasAnchor: false,
                displayText: 'No anchor',
                tooltip: 'Space was not discovered through following someone',
                badge: 'badge-unknown',
                icon: '❓'
            };
        }

        const { displayName, role } = space.anchor;
        const roleIcons = {
            hosting: '🎙️',
            speaking: '🗣️',
            listening: '👂'
        };

        const roleText = {
            hosting: 'hosting',
            speaking: 'speaking',
            listening: 'listening'
        };

        return {
            hasAnchor: true,
            displayText: `${displayName}`,
            role: role,
            roleIcon: roleIcons[role] || '👤',
            roleText: roleText[role] || role,
            tooltip: `Space discovered because you follow ${displayName} who was ${roleText[role] || role}`,
            badge: 'badge-participants',
            icon: '🔗'
        };
    }

    /**
     * Creates HTML for participant avatars with overlapping display
     * Enhanced with better loading state handling
     */
    createParticipantAvatarsHTML(participantsData, maxShow = 5) {
        if (!participantsData || !participantsData.participants || participantsData.participants.length === 0) {
            return '<div class="participant-avatars-empty">Loading participants...</div>';
        }

        const participants = participantsData.participants;
        const totalCount = participants.length;
        const showCount = Math.min(participants.length, maxShow);
        const remainingCount = Math.max(0, totalCount - maxShow);

        // Role-based sorting
        const roleOrder = { 'host': 0, 'co-host': 1, 'speaker': 2, 'listener': 3 };
        const sortedParticipants = [...participants].sort((a, b) => {
            const roleA = (a.role || '').toLowerCase();
            const roleB = (b.role || '').toLowerCase();
            const priorityA = roleOrder[roleA] !== undefined ? roleOrder[roleA] : 99;
            const priorityB = roleOrder[roleB] !== undefined ? roleOrder[roleB] : 99;
            
            return priorityA - priorityB;
        });

        const avatarsHTML = sortedParticipants.slice(0, showCount).map((participant, index) => {
            const profileImage = api.enhanceImageQuality(participant.profileImage) || participant.profileImage;
            
            const normalizedRole = (participant.role || '').toLowerCase().replace('-', '').replace('co-host', 'cohost');
            const roleClass = normalizedRole || 'listener';
            
            const title = `${participant.name} (@${participant.username.replace('@', '')}) - ${participant.role}`;
            
            const baseZIndex = 100;
            const roleZIndex = baseZIndex + (showCount - index) + (roleOrder[participant.role?.toLowerCase()] !== undefined ? (3 - roleOrder[participant.role.toLowerCase()]) * 10 : 0);
            
            return `
                <div class="participant-avatar ${roleClass}" 
                     style="z-index: ${roleZIndex};" 
                     title="${title}"
                     data-role="${participant.role}"
                     data-index="${index}">
                    <img src="${profileImage}" 
                         alt="${participant.name}" 
                         onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2240%22 height=%2240%22 viewBox=%220 0 40 40%22><rect width=%2240%22 height=%2240%22 fill=%22%23ddd%22/><text x=%2220%22 y=%2225%22 text-anchor=%22middle%22 font-size=%2216%22 fill=%22%23666%22>${participant.name.charAt(0).toUpperCase()}</text></svg>'">
                </div>
            `;
        }).join('');

        const remainingHTML = remainingCount > 0 ? 
            `<div class="participant-avatar remaining" title="${remainingCount} more participants">+${remainingCount}</div>` : '';

        return `
            <div class="participant-avatars" title="Click to view all ${totalCount} participants">
                ${avatarsHTML}
                ${remainingHTML}
            </div>
        `;
    }

    /**
     * Enhanced space display with participant avatars and better tracking
     */
    displaySpaces(spaces, append = false) {
        if (!this.spacesContent) return;

        if (!spaces || spaces.length === 0) {
            if (!append) {
                this.spacesContent.innerHTML = '<div class="loading">No spaces found.</div>';
            }
            return;
        }

        const spacesHTML = spaces.map(space => {
            const audioFiles = api.getAllAudioFilesBySpaceId(space._id, space.host, space.createdAt);
            const transcription = api.getTranscriptionBySpaceId(space._id, space.host, space.createdAt);
            const spaceUrl = this.getSpaceUrl(space);
            const privacyInfo = this.getPrivacyInfo(space);
            const anchorInfo = this.getAnchorInfo(space);

            return this.createSpaceItemHTML(space, audioFiles, transcription, spaceUrl, privacyInfo, anchorInfo);
        }).join('');

        if (append) {
            const container = document.createElement('div');
            container.innerHTML = spacesHTML;
            // Remove the loading indicator before appending new items
            const loadingIndicator = this.spacesContent.querySelector('.loading');
            if (loadingIndicator) {
                loadingIndicator.remove();
            }
            while (container.firstChild) {
                this.spacesContent.appendChild(container.firstChild);
            }
        } else {
            this.spacesContent.innerHTML = spacesHTML;
        }

        // Add a loading indicator if there are more items to fetch
        if (this.hasMore) {
            const loadingDiv = document.createElement('div');
            loadingDiv.className = 'loading';
            loadingDiv.textContent = 'Loading more spaces...';
            this.spacesContent.appendChild(loadingDiv);
        }

        // Set up click handlers for participant avatars
        this.setupParticipantClickHandlers();
    }

    /**
     * Sets up click handlers for participant avatars to show participant modal
     */
    setupParticipantClickHandlers() {
        const participantAvatars = this.spacesContent.querySelectorAll('.participant-avatars');
        participantAvatars.forEach(avatarsContainer => {
            avatarsContainer.addEventListener('click', (e) => {
                const spaceItem = avatarsContainer.closest('.space-item');
                if (spaceItem) {
                    const spaceId = spaceItem.dataset.spaceId;
                    const spaceTitle = spaceItem.querySelector('.space-title').textContent;
                    if (spaceId) {
                        this.showParticipantsModal(spaceId, spaceTitle);
                    }
                }
            });
        });
    }

    /**
     * Shows participants modal for a space
     */
    async showParticipantsModal(spaceId, spaceTitle) {
        let participantsData = api.getCachedParticipants(spaceId);
        
        if (!participantsData) {
            // If not loaded yet, try to load it now
            Utils.showMessage('Loading participants...', CONFIG.MESSAGE_TYPES.SUCCESS);
            try {
                participantsData = await api.getSpaceParticipants(spaceId);
            } catch (error) {
                Utils.showMessage('Failed to load participants for this space');
                return;
            }
        }
        
        if (!participantsData || !participantsData.participants) {
            Utils.showMessage('No participant data available for this space');
            return;
        }

        // Group participants by role
        const participantsByRole = participantsData.participantsByRole || {};
        
        let modalContent = `<div class="participants-modal-content">`;
        modalContent += `<h3>Participants in "${spaceTitle}"</h3>`;
        modalContent += `<p class="participants-count">Total: ${participantsData.totalParticipants || participantsData.participants.length} participants</p>`;
        
        // Display by role
        ['host', 'co-host', 'speaker', 'listener'].forEach(role => {
            const roleParticipants = participantsByRole[role] || [];
            if (roleParticipants.length > 0) {
                const roleTitle = role.charAt(0).toUpperCase() + role.slice(1).replace('-', ' ');
                modalContent += `
                    <div class="participants-role-section">
                        <h4>${roleTitle}s (${roleParticipants.length})</h4>
                        <div class="participants-list">
                `;
                
                roleParticipants.forEach(participant => {
                    const profileImage = api.enhanceImageQuality(participant.profileImage) || participant.profileImage;
                    const username = participant.username.replace('@', '');
                    modalContent += `
                        <div class="participant-item">
                            <img src="${profileImage}" 
                                 alt="${participant.name}" 
                                 class="participant-modal-avatar"
                                 onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2240%22 height=%2240%22 viewBox=%220 0 40 40%22><rect width=%2240%22 height=%2240%22 fill=%22%23ddd%22/><text x=%2220%22 y=%2225%22 text-anchor=%22middle%22 font-size=%2216%22 fill=%22%23666%22>${participant.name.charAt(0).toUpperCase()}</text></svg>'">
                            <div class="participant-info">
                                <div class="participant-name">${participant.name}</div>
                                <div class="participant-username">
                                    <a href="https://x.com/${username}" target="_blank">@${username}</a>
                                </div>
                            </div>
                        </div>
                    `;
                });
                
                modalContent += `
                        </div>
                    </div>
                `;
            }
        });
        
        modalContent += `</div>`;
        
        // Show modal with custom content
        modal.openWithHTML('Participants', modalContent);
    }

    /**
     * Creates HTML for a single space item with participant avatars
     * Enhanced with better loading state and tracking
     */
    createSpaceItemHTML(space, audioFiles, transcription, spaceUrl, privacyInfo, anchorInfo) {
        const isLive = space.isLive;
        const statusClass = isLive ? 'status-live' : 'status-ended';
        const relevantDate = this.getRelevantDate(space);
        const timeAgo = this.formatTimeDisplay(space, relevantDate).replace('Started', 'Live since').replace('Ended', 'Ended');

        const rawTitle = space.title || 'Untitled Space';
        const displayTitle = rawTitle.length > 64 ? rawTitle.substring(0, 60) + '...' : rawTitle;

        // Create a compact metadata string
        const metaParts = [];

        // Add host with a hyperlink to their X.com profile
        if (space.host) {
            const cleanHost = space.host.replace(/[@]/g, '');
            const hostUrl = `https://x.com/${cleanHost}`;
            metaParts.push(`<a href="${hostUrl}" target="_blank">${space.host}</a>`);
        } else {
            metaParts.push('Unknown Host');
        }

        if (space.participantCount > 0) {
            metaParts.push(`${space.participantCount} listeners`);
        }

        // Add Privacy Info
        metaParts.push(`${privacyInfo.icon} ${privacyInfo.status}`);

        if (anchorInfo.hasAnchor) {
            metaParts.push(`${anchorInfo.icon} via ${anchorInfo.roleIcon} ${anchorInfo.displayText} (${anchorInfo.roleText})`);
        }

        // Add override indicator if applicable
        if (space.isOverride) {
            metaParts.push('<span class="override-icon">⚡ Override</span>');
        }

        // Add audio duration if available
        if (audioFiles && audioFiles.length > 0) {
            const firstAudio = audioFiles[0];
            if (firstAudio.size) {
                const duration = this.calculateAudioDuration(firstAudio.size);
                if (duration) {
                    metaParts.push(duration);
                }
            }
        }

        metaParts.push(timeAgo);
        const metadataText = metaParts.join(' · ');

        // Determine which actions to show
        const hasAudio = audioFiles && audioFiles.length > 0;
        const hasTranscriptLink = space.transcriptLink && space.transcriptLink !== null;

        let actionsHTML = '';
        if (hasAudio) {
            const firstAudio = audioFiles[0];
            const staticDownloadFilename = this.createDownloadFilename(space, firstAudio.filename);
            actionsHTML += `<a href="${firstAudio.url}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary">Listen</a>`;
        }
        if (hasTranscriptLink) {
            actionsHTML += `<a href="${space.transcriptLink}" target="_blank" class="btn btn-secondary">Transcript</a>`;
        }
        if (spaceUrl) {
            actionsHTML += `<a href="${spaceUrl}" target="_blank" class="btn btn-primary">Open on X</a>`;
        }

        // Enhanced participant loading state
        const hasParticipantData = api.getCachedParticipants(space._id);
        const isInLoadingQueue = this.participantsLoadingQueue.has(space._id);
        const needsParticipants = this.spacesNeedingParticipants.has(space._id);
        
        let participantAvatarsHTML;
        if (hasParticipantData) {
            participantAvatarsHTML = this.createParticipantAvatarsHTML(hasParticipantData);
        } else if (isInLoadingQueue) {
            participantAvatarsHTML = '<div class="participant-avatars-empty">🔄 Loading participants...</div>';
        } else if (needsParticipants) {
            participantAvatarsHTML = '<div class="participant-avatars-empty">⏳ Queued for loading...</div>';
        } else {
            participantAvatarsHTML = '<div class="participant-avatars-empty">Loading participants...</div>';
        }

        return `
        <div class="space-item" data-space-id="${space._id}">
            <div class="status-indicator ${statusClass}" title="${isLive ? 'Live' : 'Ended'}"></div>
            <div class="space-details">
                <div class="space-title">${displayTitle}</div>
                <div class="space-metadata">${metadataText}</div>
                ${participantAvatarsHTML}
            </div>
            <div class="space-actions">
                ${actionsHTML}
            </div>
        </div>
        `;
    }

    /**
     * Creates a descriptive filename for downloads
     */
    createDownloadFilename(space, originalFilename, index = null) {
        const hostSlug = Utils.slugify(space.host || 'unknown');
        const titleSlug = Utils.slugify(space.title || 'untitled');
        const dateStr = space.createdAt ?
            new Date(space.createdAt).toISOString().split('T')[0] :
            'unknown-date';

        const extension = originalFilename?.match(/\.(mp3|aac|m4a|mp4)$/i)?.[1] || 'mp3';

        let filename = `${hostSlug}_${titleSlug}_${dateStr}_${space._id}`;

        if (index !== null && index > 0) {
            filename += `_part${index + 1}`;
        }

        return `${filename}.${extension}`;
    }

    formatTimeDisplay(space, relevantDate) {
        const date = new Date(relevantDate);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / (1000 * 60));
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (space.isLive) {
            if (diffMins < 60) {
                return `Started ${diffMins}m ago`;
            } else if (diffHours < 24) {
                return `Started ${diffHours}h ago`;
            } else {
                return `Started ${diffDays}d ago`;
            }
        } else {
            if (diffMins < 60) {
                return `Ended ${diffMins}m ago`;
            } else if (diffHours < 24) {
                return `Ended ${diffHours}h ago`;
            } else if (diffDays < 7) {
                return `Ended ${diffDays}d ago`;
            } else {
                return `Ended on ${date.toLocaleDateString()}`;
            }
        }
    }

    /**
     * Fetches and displays detailed information for a specific space.
     */
    async viewSpaceDetails(spaceId) {
        try {
            const data = await api.getSpaceDetails(spaceId);
            modal.showSpaceDetails(data.data);
        } catch (error) {
            Utils.showMessage(`Failed to load space details: ${error.message}`);
        }
    }

    /**
     * Debug method to show comprehensive participant loading status
     */
    debugParticipantLoadingStatus() {
        const progress = api.getParticipantLoadingProgress();
        const cache = api.getParticipantsCache();
        
        const debugInfo = {
            loadingProgress: progress,
            spacesNeedingParticipants: Array.from(this.spacesNeedingParticipants),
            loadingQueue: Array.from(this.participantsLoadingQueue.entries()),
            retryAttempts: Array.from(this.participantRetryAttempts.entries()),
            cacheStats: {
                totalEntries: Object.keys(cache).length,
                successfulEntries: Object.values(cache).filter(p => p !== null).length,
                failedEntries: Object.values(cache).filter(p => p === null).length
            },
            totalSpacesDisplayed: this.allSpaces.length,
            coverage: {
                percentage: this.allSpaces.length > 0 ? 
                    Math.round((Object.keys(cache).length / this.allSpaces.length) * 100) : 0,
                missing: this.spacesNeedingParticipants.size,
                loading: this.participantsLoadingQueue.size
            }
        };
        
        console.log('🔍 Enhanced Participant Loading Debug:', debugInfo);
        
        const debugText = `
Enhanced Participant Loading Status:

📊 OVERVIEW:
- Total Spaces Displayed: ${debugInfo.totalSpacesDisplayed}
- Participant Coverage: ${debugInfo.coverage.percentage}%
- Still Missing: ${debugInfo.coverage.missing} spaces
- Currently Loading: ${debugInfo.coverage.loading} spaces

🔄 LOADING STATE:
- API Loading: ${progress.isLoading ? 'YES' : 'NO'}
- Queue Length: ${progress.queueLength}
- Progress: ${progress.progress}

📝 TRACKING QUEUES:
- Spaces Needing Participants: ${debugInfo.spacesNeedingParticipants.length}
- Active Loading Queue: ${debugInfo.loadingQueue.length}
- Retry Attempts: ${debugInfo.retryAttempts.length}

💾 CACHE STATISTICS:
- Total Cache Entries: ${debugInfo.cacheStats.totalEntries}
- Successful API Calls: ${debugInfo.cacheStats.successfulEntries}
- Failed API Calls: ${debugInfo.cacheStats.failedEntries}

🔧 DEBUGGING COMMANDS:
- dashboard.forceParticipantSync() - Force sync all missing
- dashboard.clearParticipantTracking() - Reset tracking
- dashboard.debugParticipantLoadingStatus() - Show this info
        `;
        
        if (window.modal) {
            modal.showDebugInfo(debugText);
        } else {
            console.log(debugText);
        }
        
        return debugInfo;
    }

    /**
     * Force synchronization of all missing participant data
     */
    async forceParticipantSync() {
        console.log('🔄 Force synchronizing participant data for all spaces...');
        
        // Cancel any ongoing loading
        api.cancelParticipantLoading();
        
        // Clear tracking state
        this.participantsLoadingQueue.clear();
        this.participantRetryAttempts.clear();
        
        // Find all spaces without participant data
        this.spacesNeedingParticipants.clear();
        this.allSpaces.forEach(space => {
            if (space._id && !api.getCachedParticipants(space._id)) {
                this.spacesNeedingParticipants.add(space._id);
            }
        });
        
        console.log(`📋 Found ${this.spacesNeedingParticipants.size} spaces needing participant data`);
        
        // Start enhanced loading
        this.startEnhancedParticipantLoading(this.allSpaces);
        
        Utils.showMessage(`Force sync started for ${this.spacesNeedingParticipants.size} spaces`, CONFIG.MESSAGE_TYPES.SUCCESS);
    }

    /**
     * Clear all participant tracking state
     */
    clearParticipantTracking() {
        console.log('🧹 Clearing all participant tracking state...');
        
        api.cancelParticipantLoading();
        this.spacesNeedingParticipants.clear();
        this.participantsLoadingQueue.clear();
        this.participantRetryAttempts.clear();
        
        // Clear API cache
        api.participantsCache = {};
        
        // Re-display all spaces to reset loading states
        if (this.allSpaces.length > 0) {
            const sortedSpaces = this.sortSpaces(this.allSpaces);
            this.displaySpaces(sortedSpaces, false);
            this.trackSpacesNeedingParticipants(sortedSpaces);
        }
        
        Utils.showMessage('Participant tracking cleared and reset', CONFIG.MESSAGE_TYPES.SUCCESS);
    }
}

// Create global instance
const dashboard = new Dashboard();

// Make dashboard globally available for debugging and access from other scripts
window.dashboard = dashboard;

// Enhanced debugging methods
window.debugParticipants = () => dashboard.debugParticipantLoadingStatus();
window.forceParticipantSync = () => dashboard.forceParticipantSync();
window.clearParticipantTracking = () => dashboard.clearParticipantTracking();
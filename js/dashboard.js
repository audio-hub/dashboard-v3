/**
 * Decoupled Dashboard with Background Participant Loading
 * - Spaces load immediately without waiting for participants
 * - Participants load in background serially and update UI as they arrive
 * - Scrolling and new space requests are never blocked by participant loading
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

        // Participant loading state
        this.participantLoadingIndicator = null;

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
    }

    /**
     * Create a subtle loading indicator for background participant loading
     */
    createParticipantLoadingIndicator() {
        const indicator = document.createElement('div');
        indicator.id = 'participant-loading-indicator';
        indicator.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: rgba(52, 152, 219, 0.9);
            color: white;
            padding: 8px 16px;
            border-radius: 20px;
            font-size: 0.85rem;
            font-weight: 500;
            z-index: 1000;
            display: none;
            transition: all 0.3s ease;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        `;
        indicator.innerHTML = '🔄 Loading participants...';
        document.body.appendChild(indicator);
        
        this.participantLoadingIndicator = indicator;
    }

    /**
     * Update participant loading indicator
     */
    updateParticipantLoadingIndicator() {
        if (!this.participantLoadingIndicator) return;
        
        const progress = api.getParticipantLoadingProgress();
        
        if (progress.isLoading) {
            this.participantLoadingIndicator.innerHTML = `🔄 Loading participants... (${progress.progress})`;
            this.participantLoadingIndicator.style.display = 'block';
        } else {
            this.participantLoadingIndicator.style.display = 'none';
        }
    }

    /**
     * Sets up infinite scroll functionality
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
     * DECOUPLED: Load spaces immediately without participants
     */
    async loadSpaces() {
        if (!this.spacesContent) return;

        // Reset pagination state
        this.currentOffset = 0;
        this.hasMore = true;
        this.allSpaces = [];

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

            // Start background participant loading
            this.startBackgroundParticipantLoading(sortedSpaces);

        } catch (error) {
            this.spacesContent.innerHTML = `<div class="error">Failed to load spaces: ${error.message}</div>`;
            console.error('Spaces error:', error);
        }
    }

    /**
     * DECOUPLED: Load more spaces without waiting for participants
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

                // Add new spaces to background participant loading
                this.addSpacesToParticipantQueue(sortedSpaces);
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
     * Start background participant loading for spaces
     */
    startBackgroundParticipantLoading(spaces) {
        console.log(`🔄 Starting background participant loading for ${spaces.length} spaces`);
        
        api.startBackgroundParticipantLoading(spaces, (spaceId, participantsData) => {
            // Callback when each participant set is loaded
            this.onParticipantDataLoaded(spaceId, participantsData);
        });
        
        // Update loading indicator
        this.updateParticipantLoadingIndicator();
        
        // Check progress periodically
        const progressInterval = setInterval(() => {
            this.updateParticipantLoadingIndicator();
            
            if (!api.isLoadingParticipantsInBackground()) {
                clearInterval(progressInterval);
                setTimeout(() => {
                    this.updateParticipantLoadingIndicator();
                }, 1000); // Hide indicator after 1 second
            }
        }, 500);
    }

    /**
     * Add more spaces to the participant loading queue
     */
    addSpacesToParticipantQueue(spaces) {
        // This will add to the existing queue and continue serial processing
        api.startBackgroundParticipantLoading(spaces, (spaceId, participantsData) => {
            this.onParticipantDataLoaded(spaceId, participantsData);
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
     * Updated to handle missing participant data gracefully
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
     * Enhanced space display with participant avatars (initially showing "Loading...")
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
     * Initially shows "Loading participants..." until data arrives
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

        // Add Anchor Info if it exists
        if (anchorInfo.hasAnchor) {
            metaParts.push(`${anchorInfo.icon} via ${anchorInfo.roleIcon} ${anchorInfo.displayText} (${anchorInfo.roleText})`);
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
            actionsHTML += `<a href="${firstAudio.url}" download="${staticDownloadFilename}" class="btn btn-secondary">Listen</a>`;
        }
        if (hasTranscriptLink) {
            actionsHTML += `<a href="${space.transcriptLink}" target="_blank" class="btn btn-secondary">Transcript</a>`;
        }
        if (spaceUrl) {
            actionsHTML += `<a href="${spaceUrl}" target="_blank" class="btn btn-primary">Open on X</a>`;
        }

        // Initially show "Loading participants..." - will be updated when data arrives
        const participantAvatarsHTML = '<div class="participant-avatars-empty">Loading participants...</div>';

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
}

// Create global instance
const dashboard = new Dashboard();

// Make dashboard globally available for debugging and access from other scripts
window.dashboard = dashboard;
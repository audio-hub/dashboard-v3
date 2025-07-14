/**
 * Enhanced Dashboard management with spaceId-based MP3 mapping and transcription support
 * Updated to handle host as string, reduce auto-updates, and display anchor data
 * ADDED: Download functionality alongside listen buttons
 * UPDATED: Changed audio bitrate assumption from 128kbps to 96kbps
 * NEW: Added transcription file mapping and display
 */

class Dashboard {
    constructor() {
        this.allSpaces = [];
        this.statsSection = null;
        this.statsGrid = null;
        this.spacesContent = null;
        // Removed auto-refresh related properties

        // Infinite scroll state
        this.currentOffset = 0;
        this.isLoading = false;
        this.hasMore = true;
        this.pageSize = 20;

        this.init();
    }

    /**
     * Initialize dashboard elements
     */
    init() {
        this.statsSection = Utils.getElementById('stats-section');
        this.statsGrid = Utils.getElementById('statsGrid');
        this.spacesContent = Utils.getElementById('spacesContent');
        // Removed statusFilter since it's no longer needed

        // Set up infinite scroll
        this.setupInfiniteScroll();
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
     * @param {string} url - Audio file URL
     * @param {string} filename - Suggested filename
     * @param {Object} space - Space object for additional context
     */
    async downloadAudioFile(url, filename, space) {
        try {
            // Create a more descriptive filename
            const hostSlug = Utils.slugify(space.host || 'unknown');
            const titleSlug = Utils.slugify(space.title || 'untitled');
            const dateStr = space.createdAt ?
                new Date(space.createdAt).toISOString().split('T')[0] :
                'unknown-date';

            // Extract file extension from original filename or URL
            const extension = filename.match(/\.(mp3|aac|m4a|mp4)$/i)?.[1] || 'mp3';

            // Create descriptive filename: host_title_date_spaceId.extension
            const downloadFilename = `${hostSlug}_${titleSlug}_${dateStr}_${space._id}.${extension}`;

            Utils.showMessage(`Starting download: ${downloadFilename}`, CONFIG.MESSAGE_TYPES.SUCCESS);

            // Fetch the file
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            // Get the blob
            const blob = await response.blob();

            // Create download link with blob URL
            const blobUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = downloadFilename;
            link.style.display = 'none';

            // Add to DOM, click, and remove
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            // Clean up blob URL
            window.URL.revokeObjectURL(blobUrl);

            Utils.showMessage(`Download started: ${downloadFilename}`, CONFIG.MESSAGE_TYPES.SUCCESS);
        } catch (error) {
            console.error('Download failed:', error);
            Utils.showMessage(`Download failed: ${error.message}`);

            // Fallback: try simple download attribute approach
            try {
                const link = document.createElement('a');
                link.href = url;
                link.download = filename || 'audio_file';
                link.target = '_blank';
                link.style.display = 'none';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                Utils.showMessage('Fallback download attempt initiated', CONFIG.MESSAGE_TYPES.SUCCESS);
            } catch (fallbackError) {
                console.error('Fallback download also failed:', fallbackError);
                Utils.showMessage('Download failed. You can right-click the Listen button and "Save link as..."');
            }
        }
    }

    /**
     * Calculates estimated audio duration from file size
     * UPDATED: Changed from 128kbps to 96kbps
     * @param {number} fileSizeBytes - File size in bytes
     * @param {number} bitrateKbps - Bitrate in kbps (default 96 for AAC, changed from 128)
     * @returns {string} Formatted duration string
     */
    calculateAudioDuration(fileSizeBytes, bitrateKbps = 96) {
        if (!fileSizeBytes || fileSizeBytes <= 0) return null;
        
        // Formula: Duration (seconds) = (File Size in bytes × 8) / (Bitrate in bits per second)
        const durationSeconds = (fileSizeBytes * 8) / (bitrateKbps * 1000);
        
        return this.formatDurationFromSeconds(durationSeconds);
    }

    /**
     * Formats duration from seconds to human readable format
     * @param {number} durationSeconds - Duration in seconds
     * @returns {string} Formatted duration string with ~ prefix
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
            // if (this.statsSection) {
            //     this.statsSection.style.display = 'block';
            // }
        } catch (error) {
            Utils.showMessage(`Failed to load stats: ${error.message}`);
            console.error('Stats error:', error);
        }
    }

    /**
     * Displays the fetched statistics in the dashboard.
     * @param {Object} stats - The statistics data.
     */
    displayStats(stats) {
        if (!this.statsGrid) return;

        // Core metrics
        const totalSpaces = stats.overview.totalSpaces || 0;
        const liveSpaces = stats.overview.liveSpaces || 0;
        const recordingSuccessRate = stats.overview.recordingSuccessRate || 0;
        const avgParticipants = stats.overview.avgParticipants || 0;

        // Privacy metrics
        const publicPercentage = stats.privacy.publicPercentage || 0;
        const privateSpaces = stats.privacy.privateSpaces || 0;

        // Discovery metrics
        const discoverySuccessRate = stats.discovery.discoverySuccessRate || 0;
        const spacesWithAnchor = stats.discovery.spacesWithAnchor || 0;

        // Activity metrics
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
     * Loads Twitter Spaces data from the API based on filters and displays them.
     * Updated for infinite scroll - always starts fresh
     */
    async loadSpaces() {
        if (!this.spacesContent) return;

        // Reset pagination state
        this.currentOffset = 0;
        this.hasMore = true;
        this.allSpaces = [];

        this.spacesContent.innerHTML = '<div class="loading">Loading spaces...</div>';

        try {
            const filters = this.getFilterValues();
            filters.offset = 0;
            filters.limit = this.pageSize;

            const data = await api.getSpaces(filters);

            this.allSpaces = data.data;
            this.currentOffset = this.pageSize;
            this.hasMore = data.hasMore;

            // Sort spaces before displaying
            const sortedSpaces = this.sortSpaces(data.data);
            this.displaySpaces(sortedSpaces, false); // false = replace content
        } catch (error) {
            this.spacesContent.innerHTML = `<div class="error">Failed to load spaces: ${error.message}</div>`;
            console.error('Spaces error:', error);
        }
    }

    /**
     * Loads more spaces for infinite scroll
     */
    async loadMoreSpaces() {
        if (this.isLoading || !this.hasMore) return;

        this.isLoading = true;

        try {
            const filters = this.getFilterValues();
            filters.offset = this.currentOffset;
            filters.limit = this.pageSize;

            const data = await api.getSpaces(filters);

            if (data.data && data.data.length > 0) {
                this.allSpaces = [...this.allSpaces, ...data.data];
                this.currentOffset += data.data.length;
                this.hasMore = data.hasMore;

                // Sort new spaces and append
                const sortedSpaces = this.sortSpaces(data.data);
                this.displaySpaces(sortedSpaces, true); // true = append content
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
     * Sorts spaces with live spaces first, then chronologically
     * @param {Array<Object>} spaces - Array of space objects
     * @returns {Array<Object>} Sorted array of spaces
     */
    sortSpaces(spaces) {
        if (!spaces || !Array.isArray(spaces)) return [];

        return spaces.sort((a, b) => {
            // First priority: Live spaces come first
            if (a.isLive && !b.isLive) return -1;
            if (!a.isLive && b.isLive) return 1;

            // Second priority: Sort by date
            // For live spaces: most recently started first
            // For ended spaces: most recently ended first
            const dateA = this.getRelevantDate(a);
            const dateB = this.getRelevantDate(b);

            // Sort in descending order (newest first)
            return new Date(dateB) - new Date(dateA);
        });
    }

    /**
     * Gets the most relevant date for sorting a space
     * @param {Object} space - Space object
     * @returns {string} Date string
     */
    getRelevantDate(space) {
        // Priority order for date selection:
        // 1. lastUpdated (most current activity)
        // 2. endedAt (for ended spaces)
        // 3. startedAt (when the space began)
        // 4. createdAt (fallback)
        return space.lastUpdated ||
            space.endedAt ||
            space.startedAt ||
            space.createdAt ||
            new Date(0).toISOString(); // Fallback to epoch if no date available
    }

    /**
     * Gets current filter values from the UI
     * @returns {Object} Filter values
     */
    getFilterValues() {
        return {
            // No status filter anymore - just return defaults
            limit: this.pageSize
        };
    }

    /**
     * Constructs X.com URL for a space
     * @param {Object} space - Space object
     * @returns {string|null} X.com URL or null if not constructible
     */
    getSpaceUrl(space) {
        // Try multiple approaches to construct the URL

        // Method 1: If we have a direct spaceId
        if (space.spaceId) {
            return `https://x.com/i/spaces/${space.spaceId}`;
        }

        // Method 2: If we have _id that looks like a space ID
        if (space._id && space._id.length > 10) {
            return `https://x.com/i/spaces/${space._id}`;
        }

        // Method 3: If we have host (now string), try to construct from that
        if (space.host) {
            // This might not always work for ended spaces, but worth trying
            const cleanHost = space.host.replace(/[@]/g, '');
            return `https://x.com/${cleanHost}`;
        }

        return null;
    }

    /**
     * Determines the privacy status of a space
     * @param {Object} space - Space object
     * @returns {Object} Privacy information with status and badge details
     */
    getPrivacyInfo(space) {
        // Handle new spaces with explicit private boolean
        if (typeof space.private === 'boolean') {
            return {
                isPrivate: space.private,
                status: space.private ? 'Private' : 'Public',
                badge: space.private ? 'badge-private' : 'badge-public',
                icon: space.private ? '🔒' : '📢',
                tooltip: space.private ? 'Not recorded - Private space' : 'Recorded - Public space'
            };
        }

        // Fallback for older spaces without private attribute
        // Try to infer from other indicators
        const hasRecording = space.recordingStatus || space.hlsUrl;

        return {
            isPrivate: null, // Unknown
            status: hasRecording ? 'Public (inferred)' : 'Unknown',
            badge: hasRecording ? 'badge-public' : 'badge-unknown',
            icon: hasRecording ? '📢' : '❓',
            tooltip: hasRecording ? 'Likely recorded based on available data' : 'Recording status unknown (older space)'
        };
    }

    /**
     * Gets anchor information for display
     * @param {Object} space - Space object
     * @returns {Object} Anchor information with display details
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

        const {
            displayName,
            role
        } = space.anchor;
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
     * Enhanced space display with format-agnostic audio mapping and transcription support
     * Updated for infinite scroll support
     * @param {Array<Object>} spaces - An array of Twitter Space objects.
     * @param {boolean} append - Whether to append (true) or replace (false) content
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
    }

    /**
     * Creates HTML for a single, compact space item.
     * @param {Object} space - Space object
     * @param {Array|null} audioFiles - Array of audio file objects
     * @param {string|null} spaceUrl - X.com URL for the space
     * @returns {string} HTML string for the space item
     */
    createSpaceItemHTML(space, audioFiles, transcription, spaceUrl, privacyInfo, anchorInfo) {
        const isLive = space.isLive;
        const statusClass = isLive ? 'status-live' : 'status-ended';
        const relevantDate = this.getRelevantDate(space);
        const timeAgo = this.formatTimeDisplay(space, relevantDate).replace('Started', 'Live for').replace('Ended', 'Ended');

        // Trim title to max 64 characters
        const rawTitle = space.title || 'Untitled Space';
        const displayTitle = rawTitle.length > 64 ? rawTitle.substring(0, 60) + '...' : rawTitle;

        // Create a compact metadata string with audio duration
        const metaParts = [];
        metaParts.push(space.host || 'Unknown Host');
        if (space.participantCount > 0) {
            metaParts.push(`${space.participantCount} listeners`);
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
        const hasTranscription = transcription;

        let actionsHTML = '';
        if (hasAudio) {
            // Use the first audio file for the primary listen button
            const firstAudio = audioFiles[0];
            const staticDownloadFilename = this.createDownloadFilename(space, firstAudio.filename);
            actionsHTML += `<a href="${firstAudio.url}" download="${staticDownloadFilename}" class="btn btn-secondary">Download</a>`;
        }
        if (hasTranscription) {
            // actionsHTML += `<a href="${transcription.url}" target="_blank" class="btn btn-secondary">Transcript</a>`;
            actionsHTML += `<a href="${space.transcriptLink}" target="_blank" class="btn btn-secondary">Transcript</a>`;
        }
        if (spaceUrl) {
            actionsHTML += `<a href="${spaceUrl}" target="_blank" class="btn btn-primary">Open on X</a>`;
        }


        return `
            <div class="space-item">
                <div class="status-indicator ${statusClass}" title="${isLive ? 'Live' : 'Ended'}"></div>
                <div class="space-details">
                    <div class="space-title">${displayTitle}</div>
                    <div class="space-metadata">${metadataText}</div>
                </div>
                <div class="space-actions">
                    ${actionsHTML}
                </div>
            </div>
        `;
    }

    /**
     * Creates a descriptive filename for downloads
     * @param {Object} space - Space object for context
     * @param {string} originalFilename - Original filename from server
     * @param {number} index - Index for multiple files (optional)
     * @returns {string} Formatted download filename
     */
    createDownloadFilename(space, originalFilename, index = null) {
        const hostSlug = Utils.slugify(space.host || 'unknown');
        const titleSlug = Utils.slugify(space.title || 'untitled');
        const dateStr = space.createdAt ?
            new Date(space.createdAt).toISOString().split('T')[0] :
            'unknown-date';

        // Extract file extension from original filename or default to mp3
        const extension = originalFilename?.match(/\.(mp3|aac|m4a|mp4)$/i)?.[1] || 'mp3';

        // Create descriptive filename
        let filename = `${hostSlug}_${titleSlug}_${dateStr}_${space._id}`;

        // Add index for multiple files
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
     * @param {string} spaceId - The ID of the space to view.
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


// Create global instance - This is CRITICAL for app.js to work
const dashboard = new Dashboard();

// Make dashboard globally available for debugging and access from other scripts
window.dashboard = dashboard;
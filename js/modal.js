/**
 * Modal management for the Twitter Spaces Dashboard with Privacy Information and Anchor Data
 * Updated to handle host as string and display anchor information
 */

class ModalManager {
    constructor() {
        this.modalElement = null;
        this.modalTitle = null;
        this.modalContent = null;
        this.init();
    }

    /**
     * Initialize modal elements and event listeners
     */
    init() {
        this.modalElement = Utils.getElementById('detailModal');
        this.modalTitle = document.querySelector('#detailModal h2');
        this.modalContent = Utils.getElementById('modalContent');

        // Close modal when clicking outside of it
        window.addEventListener('click', (event) => {
            if (event.target === this.modalElement) {
                this.close();
            }
        });

        // Close modal with Escape key
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && this.isOpen()) {
                this.close();
            }
        });
    }

    /**
     * Opens the modal with the given title and content.
     * @param {string} title - The title for the modal.
     * @param {string} content - The content to display in the modal.
     */
    open(title, content) {
        if (!this.modalElement) {
            console.error('Modal element not found');
            return;
        }

        if (this.modalTitle) {
            this.modalTitle.textContent = title;
        }

        if (this.modalContent) {
            this.modalContent.textContent = content;
        }

        this.modalElement.style.display = 'flex';
        
        // Focus management for accessibility
        this.modalElement.focus();
    }

    /**
     * Closes the currently open modal.
     */
    close() {
        if (this.modalElement) {
            this.modalElement.style.display = 'none';
        }
    }

    /**
     * Checks if modal is currently open
     * @returns {boolean} True if modal is open
     */
    isOpen() {
        return this.modalElement && this.modalElement.style.display === 'flex';
    }

    /**
     * Gets privacy information for display
     * @param {Object} space - Space object
     * @returns {string} Privacy status string for display
     */
    getPrivacyDisplayInfo(space) {
        if (typeof space.private === 'boolean') {
            return space.private ? 
                'Private (Not recorded)' : 
                'Public (Recorded)';
        }
        
        // Fallback for older spaces
        const hasRecording = space.recordingStatus || space.hlsUrl;
        return hasRecording ? 
            'Public (Inferred from recording data)' : 
            'Unknown (Legacy space - privacy status not tracked)';
    }

    /**
     * Gets anchor information for display
     * @param {Object} space - Space object
     * @returns {string} Anchor information string for display
     */
    getAnchorDisplayInfo(space) {
        if (!space.anchor) {
            return 'None - Space discovery method unknown';
        }

        const { displayName, role } = space.anchor;
        const roleDescriptions = {
            hosting: 'was hosting the space',
            speaking: 'was speaking in the space',
            listening: 'was listening to the space'
        };

        return `${displayName} (${roleDescriptions[role] || role}) - This is why the space was recorded`;
    }

    /**
     * Opens modal with space details including privacy and anchor information
     * Updated to handle host as string and include anchor data
     * @param {Object} space - Space object
     */
    showSpaceDetails(space) {
        const privacyStatus = this.getPrivacyDisplayInfo(space);
        const anchorInfo = this.getAnchorDisplayInfo(space);
        
        // UPDATED: Handle host as string instead of object
        const hostDisplay = space.host || 'Unknown';
        
        const details = `
Space: ${space.title || 'Untitled'}
Host: ${hostDisplay}
Status: ${space.isLive ? 'LIVE' : 'ENDED'}
Privacy: ${privacyStatus}
Discovery Anchor: ${anchorInfo}
Participants: ${space.participantCount || 0}
Created: ${Utils.formatDate(space.createdAt)}
Updated: ${Utils.formatDate(space.lastUpdated)}
${space.startedAt ? `Started: ${Utils.formatDate(space.startedAt)}` : ''}
${space.endedAt ? `Ended: ${Utils.formatDate(space.endedAt)}` : ''}
${space.hlsUrl ? `\nStream URL: ${space.hlsUrl}` : ''}
${space.recordingStatus ? `Recording Status: ${space.recordingStatus}` : ''}
${space.description ? `\nDescription: ${space.description}` : ''}
${space.spaceId ? `\nSpace ID: ${space.spaceId}` : ''}
${typeof space.private === 'boolean' ? `\nPrivacy Explicit: ${space.private ? 'Private' : 'Public'}` : '\nPrivacy Explicit: Not specified (legacy space)'}
${space.anchor ? `\nAnchor Details: 
  Display Name: ${space.anchor.displayName}
  Role: ${space.anchor.role}
  Explanation: This space was recorded because you follow ${space.anchor.displayName} who was ${space.anchor.role}` : '\nAnchor Details: No anchor information (discovery method unknown)'}
        `.trim();
        
        this.open('Space Details', details);
    }

    /**
     * Opens modal with participants list
     * @param {Array} participants - Array of participants
     * @param {string} spaceTitle - Title of the space
     */
    showParticipants(participants, spaceTitle = 'Space') {
        if (!participants || participants.length === 0) {
            this.open('Participants', 'No participants found for this space');
            return;
        }
        
        const participantsList = participants
            .map(p => `${p.name || p.username || 'Unknown'} (${p.role || 'listener'})`)
            .join('\n');
        
        this.open(`Participants in "${spaceTitle}"`, participantsList);
    }

    /**
     * Opens modal with debug information including privacy statistics and anchor data
     * @param {string} debugInfo - Debug information to display
     */
    showDebugInfo(debugInfo) {
        this.open('MP3 Mapping, Privacy & Anchor Debug', debugInfo);
    }
}

// Create global instance
const modal = new ModalManager();
window.modal = modal;
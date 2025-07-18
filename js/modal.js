/**
 * Enhanced Modal management with HTML content support and participant modal functionality
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
        // Create modal if it doesn't exist
        this.createModalElement();
        
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
     * Creates the modal HTML structure if it doesn't exist
     */
    createModalElement() {
        if (document.getElementById('detailModal')) return;

        const modalHTML = `
            <div id="detailModal" class="modal">
                <div class="modal-content">
                    <span class="modal-close">&times;</span>
                    <h2>Modal Title</h2>
                    <div id="modalContent">Modal content goes here</div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);

        // Add click handler for close button
        const closeBtn = document.querySelector('#detailModal .modal-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.close());
        }
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
     * Opens the modal with HTML content instead of plain text
     * @param {string} title - The title for the modal
     * @param {string} htmlContent - The HTML content to display
     */
    openWithHTML(title, htmlContent) {
        if (!this.modalElement) {
            console.error('Modal element not found');
            return;
        }

        if (this.modalTitle) {
            this.modalTitle.textContent = title;
        }

        if (this.modalContent) {
            this.modalContent.innerHTML = htmlContent;
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
        
        // Handle host as string instead of object
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
     * Opens modal with participants list (legacy version for backward compatibility)
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
     * Shows enhanced participants modal with role grouping and avatars
     * @param {Object} participantsData - Full participants data from API
     * @param {string} spaceTitle - Title of the space
     */
    showParticipantsModal(participantsData, spaceTitle = 'Space') {
        if (!participantsData || !participantsData.participants || participantsData.participants.length === 0) {
            this.open('Participants', 'No participants found for this space');
            return;
        }

        // Group participants by role
        const participantsByRole = participantsData.participantsByRole || {};
        
        let modalContent = `<div class="participants-modal-content">`;
        modalContent += `<h3>Participants in "${spaceTitle}"</h3>`;
        modalContent += `<p class="participants-count">Total: ${participantsData.totalParticipants || participantsData.participants.length} participants</p>`;
        
        // Display by role with proper ordering
        const roleOrder = ['host', 'co-host', 'speaker', 'listener'];
        roleOrder.forEach(role => {
            const roleParticipants = participantsByRole[role] || [];
            if (roleParticipants.length > 0) {
                const roleTitle = role === 'co-host' ? 'Co-host' : 
                                role.charAt(0).toUpperCase() + role.slice(1);
                modalContent += `
                    <div class="participants-role-section">
                        <h4>${roleTitle}s (${roleParticipants.length})</h4>
                        <div class="participants-list">
                `;
                
                roleParticipants.forEach(participant => {
                    const profileImage = api.enhanceImageQuality(participant.profileImage) || participant.profileImage;
                    const username = participant.username.replace('@', '');
                    const fallbackAvatar = `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40"><rect width="40" height="40" fill="%23ddd"/><text x="20" y="25" text-anchor="middle" font-size="16" fill="%23666">${participant.name.charAt(0).toUpperCase()}</text></svg>`;
                    
                    modalContent += `
                        <div class="participant-item">
                            <img src="${profileImage || fallbackAvatar}" 
                                 alt="${participant.name}" 
                                 class="participant-modal-avatar"
                                 onerror="this.src='${fallbackAvatar}'">
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
        
        // Show modal with custom HTML content
        this.openWithHTML('Participants', modalContent);
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
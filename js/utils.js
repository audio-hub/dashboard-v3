/**
 * Utility functions for the Twitter Spaces Dashboard
 */

const Utils = {
    /**
     * Displays a temporary message (error or success) on the page.
     * @param {string} message - The message to display.
     * @param {string} type - The type of message ('error' or 'success').
     */
    showMessage(message, type = CONFIG.MESSAGE_TYPES.ERROR) {
        const existing = document.querySelector('.error, .success');
        if (existing) existing.remove();

        const div = document.createElement('div');
        div.className = type;
        div.textContent = message;
        document.querySelector('.container').insertBefore(div, document.querySelector('.spaces-container'));
        
        setTimeout(() => div.remove(), CONFIG.MESSAGE_TIMEOUT);
    },

    /**
     * Improved slugify function that handles edge cases better.
     * @param {string} text - The input text.
     * @returns {string} The slugified text.
     */
    slugify(text) {
        if (!text) return '';
        return String(text)
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .trim()
            .replace(/[^\w\s-]/g, '')  // Remove punctuation but keep spaces and hyphens
            .replace(/\s+/g, '-')      // Replace spaces with hyphens
            .replace(/-+/g, '-')       // Replace multiple hyphens with single
            .replace(/^-+|-+$/g, '');  // Remove leading/trailing hyphens
    },

    /**
     * Enhanced function to create multiple mapping keys for better matching.
     * @param {string} host - The host username.
     * @param {string} title - The space title.
     * @returns {Array<string>} Array of possible keys to try.
     */
    createMappingKeys(host, title) {
        if (!host || !title) return [];
        
        const hostSlug = this.slugify(host);
        const titleSlug = this.slugify(title);
        
        const keys = [];
        
        // Original key format
        keys.push(`${hostSlug}-${titleSlug}`);
        
        // Try with just the first few words of the title
        const titleWords = titleSlug.split('-');
        if (titleWords.length > 3) {
            keys.push(`${hostSlug}-${titleWords.slice(0, 3).join('-')}`);
            keys.push(`${hostSlug}-${titleWords.slice(0, 4).join('-')}`);
            keys.push(`${hostSlug}-${titleWords.slice(0, 5).join('-')}`);
        }
        
        // Try without common prefix/suffix words
        const cleanTitle = titleSlug
            .replace(/^(the-|a-|an-)/g, '')
            .replace(/(-space|-listening|-live|-show|-podcast)$/g, '');
        
        if (cleanTitle !== titleSlug) {
            keys.push(`${hostSlug}-${cleanTitle}`);
        }
        
        return [...new Set(keys)]; // Remove duplicates
    },

    /**
     * Format date to locale string
     * @param {string|Date} dateString - Date to format
     * @returns {string} Formatted date string
     */
    formatDate(dateString) {
        if (!dateString) return 'Unknown';
        return new Date(dateString).toLocaleString();
    },

    /**
     * Get DOM element by ID with error handling
     * @param {string} id - Element ID
     * @returns {HTMLElement|null} DOM element or null
     */
    getElementById(id) {
        const element = document.getElementById(id);
        if (!element) {
            console.warn(`Element with ID '${id}' not found`);
        }
        return element;
    },

    /**
     * Debounce function to limit function calls
     * @param {Function} func - Function to debounce
     * @param {number} wait - Wait time in milliseconds
     * @returns {Function} Debounced function
     */
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
};

function toggleSection(sectionId) {
    const content = document.getElementById(sectionId);
    const toggleIcon = document.getElementById(sectionId.replace('-panel', '-toggle').replace('-section', '-toggle'));
    
    if (!content || !toggleIcon) return;
    
    const isOpen = content.style.display !== 'none';
    
    if (isOpen) {
        // Close
        content.style.display = 'none';
        toggleIcon.classList.remove('open');
    } else {
        // Open
        content.style.display = 'block';
        toggleIcon.classList.add('open');
    }
}

// Make it globally available
window.toggleSection = toggleSection;

// Make Utils globally available
window.Utils = Utils;

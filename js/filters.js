/**
 * Filter Manager - Handles space filtering functionality
 */

class FilterManager {
    constructor() {
        this.filterToggle = null;
        this.filterPanel = null;
        this.filters = {
            privacy: '',
            host: '',
            search: '',
            overrideOnly: false
        };
        this.onFilterChange = null;
        this.init();
    }

    /**
     * Initialize the filter manager
     */
    init() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setup());
        } else {
            this.setup();
        }
    }

    /**
     * Setup filter elements and event listeners
     */
    setup() {
        this.createFilterHTML();
        this.setupEventListeners();
    }

    /**
     * Create filter dropdown HTML
     */
    createFilterHTML() {
        const container = document.querySelector('.container');
        const spacesContainer = document.querySelector('.spaces-container');
        
        if (!container || !spacesContainer) {
            console.warn('Filter Manager: Required elements not found');
            return;
        }

        const filterHTML = `
            <div class="filter-dropdown">
                <button class="filter-toggle" id="filterToggle">
                    🔍 Filters
                </button>
                <div class="filter-panel" id="filterPanel">
                    <div class="filter-group">
                        <label for="privacyFilter">Privacy</label>
                        <select class="filter-select" id="privacyFilter">
                            <option value="">All</option>
                            <option value="public">Public</option>
                            <option value="private">Private</option>
                        </select>
                    </div>
                    
                    <div class="filter-group">
                        <label for="hostFilter">Filter by Host</label>
                        <input type="text" class="filter-input" id="hostFilter" placeholder="Enter host username...">
                    </div>
                    
                    <div class="filter-group">
                        <label for="searchFilter">Search</label>
                        <input type="text" class="filter-input" id="searchFilter" placeholder="Search spaces...">
                    </div>
                    
                    <div class="filter-group">
                        <div class="filter-switch">
                            <label class="switch">
                                <input type="checkbox" id="overrideFilter">
                                <span class="slider"></span>
                            </label>
                            <label for="overrideFilter">Show Override Only</label>
                        </div>
                    </div>
                </div>
            </div>
        `;

        spacesContainer.insertAdjacentHTML('beforebegin', filterHTML);
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        this.filterToggle = document.getElementById('filterToggle');
        this.filterPanel = document.getElementById('filterPanel');
        
        if (this.filterToggle && this.filterPanel) {
            this.filterToggle.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleDropdown();
            });
            
            // Close filter when clicking outside
            document.addEventListener('click', (event) => {
                const dropdown = document.querySelector('.filter-dropdown');
                if (dropdown && !dropdown.contains(event.target)) {
                    this.closeDropdown();
                }
            });
        }

        // Filter input listeners
        const privacyFilter = document.getElementById('privacyFilter');
        const hostFilter = document.getElementById('hostFilter');
        const searchFilter = document.getElementById('searchFilter');
        const overrideFilter = document.getElementById('overrideFilter');
        
        const applyFilters = Utils.debounce(() => {
            this.updateFilters();
        }, 300);
        
        if (privacyFilter) privacyFilter.addEventListener('change', applyFilters);
        if (hostFilter) hostFilter.addEventListener('input', applyFilters);
        if (searchFilter) searchFilter.addEventListener('input', applyFilters);
        if (overrideFilter) overrideFilter.addEventListener('change', applyFilters);
    }

    /**
     * Toggle dropdown visibility
     */
    toggleDropdown() {
        this.filterToggle.classList.toggle('open');
        this.filterPanel.classList.toggle('open');
    }

    /**
     * Close dropdown
     */
    closeDropdown() {
        this.filterToggle.classList.remove('open');
        this.filterPanel.classList.remove('open');
    }

    /**
     * Update filter values and trigger callback
     */
    updateFilters() {
        this.filters.privacy = document.getElementById('privacyFilter')?.value || '';
        this.filters.host = document.getElementById('hostFilter')?.value.toLowerCase().trim() || '';
        this.filters.search = document.getElementById('searchFilter')?.value.toLowerCase().trim() || '';
        this.filters.overrideOnly = document.getElementById('overrideFilter')?.checked || false;
        
        if (this.onFilterChange && typeof this.onFilterChange === 'function') {
            this.onFilterChange(this.filters);
        }
    }

    /**
     * Apply filters to a list of spaces
     */
    applyFiltersToSpaces(spaces) {
        if (!spaces || spaces.length === 0) return [];
        
        return spaces.filter(space => {
            // Privacy filter
            if (this.filters.privacy) {
                const isPrivate = space.private === true;
                if (this.filters.privacy === 'private' && !isPrivate) return false;
                if (this.filters.privacy === 'public' && isPrivate) return false;
            }
            
            // Host filter
            if (this.filters.host && (!space.host || !space.host.toLowerCase().includes(this.filters.host))) {
                return false;
            }
            
            // Search filter
            if (this.filters.search) {
                const title = (space.title || '').toLowerCase();
                const hostName = (space.host || '').toLowerCase();
                if (!title.includes(this.filters.search) && !hostName.includes(this.filters.search)) {
                    return false;
                }
            }
            
            // Override filter
            if (this.filters.overrideOnly && !space.isOverride) {
                return false;
            }
            
            return true;
        });
    }

    /**
     * Set callback for filter changes
     */
    setOnFilterChange(callback) {
        this.onFilterChange = callback;
    }

    /**
     * Get current filter values
     */
    getFilters() {
        return { ...this.filters };
    }

    /**
     * Clear all filters
     */
    clearFilters() {
        const privacyFilter = document.getElementById('privacyFilter');
        const hostFilter = document.getElementById('hostFilter');
        const searchFilter = document.getElementById('searchFilter');
        const overrideFilter = document.getElementById('overrideFilter');
        
        if (privacyFilter) privacyFilter.value = '';
        if (hostFilter) hostFilter.value = '';
        if (searchFilter) searchFilter.value = '';
        if (overrideFilter) overrideFilter.checked = false;
        
        this.updateFilters();
    }
}

// Create global instance
const filterManager = new FilterManager();
window.filterManager = filterManager;
document.addEventListener('DOMContentLoaded', () => {
    // ======================== UTILITY FUNCTIONS ========================

    const escapeHtml = (str) => {
        if (!str) return '';
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    };

    const formatDuration = (seconds) => {
        if (!seconds || isNaN(seconds)) return 'Unknown';
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    const formatFileSize = (bytes) => {
        if (!bytes || bytes === 0) return '0 B';
        const units = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(Math.abs(bytes)) / Math.log(1024));
        const size = (bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0);
        return `${size} ${units[i]}`;
    };

    const formatDate = (dateStr) => {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr || 'Unknown';
        return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    };

    // ====== RIPPLE EFFECT ======
    function addRippleEffect() {
        document.querySelectorAll('.ripple-btn, button:not(.no-ripple)').forEach(btn => {
            if (btn.dataset.rippleInitted) return;
            btn.dataset.rippleInitted = 'true';
            btn.style.position = 'relative';
            btn.style.overflow = 'hidden';
            btn.addEventListener('click', function(e) {
                const rect = this.getBoundingClientRect();
                const size = Math.max(rect.width, rect.height);
                const x = e.clientX - rect.left - size / 2;
                const y = e.clientY - rect.top - size / 2;
                const ripple = document.createElement('span');
                ripple.style.cssText = `position:absolute;width:${size}px;height:${size}px;left:${x}px;top:${y}px;border-radius:50%;background:rgba(255,255,255,0.25);transform:scale(0);animation:rippleAnim 0.6s ease-out;pointer-events:none;`;
                this.appendChild(ripple);
                setTimeout(() => ripple.remove(), 600);
            });
        });
    }

    // Add the keyframe if not present
    if (!document.getElementById('ripple-style')) {
        const style = document.createElement('style');
        style.id = 'ripple-style';
        style.textContent = `@keyframes rippleAnim { from { transform: scale(0); opacity: 0.5; } to { transform: scale(4); opacity: 0; } }`;
        document.head.appendChild(style);
    }

    // Call after DOM is ready
    addRippleEffect();

    // ====== 3D CARD TILT ======
    function initCardTilt() {
        document.querySelectorAll('.tilt-card').forEach(card => {
            if (card.dataset.tiltInitted) return;
            card.dataset.tiltInitted = 'true';
            card.addEventListener('mousemove', (e) => {
                const rect = card.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                const centerX = rect.width / 2;
                const centerY = rect.height / 2;
                const rotateX = (y - centerY) / centerY * -8;
                const rotateY = (x - centerX) / centerX * 8;
                card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02)`;
            });
            card.addEventListener('mouseleave', () => {
                card.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)';
                card.style.transition = 'transform 0.5s ease';
                setTimeout(() => { card.style.transition = ''; }, 500);
            });
        });
    }

    // Also add tilt to dynamically created cards
    const origCreateVideoCard = window.createVideoCard;

    // ====== SPOTLIGHT EFFECT ======
    function initSpotlight() {
        document.querySelectorAll('.spotlight-card').forEach(card => {
            if (card.dataset.spotlightInitted) return;
            card.dataset.spotlightInitted = 'true';
            card.style.position = 'relative';
            card.style.overflow = 'hidden';

            const spot = document.createElement('div');
            spot.style.cssText = 'position:absolute;pointer-events:none;width:300px;height:300px;border-radius:50%;background:radial-gradient(circle,rgba(99,102,241,0.08),transparent 70%);opacity:0;transition:opacity 0.3s;transform:translate(-50%,-50%);top:0;left:0;';
            card.appendChild(spot);

            card.addEventListener('mouseenter', () => { spot.style.opacity = '1'; });
            card.addEventListener('mousemove', (e) => {
                const rect = card.getBoundingClientRect();
                spot.style.left = (e.clientX - rect.left) + 'px';
                spot.style.top = (e.clientY - rect.top) + 'px';
            });
            card.addEventListener('mouseleave', () => { spot.style.opacity = '0'; });
        });
    }

    // ======================== CUSTOM TOOLTIP SYSTEM ========================

    const tooltipEl = document.getElementById('global-tooltip');
    if (!tooltipEl) {
        const t = document.createElement('div');
        t.id = 'global-tooltip';
        document.body.appendChild(t);
    }

    const activeTooltips = new Map();

    function initTooltip(element, title, description) {
        if (!element) return;
        element.dataset.tooltip = (title || '') + '||' + (description || '');
        if (element._tooltipInitted) return;
        element._tooltipInitted = true;
        element.addEventListener('mouseenter', (e) => {
            const tooltip = document.getElementById('global-tooltip');
            const [t, d] = element.dataset.tooltip.split('||');
            if (t) {
                tooltip.innerHTML = `<div class="tooltip-title">${escapeHtml(t)}</div><div class="tooltip-desc">${escapeHtml(d)}</div>`;
            } else {
                tooltip.innerHTML = `<div class="tooltip-desc">${escapeHtml(d)}</div>`;
            }
            positionTooltip(tooltip, e);
            tooltip.classList.add('show');
        });
        element.addEventListener('mousemove', (e) => {
            const tooltip = document.getElementById('global-tooltip');
            positionTooltip(tooltip, e);
        });
        element.addEventListener('mouseleave', () => {
            const tooltip = document.getElementById('global-tooltip');
            tooltip.classList.remove('show');
        });
    }

    function positionTooltip(tooltip, e) {
        const padding = 12;
        let x = e.clientX + padding;
        let y = e.clientY + padding;
        const rect = tooltip.getBoundingClientRect();
        if (x + rect.width > window.innerWidth - 10) {
            x = e.clientX - rect.width - padding;
        }
        if (y + rect.height > window.innerHeight - 10) {
            y = e.clientY - rect.height - padding;
        }
        tooltip.style.left = Math.max(5, x) + 'px';
        tooltip.style.top = Math.max(5, y) + 'px';
    }

    // Helper to auto-init all [data-tooltip] elements in the DOM
    function initDataTooltips() {
        document.querySelectorAll('[data-tooltip]').forEach(el => {
            if (!el._tooltipInitted) {
                const val = el.dataset.tooltip;
                initTooltip(el, '', val);
            }
        });
    }

    // ======================== TOAST SYSTEM ========================

    let toastContainer = document.getElementById('toastContainer');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'toastContainer';
        toastContainer.className = 'fixed top-4 right-4 z-[100] flex flex-col gap-3 max-w-sm w-full pointer-events-none';
        document.body.appendChild(toastContainer);
    }

    const showToast = (message, type = 'info') => {
        const colors = {
            success: 'bg-green-50 border-green-200 text-green-800 dark:bg-green-900/30 dark:border-green-700 dark:text-green-300',
            error: 'bg-red-50 border-red-200 text-red-800 dark:bg-red-900/30 dark:border-red-700 dark:text-red-300',
            info: 'bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-900/30 dark:border-blue-700 dark:text-blue-300',
        };
        const icons = {
            success: '<i class="fa-solid fa-circle-check text-green-400 text-lg"></i>',
            error: '<i class="fa-solid fa-circle-xmark text-red-400 text-lg"></i>',
            info: '<i class="fa-solid fa-circle-info text-blue-400 text-lg"></i>',
        };
        const progressColors = {
            success: 'bg-green-400',
            error: 'bg-red-400',
            info: 'bg-blue-400',
        };
        const toast = document.createElement('div');
        toast.className = `pointer-events-auto rounded-lg border p-4 shadow-lg transition-all duration-300 ${colors[type] || colors.info}`;
        toast.innerHTML = `<div class="flex items-start gap-3"><div class="flex-shrink-0 mt-0.5">${icons[type] || icons.info}</div><div class="flex-1 text-sm font-medium">${message}</div><button class="flex-shrink-0 ml-2 text-gray-400 hover:text-gray-600" onclick="this.parentElement.parentElement.remove()"><i class="fa-solid fa-xmark"></i></button></div><div class="mt-2 w-full bg-gray-200 dark:bg-gray-600 rounded-full h-1 overflow-hidden"><div class="toast-progress h-full rounded-full ${progressColors[type] || progressColors.info} transition-all duration-300 ease-linear" style="width:100%"></div></div>`;

        // Stagger: animate in with slight delay per toast
        const toasts = toastContainer.querySelectorAll(':scope > div');
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(20px)';
        const staggerDelay = Math.min(toasts.length * 50, 300);
        setTimeout(() => {
            toast.style.opacity = '1';
            toast.style.transform = 'translateX(0)';
        }, 50 + staggerDelay);

        toastContainer.appendChild(toast);

        // Countdown progress bar
        const duration = 5000;
        const startTime = Date.now();
        const progressEl = toast.querySelector('.toast-progress');
        const interval = setInterval(() => {
            const elapsed = Date.now() - startTime;
            const remaining = Math.max(0, 1 - elapsed / duration);
            if (progressEl) progressEl.style.width = (remaining * 100) + '%';
            if (elapsed >= duration) {
                clearInterval(interval);
            }
        }, 50);

        setTimeout(() => {
            clearInterval(interval);
            if (toast.parentElement) {
                toast.style.opacity = '0';
                toast.style.transform = 'translateX(100%)';
                setTimeout(() => toast.remove(), 300);
            }
        }, duration);
    };

    // --- Modal System ---
    const showModal = (html, onClose) => {
        const overlay = document.createElement('div');
        overlay.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4';
        overlay.innerHTML = `<div class="bg-white rounded-xl shadow-2xl max-w-5xl w-full max-h-[85vh] overflow-auto p-6 relative">${html}</div>`;
        const closeModal = () => { overlay.remove(); if (onClose) onClose(); };
        overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });
        const closeBtn = overlay.querySelector('.modal-close');
        if (closeBtn) closeBtn.addEventListener('click', closeModal);
        document.body.appendChild(overlay);
        return { overlay, close: closeModal };
    };

    // --- Status / Loading (existing API) ---
    const statusMessage = document.getElementById('statusMessage');
    const statusIcon = document.getElementById('statusIcon');
    const statusText = document.getElementById('statusText');
    const loadingIndicator = document.getElementById('loadingIndicator');
    const loadingText = document.getElementById('loadingText');
    const resultsContainer = document.getElementById('resultsContainer');
    const resultsGrid = document.getElementById('resultsGrid');
    const resultsTitle = document.getElementById('resultsTitle');

    const showLoading = (text) => {
        if (statusMessage) statusMessage.classList.add('hidden');
        if (resultsContainer) resultsContainer.classList.add('hidden');
        if (loadingIndicator) {
            loadingIndicator.classList.remove('hidden');
            loadingIndicator.classList.add('flex');
        }
        if (loadingText) loadingText.textContent = text || 'Processing...';
    };

    const hideLoading = () => {
        if (loadingIndicator) {
            loadingIndicator.classList.add('hidden');
            loadingIndicator.classList.remove('flex');
        }
    };

    const showSkeleton = (type = 'grid') => {
        showLoading('Loading...');
        const rg = document.getElementById('resultsGrid');
        if (!rg) return;
        rg.innerHTML = '';
        const count = type === 'video' ? 1 : 8;
        for (let i = 0; i < count; i++) {
            const skeleton = document.createElement('div');
            skeleton.className = 'animate-pulse bg-white dark:bg-gray-800 rounded-xl overflow-hidden';
            skeleton.innerHTML = `
                <div class="aspect-video bg-gray-200 dark:bg-gray-700"></div>
                <div class="p-4 space-y-3">
                    <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
                    <div class="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
                    <div class="h-9 bg-gray-200 dark:bg-gray-700 rounded mt-4"></div>
                </div>
            `;
            rg.appendChild(skeleton);
        }
    };

    const hideSkeleton = () => {
        const rg = document.getElementById('resultsGrid');
        if (rg) rg.innerHTML = '';
    };

    const showError = (message) => {
        if (statusMessage) {
            statusMessage.className = 'rounded-md p-4 mb-8 bg-red-50 border border-red-200';
            if (statusIcon) statusIcon.innerHTML = '<i class="fa-solid fa-circle-xmark text-red-400 text-lg"></i>';
            if (statusText) { statusText.className = 'text-sm font-medium text-red-800'; statusText.textContent = message; }
            statusMessage.classList.remove('hidden');
        }
    };

    const showSuccess = (message) => {
        if (statusMessage) {
            statusMessage.className = 'rounded-md p-4 mb-8 bg-green-50 border border-green-200';
            if (statusIcon) statusIcon.innerHTML = '<i class="fa-solid fa-circle-check text-green-400 text-lg"></i>';
            if (statusText) { statusText.className = 'text-sm font-medium text-green-800'; statusText.textContent = message; }
            statusMessage.classList.remove('hidden');
        }
    };

    const showInfo = (message) => {
        if (statusMessage) {
            statusMessage.className = 'rounded-md p-4 mb-8 bg-blue-50 border border-blue-200';
            if (statusIcon) statusIcon.innerHTML = '<i class="fa-solid fa-circle-info text-blue-400 text-lg"></i>';
            if (statusText) { statusText.className = 'text-sm font-medium text-blue-800'; statusText.textContent = message; }
            statusMessage.classList.remove('hidden');
        }
    };

    let currentOptions = {};

    // ======================== TAB SYSTEM ========================

    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    let currentTab = null;
    let queueEventSource = null;
    let queuePollInterval = null;

    // Tooltips for tab buttons
    const tabTooltips = {
        download: 'Search, preview, and download videos one at a time.',
        setup: 'Install or update yt-dlp and ffmpeg, the engines that power downloads.',
        downloads: 'Browse files you\'ve already downloaded.',
        channels: 'Save your favorite channels to browse their videos anytime. Pick what you want and batch-download.',
        queue: 'See what\'s downloading, how it\'s progressing, and manage multiple downloads running at once.',
        options: 'Fine-tune how yt-dlp works with advanced settings for power users.',
    };
    tabBtns.forEach(btn => {
        const tab = btn.dataset.tab;
        if (tab && tabTooltips[tab]) {
            initTooltip(btn, '', tabTooltips[tab]);
        }
    });

    const updateTabBadge = (tabId, count) => {
        const btn = document.querySelector(`.tab-btn[data-tab="${tabId}"]`);
        if (!btn) return;
        let badge = btn.querySelector('.tab-badge');
        if (count > 0) {
            if (!badge) {
                badge = document.createElement('span');
                badge.className = 'tab-badge ml-1 inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-bold leading-none text-white bg-red-500 rounded-full';
                btn.appendChild(badge);
            }
            badge.textContent = count > 99 ? '99+' : count;
        } else {
            if (badge) badge.remove();
        }
    };

    const activateTab = (tabId) => {
        if (!tabId || tabId === currentTab) return;

        // Cleanup previous tab
        if (currentTab === 'queue') {
            if (queueEventSource) { queueEventSource.close(); queueEventSource = null; }
            if (queuePollInterval) { clearInterval(queuePollInterval); queuePollInterval = null; }
        }

        const oldTab = currentTab;
        currentTab = tabId;

        // Update tab buttons
        tabBtns.forEach(btn => {
            btn.classList.remove('tab-active');
            btn.classList.add('text-gray-400', 'border-transparent');
        });

        const activeBtn = document.querySelector(`.tab-btn[data-tab="${tabId}"]`);
        if (activeBtn) {
            activeBtn.classList.add('tab-active');
            activeBtn.classList.remove('text-gray-400', 'border-transparent');
        }

        // Fade out old content, fade in new
        const oldContent = oldTab ? document.getElementById(`tab-${oldTab}`) : null;
        const newContent = document.getElementById(`tab-${tabId}`);

        if (oldContent) {
            oldContent.style.opacity = '0';
            oldContent.style.transform = 'translateY(8px)';
            oldContent.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
            setTimeout(() => {
                oldContent.classList.add('hidden');
                if (newContent) {
                    newContent.classList.remove('hidden');
                    newContent.style.opacity = '0';
                    newContent.style.transform = 'translateY(8px)';
                    requestAnimationFrame(() => {
                        newContent.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
                        newContent.style.opacity = '1';
                        newContent.style.transform = 'translateY(0)';
                    });
                }
            }, 200);
        } else {
            if (newContent) {
                newContent.classList.remove('hidden');
                newContent.style.opacity = '0';
                newContent.style.transform = 'translateY(8px)';
                requestAnimationFrame(() => {
                    newContent.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
                    newContent.style.opacity = '1';
                    newContent.style.transform = 'translateY(0)';
                });
            }
        }

        // Tab-specific activation logic
        if (tabId === 'downloads') setTimeout(() => {
            try { if (typeof loadFiles === 'function') loadFiles(); else throw new Error('loadFiles not defined'); }
            catch (e) { console.error('Downloads tab init failed:', e); }
        }, 300);
        if (tabId === 'setup') setTimeout(() => {
            try { if (typeof checkSetupStatus === 'function') checkSetupStatus(); else throw new Error('checkSetupStatus not defined'); }
            catch (e) { console.error('Setup tab init failed:', e); }
        }, 300);
        if (tabId === 'channels') setTimeout(() => {
            try { if (typeof loadChannels === 'function') loadChannels(); else throw new Error('loadChannels not defined'); }
            catch (e) { console.error('Channels tab init failed:', e); }
        }, 300);
        if (tabId === 'queue') setTimeout(() => {
            try {
                if (typeof initQueueSSE === 'function') {
                    initQueueSSE();
                } else {
                    throw new Error('initQueueSSE not defined');
                }
            } catch (e) {
                console.error('Queue tab init failed:', e);
                // Always resolve the loading skeleton
                const ql = document.getElementById('queueLoading');
                const qe = document.getElementById('queueEmpty');
                if (ql) ql.classList.add('hidden');
                if (qe) qe.classList.remove('hidden');
            }
        }, 300);
        if (tabId === 'options') setTimeout(() => {
            try { if (typeof loadOptions === 'function') loadOptions(); else throw new Error('loadOptions not defined'); }
            catch (e) { console.error('Options tab init failed:', e); }
        }, 300);
    };

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => activateTab(btn.dataset.tab));
    });

    // ======================== DOWNLOAD TAB ========================

    const urlInput = document.getElementById('urlInput');
    const btnMetadata = document.getElementById('btnMetadata');
    const btnScrape = document.getElementById('btnScrape');
    const qualitySelect = document.getElementById('qualitySelect');
    const formatSelect = document.getElementById('formatSelect');
    const audioOnlyToggle = document.getElementById('audioOnlyToggle');

    // Tooltips for Download tab elements
    initTooltip(urlInput, '', 'Paste any YouTube link here \u2014 a single video, a whole playlist, or a channel. Works with most sites yt-dlp supports.');
    initTooltip(btnMetadata, '', 'Look up info about a single video: title, thumbnail, duration, uploader. Useful to preview before downloading.');
    initTooltip(btnScrape, '', 'List every video in a playlist or channel so you can pick which ones to download.');
    initTooltip(qualitySelect, '', 'Pick your preferred video sharpness. \u201cBest\u201d grabs the highest quality, \u201c1080p\u201d is Full HD, \u201c720p\u201d is standard HD, \u201c480p\u201d is DVD quality \u2014 smaller file, faster download.');
    initTooltip(formatSelect, '', 'Video packaging. MP4 works on everything \u2014 phones, TVs, computers. WebM is Google\u2019s format, often smaller file size.');
    initTooltip(audioOnlyToggle, '', 'Check this to download just the sound \u2014 perfect for music, podcasts, or saving data.');

    // Wire up existing format list button
    const btnListFormats = document.getElementById('btnFormatList');
    initTooltip(btnListFormats, '', 'See every format available for this video \u2014 different resolutions, codecs, and file sizes.');
    if (btnListFormats) {
        btnListFormats.addEventListener('click', async () => {
                const url = urlInput.value.trim();
                if (!url) return showError('Please enter a URL first');
                try {
                    showLoading('Fetching available formats...');
                    const response = await fetch(`/api/format-list?url=${encodeURIComponent(url)}`);
                    if (!response.ok) {
                        let errMsg = 'Failed to fetch formats';
                        try { const d = await response.json(); errMsg = d.error || errMsg; } catch (e) {}
                        throw new Error(errMsg);
                    }
                    hideLoading();
                    const data = await response.json();
                    const formats = data.formats || data || [];
                    if (!Array.isArray(formats) || formats.length === 0) {
                        showToast('No formats available for this video', 'error');
                        return;
                    }

                    let tableHtml = `
                        <div class="flex items-center justify-between mb-4">
                            <h3 class="text-lg font-semibold text-gray-900">Available Formats (${formats.length})</h3>
                            <button class="modal-close text-gray-400 hover:text-gray-600 text-xl"><i class="fa-solid fa-xmark"></i></button>
                        </div>
                        <div class="overflow-x-auto">
                        <table class="min-w-full divide-y divide-gray-200 text-sm">
                            <thead class="bg-gray-50">
                                <tr>
                                    <th class="px-3 py-2 text-left font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" data-sort="format_id">Code</th>
                                    <th class="px-3 py-2 text-left font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" data-sort="ext">Ext</th>
                                    <th class="px-3 py-2 text-left font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" data-sort="resolution">Resolution</th>
                                    <th class="px-3 py-2 text-left font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" data-sort="tbr">Bitrate</th>
                                    <th class="px-3 py-2 text-left font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" data-sort="filesize">Size</th>
                                    <th class="px-3 py-2 text-left font-medium text-gray-500 uppercase tracking-wider">Note</th>
                                    <th class="px-3 py-2 text-left font-medium text-gray-500 uppercase tracking-wider">Codec</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-gray-200">`;
                    formats.forEach(f => {
                        const size = f.filesize || f.filesize_approx;
                        const fmtId = escapeHtml(f.format_id || f.format_code || '-');
                        const ext = escapeHtml(f.ext || '-');
                        const resolution = f.resolution || f.height ? (f.width && f.height ? `${f.width}x${f.height}` : `${f.height || ''}p`) : '-';
                        const bitrate = f.tbr ? `${Math.round(f.tbr)}k` : f.abr ? `${Math.round(f.abr)}k` : '-';
                        const sizeStr = size ? formatFileSize(size) : '-';
                        const note = escapeHtml(f.format_note || f.format || '-');
                        const vcodec = f.vcodec || '';
                        const acodec = f.acodec || '';
                        const codecStr = (vcodec !== 'none' ? 'V:' + escapeHtml(vcodec || '-') : '') + (acodec && acodec !== 'none' ? ' A:' + escapeHtml(acodec) : '');
                        tableHtml += `<tr class="format-row cursor-pointer hover:bg-blue-50 transition-colors" data-ext="${ext}" data-vcodec="${escapeHtml(vcodec)}" data-format-id="${fmtId}">
                            <td class="px-3 py-2 font-mono text-xs text-gray-900">${fmtId}</td>
                            <td class="px-3 py-2 text-gray-700">${ext}</td>
                            <td class="px-3 py-2 text-gray-700">${escapeHtml(resolution)}</td>
                            <td class="px-3 py-2 text-gray-700">${escapeHtml(bitrate)}</td>
                            <td class="px-3 py-2 text-gray-700">${escapeHtml(sizeStr)}</td>
                            <td class="px-3 py-2 text-gray-700">${note}</td>
                            <td class="px-3 py-2 font-mono text-xs text-gray-500">${codecStr || '-'}</td>
                        </tr>`;
                    });
                    tableHtml += `</tbody></table></div>`;
                    const { overlay } = showModal(tableHtml);
                    overlay.querySelectorAll('.format-row').forEach(row => {
                        row.addEventListener('click', () => {
                            const ext = row.dataset.ext;
                            const vcodec = row.dataset.vcodec;
                            const fmtId = row.dataset.formatId;
                            formatSelect.value = ext;
                            qualitySelect.value = 'custom';
                            if (vcodec && vcodec !== 'none') {
                                qualitySelect.innerHTML = '<option value="custom">Custom</option>';
                            }
                            const isAudioOnly = vcodec === 'none' || !vcodec;
                            audioOnlyToggle.checked = isAudioOnly;
                            if (isAudioOnly) {
                                audioOnlyToggle.dispatchEvent(new Event('change'));
                            }
                            const modalCloseBtn = overlay.querySelector('.modal-close');
                            if (modalCloseBtn) modalCloseBtn.click();
                            showToast('Format selected: ' + fmtId, 'success');
                        });
                    });
                } catch (error) {
                    hideLoading();
                    showToast(error.message, 'error');
                }
        });
    }

    const audioFormatSelect = document.getElementById('audioFormatSelect');
    const outputTemplateInput = document.getElementById('outputTemplateInput');

    initTooltip(audioFormatSelect, '', 'Choose MP3 for music, FLAC for CD-quality audio, Opus for smallest file size.');
    initTooltip(outputTemplateInput, '', 'Customize the filename pattern. Leave blank to use the video title as filename.');

    audioOnlyToggle.addEventListener('change', (e) => {
        if (e.target.checked) {
            qualitySelect.disabled = true;
            formatSelect.disabled = true;
            qualitySelect.classList.add('opacity-50', 'cursor-not-allowed', 'bg-gray-100');
            formatSelect.classList.add('opacity-50', 'cursor-not-allowed', 'bg-gray-100');
        } else {
            qualitySelect.disabled = false;
            formatSelect.disabled = false;
            qualitySelect.classList.remove('opacity-50', 'cursor-not-allowed', 'bg-gray-100');
            formatSelect.classList.remove('opacity-50', 'cursor-not-allowed', 'bg-gray-100');
        }
    });

    // --- createVideoCard ---
    const createVideoCard = (video, sourceUrl) => {
        const card = document.createElement('div');
        card.className = 'bg-white dark:bg-gray-800/30 overflow-hidden shadow-lg rounded-xl flex flex-col transition-all duration-300 border border-gray-100 dark:border-gray-700/30 backdrop-blur-sm tilt-card spotlight-card fade-in-up';
        
        const thumbnail = escapeHtml(video.thumbnail || 'https://via.placeholder.com/320x180.png?text=No+Thumbnail');
        const title = escapeHtml(video.title || 'Unknown Title');
        const channel = escapeHtml(video.uploader || video.channel || 'Unknown Channel');
        const duration = formatDuration(video.duration);
        const url = escapeHtml(video.webpage_url || video.url || sourceUrl || (urlInput ? urlInput.value : ''));
        const uploadDate = video.upload_date ? formatDate(video.upload_date) : null;
        const viewCount = video.view_count;
        const formatNote = escapeHtml(video.format_note || video.format || (video.height ? `${video.height}p` : null));

        card.innerHTML = `
            <div class="video-card-thumb bg-gray-200 dark:bg-gray-800">
                <img src="${thumbnail}" alt="Thumbnail" loading="lazy" onerror="this.src='https://via.placeholder.com/320x180.png?text=Error'">
                <div class="play-overlay">
                    <div class="play-btn-circle">
                        <i class="fa-solid fa-play"></i>
                    </div>
                </div>
                <div class="gradient-overlay"></div>
                <div class="duration-badge">
                    <i class="fa-solid fa-clock mr-1" style="font-size:0.6rem;"></i>${duration}
                </div>
                ${formatNote ? `<div class="quality-badge">${formatNote}</div>` : ''}
            </div>
            <div class="p-4 flex-1 flex flex-col">
                <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1 line-clamp-2" title="${title.replace(/"/g, '&quot;')}">${title}</h3>
                <p class="text-xs text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1.5">
                    <i class="fa-solid fa-circle-user"></i>${channel}
                </p>
                <div class="flex items-center gap-3 text-xs text-gray-400 dark:text-gray-500 mb-3">
                    ${viewCount ? `<span><i class="fa-solid fa-eye mr-1"></i>${viewCount >= 1000000 ? (viewCount / 1000000).toFixed(1) + 'M' : viewCount >= 1000 ? (viewCount / 1000).toFixed(1) + 'K' : viewCount}</span>` : ''}
                    ${uploadDate ? `<span><i class="fa-solid fa-calendar mr-1"></i>${uploadDate}</span>` : ''}
                </div>
                <div class="mt-auto">
                    <button class="download-btn ripple-btn w-full inline-flex justify-center items-center px-4 py-2.5 border border-transparent text-sm font-semibold rounded-xl shadow-sm text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all duration-200 hover:shadow-lg hover:shadow-indigo-500/20 active:scale-[0.98]" data-url="${url}">
                        <i class="fa-solid fa-download mr-2"></i>Download
                    </button>
                </div>
            </div>
        `;

        // Tooltip on the title (shows full title when truncated)
        const titleEl = card.querySelector('h3');
        initTooltip(titleEl, '', title);

        const downloadBtn = card.querySelector('.download-btn');
        downloadBtn.addEventListener('click', () => handleQueueDownload(url, title, downloadBtn));

        return card;
    };

    // --- handleQueueDownload (uses queue API) ---
    const handleQueueDownload = async (url, title, buttonEl) => {
        const originalText = buttonEl.innerHTML;
        buttonEl.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i>Queuing...';
        buttonEl.disabled = true;
        buttonEl.classList.add('opacity-75', 'cursor-not-allowed');

        const requestBody = {
            url: url,
            format: formatSelect.value,
            quality: qualitySelect.value,
            audioOnly: audioOnlyToggle.checked,
            audioFormat: audioOnlyToggle.checked && audioFormatSelect ? audioFormatSelect.value : undefined,
            outputTemplate: outputTemplateInput ? outputTemplateInput.value || undefined : undefined,
            options: Object.keys(currentOptions).length > 0 ? currentOptions : undefined,
        };

        let success = false;
        try {
            const response = await fetch('/api/download/queue', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                let errMsg = `HTTP Error ${response.status}`;
                try { const d = await response.json(); errMsg = d.error || errMsg; } catch (e) {}
                throw new Error(errMsg);
            }

            const job = await response.json();
            success = true;
            showToast(`<span>Download queued! <a href="#" class="font-semibold underline" onclick="event.preventDefault(); activateTab('queue')">View Queue</a></span>`, 'success');
            updateTabBadge('queue', (parseInt(document.querySelector('.tab-btn[data-tab="queue"] .tab-badge')?.textContent || '0')) + 1);
        } catch (error) {
            console.error('Queue error:', error);
            showToast(`Failed to queue: ${escapeHtml(error.message)}`, 'error');
        } finally {
            if (success) {
                buttonEl.innerHTML = '<i class="fa-solid fa-check text-green-400 mr-2"></i>Queued';
                buttonEl.disabled = false;
                buttonEl.classList.remove('opacity-75', 'cursor-not-allowed');
                setTimeout(() => {
                    buttonEl.innerHTML = originalText;
                }, 3000);
            } else {
                buttonEl.innerHTML = originalText;
                buttonEl.disabled = false;
                buttonEl.classList.remove('opacity-75', 'cursor-not-allowed');
            }
        }
    };

    btnMetadata.addEventListener('click', async () => {
        const url = urlInput.value.trim();
        if (!url) return showError('Please enter a valid URL');

        showSkeleton('video');
        try {
            const response = await fetch(`/api/metadata?url=${encodeURIComponent(url)}`);
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Failed to fetch metadata');

            hideLoading();
            if (statusMessage) statusMessage.classList.add('hidden');
            if (resultsGrid) resultsGrid.innerHTML = '';
            if (resultsTitle) resultsTitle.textContent = 'Single Video';

            const card = createVideoCard(data, url);
            if (resultsGrid) resultsGrid.appendChild(card);
            // Add staggered animation
            resultsGrid.querySelectorAll('.fade-in-up').forEach((el, i) => {
                el.style.animationDelay = (i * 0.05) + 's';
            });
            if (resultsContainer) resultsContainer.classList.remove('hidden');
        } catch (error) {
            hideLoading();
            showError(error.message);
        }
    });

    btnScrape.addEventListener('click', async () => {
        const url = urlInput.value.trim();
        if (!url) return showError('Please enter a valid URL');

        showSkeleton('grid');
        try {
            const response = await fetch(`/api/scrape?url=${encodeURIComponent(url)}`);
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Failed to scrape URL');

            hideLoading();
            if (statusMessage) statusMessage.classList.add('hidden');
            if (resultsGrid) resultsGrid.innerHTML = '';

            let entries = [];
            if (Array.isArray(data)) entries = data;
            else if (data.entries) entries = data.entries;
            else if (data.items) entries = data.items;
            else if (data.id) entries = [data];

            if (resultsTitle) {
                if (entries.length === 0) resultsTitle.textContent = 'No videos found';
                else resultsTitle.textContent = `Found ${entries.length} Video${entries.length > 1 ? 's' : ''}`;
            }
            entries.forEach(video => {
                if (video && resultsGrid) resultsGrid.appendChild(createVideoCard(video, url));
            });

            // Add staggered animation
            if (resultsGrid) {
                resultsGrid.querySelectorAll('.fade-in-up').forEach((el, i) => {
                    el.style.animationDelay = (i * 0.05) + 's';
                });
            }

            if (resultsContainer) resultsContainer.classList.remove('hidden');
        } catch (error) {
            hideLoading();
            showError(error.message);
        }
    });

    if (urlInput) {
        urlInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                if (btnMetadata) btnMetadata.click();
            }
        });
    }

    // ======================== SETUP TAB ========================

    const btnSetupDownload = document.getElementById('btnSetupDownload');
    const setupProgress = document.getElementById('setupProgress');
    const setupComplete = document.getElementById('setupComplete');
    const ytdlpBar = document.getElementById('ytdlpBar');
    const ffmpegBar = document.getElementById('ffmpegBar');
    const ytdlpStatus = document.getElementById('ytdlpStatus');
    const ffmpegStatus = document.getElementById('ffmpegStatus');
    const ytdlpPercent = document.getElementById('ytdlpPercent');
    const ffmpegPercent = document.getElementById('ffmpegPercent');

    initTooltip(btnSetupDownload, '', 'Downloads both yt-dlp (the downloader engine) and ffmpeg (for processing audio/video). Runs them at the same time to save you waiting.');
    initTooltip(setupComplete, '', 'Everything is installed and ready to go.');

    let isSetupRunning = false;

    // Inject setup status area
    const setupTab = document.getElementById('tab-setup');
    let setupStatusDiv = null;
    if (setupTab) {
        const setupMain = setupTab.querySelector('main section');
        if (setupMain) {
            setupStatusDiv = document.createElement('div');
            setupStatusDiv.id = 'setupStatus';
            setupStatusDiv.className = 'mb-6 bg-white shadow rounded-lg p-6';
            setupStatusDiv.innerHTML = `
                <h3 class="text-lg font-medium text-gray-900 mb-4 border-b pb-2"><i class="fa-solid fa-info-circle mr-2"></i>Status</h3>
                <div id="setupStatusContent" class="text-sm text-gray-600"><i class="fa-solid fa-spinner fa-spin mr-2"></i>Checking...</div>
            `;
            setupMain.parentNode.insertBefore(setupStatusDiv, setupMain);

            // Check for updates button
            const checkUpdatesBtn = document.createElement('button');
            checkUpdatesBtn.id = 'btnCheckUpdates';
            checkUpdatesBtn.className = 'inline-flex justify-center items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors ml-3';
            checkUpdatesBtn.innerHTML = '<i class="fa-solid fa-rotate mr-2"></i>Check for Updates';
            initTooltip(checkUpdatesBtn, '', 'Check if newer versions of yt-dlp or ffmpeg are available. If so, you can re-download them.');
            btnSetupDownload.parentElement.appendChild(checkUpdatesBtn);

            checkUpdatesBtn.addEventListener('click', async () => {
                checkUpdatesBtn.disabled = true;
                checkUpdatesBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i>Checking...';
                try {
                    const response = await fetch('/api/updates');
                    if (!response.ok) throw new Error('Failed to check updates');
                    const data = await response.json();
                    const msgs = [];
                    if (data.ytDlp && data.ytDlp.updateAvailable) {
                        msgs.push(`yt-dlp: ${data.ytDlp.installed || 'none'} \u2192 ${data.ytDlp.latest}`);
                    }
                    if (data.ffmpeg && data.ffmpeg.updateAvailable) {
                        msgs.push(`ffmpeg: ${data.ffmpeg.installed || 'none'} \u2192 ${data.ffmpeg.latest}`);
                    }
                    if (msgs.length > 0) {
                        showToast(`Updates available: ${msgs.join(', ')}`, 'info');
                    } else {
                        showToast('All binaries are up to date', 'success');
                    }
                    checkSetupStatus();
                } catch (error) {
                    showToast(error.message, 'error');
                } finally {
                    checkUpdatesBtn.disabled = false;
                    checkUpdatesBtn.innerHTML = '<i class="fa-solid fa-rotate mr-2"></i>Check for Updates';
                }
            });
        }
    }

    const checkSetupStatus = async () => {
        const statusContent = document.getElementById('setupStatusContent');
        if (!statusContent) return;
        try {
            const response = await fetch('/api/status');
            if (!response.ok) throw new Error('Failed to fetch status');
            const data = await response.json();
            const bins = data.binaries || [];
            let html = '<div class="space-y-2">';
            if (bins.length === 0) {
                html += '<p class="text-gray-500">No binaries installed. Use the download button below.</p>';
            } else {
                bins.forEach(bin => {
                    const installed = bin.version;
                    const binName = escapeHtml(bin.name);
                    const binVersion = escapeHtml(installed || '?');
                    html += `<div class="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                        <div class="flex items-center gap-2">
                            <i class="fa-solid fa-file-code text-gray-400"></i>
                            <span class="font-medium text-gray-900">${binName}</span>
                        </div>
                        <div class="flex items-center gap-3">
                            <span class="text-sm text-gray-500">${bin.exists ? 'v' + binVersion : 'Not installed'}</span>
                            ${bin.exists ? '<span class="px-2 py-0.5 text-xs font-medium text-green-800 bg-green-100 rounded-full">Installed</span>' : '<span class="px-2 py-0.5 text-xs font-medium text-yellow-800 bg-yellow-100 rounded-full">Not Installed</span>'}
                        </div>
                    </div>`;
                });
            }
            html += '</div>';
            statusContent.innerHTML = html;
        } catch (error) {
            statusContent.innerHTML = `<p class="text-red-500"><i class="fa-solid fa-circle-xmark mr-1"></i>${escapeHtml(error.message)}</p>`;
        }
    };

    btnSetupDownload.addEventListener('click', () => {
        if (isSetupRunning) return;
        isSetupRunning = true;
        btnSetupDownload.disabled = true;
        btnSetupDownload.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i>Downloading...';
        if (setupComplete) setupComplete.classList.add('hidden');
        if (setupProgress) setupProgress.classList.remove('hidden');
        if (ytdlpBar) { ytdlpBar.style.width = '0%'; ytdlpBar.classList.add('progress-bar-animated'); }
        if (ffmpegBar) { ffmpegBar.style.width = '0%'; ffmpegBar.classList.add('progress-bar-animated'); }
        if (ytdlpStatus) ytdlpStatus.textContent = 'Starting...';
        if (ffmpegStatus) ffmpegStatus.textContent = 'Starting...';
        if (ytdlpPercent) ytdlpPercent.textContent = '0%';
        if (ffmpegPercent) ffmpegPercent.textContent = '0%';

        const evtSource = new EventSource('/api/setup');

        const cleanup = () => {
            isSetupRunning = false;
            btnSetupDownload.disabled = false;
            btnSetupDownload.innerHTML = '<i class="fa-solid fa-download mr-2"></i>Download yt-dlp & ffmpeg';
        };

        evtSource.onmessage = (e) => {
            const data = JSON.parse(e.data);
            if (data.step === 'yt-dlp') {
                if (ytdlpBar) ytdlpBar.style.width = (data.percent || 0) + '%';
                if (ytdlpPercent) ytdlpPercent.textContent = (data.percent || 0) + '%';
                if (ytdlpStatus) ytdlpStatus.textContent = data.status || '';
            } else if (data.step === 'ffmpeg') {
                if (ffmpegBar) ffmpegBar.style.width = (data.percent || 0) + '%';
                if (ffmpegPercent) ffmpegPercent.textContent = (data.percent || 0) + '%';
                if (ffmpegStatus) ffmpegStatus.textContent = data.status || '';
            } else if (data.step === 'all' && data.status === 'done') {
                evtSource.close();
                if (ytdlpBar) ytdlpBar.style.width = '100%';
                if (ffmpegBar) ffmpegBar.style.width = '100%';
                if (ytdlpPercent) ytdlpPercent.textContent = '100%';
                if (ffmpegPercent) ffmpegPercent.textContent = '100%';
                if (ytdlpStatus) ytdlpStatus.textContent = 'Done';
                if (ffmpegStatus) ffmpegStatus.textContent = 'Done';
                cleanup();
                if (setupComplete) setupComplete.classList.remove('hidden');
                checkSetupStatus();
            } else if (data.step === 'error') {
                evtSource.close();
                if (ytdlpStatus) ytdlpStatus.textContent = 'Error';
                if (ffmpegStatus) ffmpegStatus.textContent = 'Error';
                cleanup();
                showToast(data.error || 'Setup failed', 'error');
            }
        };

        evtSource.onerror = () => {
            evtSource.close();
            if (ytdlpStatus) ytdlpStatus.textContent = 'Error';
            if (ffmpegStatus) ffmpegStatus.textContent = 'Error';
            cleanup();
        };
    });

    // ======================== DOWNLOADS TAB ========================

    const filesLoading = document.getElementById('filesLoading');
    const filesEmpty = document.getElementById('filesEmpty');
    const filesTableWrapper = document.getElementById('filesTableWrapper');
    const filesBody = document.getElementById('filesBody');

    initTooltip(filesEmpty, '', 'Your download folder is empty. Downloaded files will show up here after you queue them.');

    const loadFiles = async () => {
        if (filesLoading) filesLoading.classList.remove('hidden');
        if (filesEmpty) filesEmpty.classList.add('hidden');
        if (filesTableWrapper) filesTableWrapper.classList.add('hidden');
        if (filesBody) filesBody.innerHTML = '';

        try {
            const response = await fetch('/api/files');
            if (!response.ok) throw new Error('Failed to fetch files');
            const files = await response.json();

            if (filesLoading) filesLoading.classList.add('hidden');

            if (!files || files.length === 0) {
                if (filesEmpty) filesEmpty.classList.remove('hidden');
                const cab = document.getElementById('btnClearAllFiles');
                if (cab) cab.classList.add('hidden');
                return;
            }

            if (filesTableWrapper) filesTableWrapper.classList.remove('hidden');
            // Add/Clear All button
            let clearAllBtn = document.getElementById('btnClearAllFiles');
            if (!clearAllBtn) {
                clearAllBtn = document.createElement('button');
                clearAllBtn.id = 'btnClearAllFiles';
                clearAllBtn.className = 'mb-4 inline-flex items-center px-4 py-2 text-sm font-medium rounded-xl text-red-400 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 transition-all duration-200';
                clearAllBtn.innerHTML = '<i class="fa-solid fa-trash-can mr-2"></i>Clear All';
                clearAllBtn.addEventListener('click', clearAllFiles);
                filesTableWrapper.parentNode.insertBefore(clearAllBtn, filesTableWrapper);
            }
            clearAllBtn.classList.remove('hidden');
            files.forEach(file => {
                const tr = document.createElement('tr');
                tr.className = 'hover:bg-gray-50';
                const filename = escapeHtml(file.name || 'Unknown');
                const size = file.size || 0;
                const date = file.date || file.modified || file.created || '';

                tr.innerHTML = `
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${filename}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${formatFileSize(size)}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${formatDate(date)}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div class="flex items-center justify-end gap-2">
                            <a href="/api/files/${encodeURIComponent(file.name || '')}" class="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors">
                                <i class="fa-solid fa-download mr-1.5"></i>Download
                            </a>
                            <button class="btn-delete-file px-3 py-1.5 text-sm font-medium rounded-md text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 transition-colors" data-filename="${encodeURIComponent(file.name || '')}">
                                <i class="fa-solid fa-trash-can mr-1"></i>Delete
                            </button>
                        </div>
                    </td>
                `;
                if (filesBody) filesBody.appendChild(tr);
                const deleteBtn = tr.querySelector('.btn-delete-file');
                if (deleteBtn) {
                    deleteBtn.addEventListener('click', () => {
                        deleteFile(file.name || '', tr);
                    });
                }
            });
        } catch (error) {
            console.error('Files fetch error:', error);
            if (filesLoading) filesLoading.classList.add('hidden');
            if (filesEmpty) {
                filesEmpty.classList.remove('hidden');
                const p = filesEmpty.querySelector('p');
                if (p) p.textContent = 'Failed to load files';
            }
        }
    };

        const deleteFile = async (filename, rowEl) => {
            if (!confirm(`Delete "${filename}"? This cannot be undone.`)) return;
            try {
                const response = await fetch(`/api/files/${encodeURIComponent(filename)}`, { method: 'DELETE' });
                if (!response.ok) {
                    let errMsg = 'Failed to delete file';
                    try { const d = await response.json(); errMsg = d.error || errMsg; } catch (e) {}
                    throw new Error(errMsg);
                }
                showToast(`Deleted "${filename}"`, 'success');
                rowEl.remove();
                if (filesBody && filesBody.children.length === 0) {
                    loadFiles();
                }
            } catch (error) {
                showToast(error.message, 'error');
            }
        };

        const clearAllFiles = async () => {
            if (!confirm('Delete ALL downloaded files? This cannot be undone.')) return;
            try {
                const response = await fetch('/api/files', { method: 'DELETE' });
                if (!response.ok) throw new Error('Failed to clear files');
                const result = await response.json();
                showToast(`Deleted ${result.deleted} file${result.deleted !== 1 ? 's' : ''}`, 'success');
                loadFiles();
            } catch (error) {
                showToast(error.message, 'error');
            }
        };

    // ======================== CHANNELS TAB ========================

    const channelsTab = document.getElementById('tab-channels');
    let channelList = null;
    let channelResultsGrid = null;

    if (channelsTab) {

        channelList = document.getElementById('channelsGrid');
        channelResultsGrid = document.getElementById('channelResultsGrid');

        const channelUrlInput = document.getElementById('channelUrlInput');
        const btnSubscribe = document.getElementById('btnSubscribe');
        const channelLoading = document.getElementById('channelsLoading');
        const channelEmpty = document.getElementById('channelsEmpty');
        const channelResultsWrapper = document.getElementById('channelResultsSection');
        const btnDownloadSelected = document.getElementById('btnDownloadSelected');

        let selectedVideos = new Set();
        let browseChannelName = '';

        function updateDownloadButton() {
            const count = selectedVideos.size;
            const countEl = document.getElementById('selectedCount');
            if (countEl) countEl.textContent = count;
            if (btnDownloadSelected) {
                btnDownloadSelected.disabled = count === 0;
                btnDownloadSelected.innerHTML = count > 0
                    ? '<i class="fa-solid fa-download mr-1.5"></i>Download Selected (' + count + ')'
                    : '<i class="fa-solid fa-download mr-1.5"></i>Download Selected (0)';
            }
        }

        initTooltip(channelUrlInput, '', 'Paste a channel URL (like youtube.com/@ChannelName) to save it to your list for quick browsing later.');
        initTooltip(btnSubscribe, '', 'Add this channel to your saved list so you can browse all their videos anytime.');
        initTooltip(btnDownloadSelected, '', 'Download all the videos you\u2019ve checked. They\u2019ll be added to the queue and downloaded in parallel.');

        btnSubscribe.addEventListener('click', async () => {
            const url = channelUrlInput.value.trim();
            if (!url) return showToast('Please enter a channel URL', 'error');
            try {
                btnSubscribe.disabled = true;
                btnSubscribe.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i>Subscribing...';
                const response = await fetch('/api/channels', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ url })
                });
                if (!response.ok) {
                    let errMsg = 'Failed to subscribe';
                    try { const d = await response.json(); errMsg = d.error || errMsg; } catch (e) {}
                    throw new Error(errMsg);
                }
                channelUrlInput.value = '';
                showToast('Channel subscribed successfully!', 'success');
                await loadChannels();
            } catch (error) {
                showToast(error.message, 'error');
            } finally {
                btnSubscribe.disabled = false;
                btnSubscribe.innerHTML = '<i class="fa-solid fa-plus mr-2"></i>Subscribe';
            }
        });

        channelUrlInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                btnSubscribe.click();
            }
        });

        btnDownloadSelected.addEventListener('click', async () => {
            const urls = Array.from(selectedVideos);
            if (urls.length === 0) return;
            try {
                btnDownloadSelected.disabled = true;
                btnDownloadSelected.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i>Queuing...';
                const response = await fetch('/api/download/queue/batch', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ urls, title: browseChannelName })
                });
                if (!response.ok) {
                    let errMsg = 'Failed to queue downloads';
                    try { const d = await response.json(); errMsg = d.error || errMsg; } catch (e) {}
                    throw new Error(errMsg);
                }
                const result = await response.json();
                showToast(result.count + ' download' + (result.count !== 1 ? 's' : '') + ' queued!', 'success');
                selectedVideos.clear();
                updateDownloadButton();
                // Re-render to uncheck all boxes
                document.querySelectorAll('#channelResultsGrid .video-checkbox').forEach(cb => cb.checked = false);
                updateTabBadge('queue', result.count);
            } catch (error) {
                showToast(error.message, 'error');
            } finally {
                btnDownloadSelected.disabled = false;
                updateDownloadButton();
            }
        });

        const loadChannels = async () => {
            selectedVideos.clear();
            updateDownloadButton();
            if (channelResultsWrapper) channelResultsWrapper.classList.add('hidden');
            if (channelResultsGrid) channelResultsGrid.innerHTML = '';
            if (channelLoading) channelLoading.classList.remove('hidden');
            if (channelEmpty) channelEmpty.classList.add('hidden');
            if (channelList) channelList.innerHTML = '';

            try {
                const response = await fetch('/api/channels');
                if (!response.ok) throw new Error('Failed to fetch channels');
                const channels = await response.json();

                if (channelLoading) channelLoading.classList.add('hidden');

                const channelArray = Array.isArray(channels) ? channels : (channels.channels || channels.subscriptions || []);
                if (!channelArray || channelArray.length === 0) {
                    if (channelEmpty) channelEmpty.classList.remove('hidden');
                    updateTabBadge('channels', 0);
                    return;
                }

                updateTabBadge('channels', channelArray.length);
                channelArray.forEach(ch => {
                    if (channelList) channelList.appendChild(createChannelCard(ch));
                });
            } catch (error) {
                console.error('Channels fetch error:', error);
                if (channelLoading) channelLoading.classList.add('hidden');
                if (channelEmpty) {
                    channelEmpty.classList.remove('hidden');
                    const p = channelEmpty.querySelector('p:first-of-type');
                    if (p) p.textContent = 'Failed to load channels';
                }
            }
        };

        const createChannelCard = (ch) => {
            const card = document.createElement('div');
            card.className = 'bg-white overflow-hidden shadow rounded-lg border border-gray-100 transition-transform hover:-translate-y-1 hover:shadow-lg duration-200';
            card.id = 'channel-card-' + escapeHtml(ch.id || ch._id);

            const avatar = escapeHtml(ch.avatar || ch.thumbnail || ch.thumbnails?.high?.url || 'https://via.placeholder.com/80x80.png?text=Channel');
            const name = escapeHtml(ch.name || ch.title || ch.channel || 'Unknown Channel');
            const subs = ch.subscriber_count || ch.subscribers;
            const videos = ch.video_count || ch.videoCount;
            const id = ch.id || ch._id;
            const escapedId = escapeHtml(id);

            card.innerHTML = `
                <div class="p-5">
                    <div class="flex items-start gap-4">
                        <img class="w-16 h-16 rounded-full object-cover border-2 border-gray-200 flex-shrink-0" src="${avatar}" alt="Avatar" onerror="this.src='https://via.placeholder.com/80x80.png?text=Channel'">
                        <div class="flex-1 min-w-0">
                            <h3 class="text-base font-semibold text-gray-900 truncate">${name}</h3>
                            <div class="flex items-center gap-3 mt-1 text-xs text-gray-500">
                                ${subs ? '<span><i class="fa-solid fa-users mr-1"></i>' + (subs >= 1000000 ? (subs / 1000000).toFixed(1) + 'M' : subs >= 1000 ? (subs / 1000).toFixed(1) + 'K' : subs) + '</span>' : ''}
                                ${videos ? '<span><i class="fa-solid fa-video mr-1"></i>' + videos + ' videos</span>' : ''}
                            </div>
                        </div>
                    </div>
                    <div class="mt-4 flex flex-wrap gap-2">
                        <button class="btn-browse px-4 py-2 text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 transition-colors flex-1" data-channel-id="${escapedId}" data-channel-name="${name.replace(/"/g, '&quot;')}">
                            <i class="fa-solid fa-magnifying-glass mr-1.5"></i>Browse
                        </button>
                        <button class="btn-unsubscribe px-3 py-2 text-sm font-medium rounded-md text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 transition-colors" data-channel-id="${escapedId}">
                            <i class="fa-solid fa-trash mr-1"></i>
                        </button>
                    </div>
                </div>
            `;

            // Tooltip on channel name (shows full name when truncated)
            const nameEl = card.querySelector('h3');
            initTooltip(nameEl, '', name);

            // Browse button
            const browseBtn = card.querySelector('.btn-browse');
            initTooltip(browseBtn, '', 'Click to browse all videos, shorts, and streams from this channel. Pick what you want and download them in batch.');
            browseBtn.addEventListener('click', () => browseChannel(id, name));

            // Unsubscribe
            const unsubBtn = card.querySelector('.btn-unsubscribe');
            initTooltip(unsubBtn, '', 'Remove this channel from your saved list.');
            unsubBtn.addEventListener('click', async () => {
                if (!confirm('Unsubscribe from "' + name + '"?')) return;
                try {
                    const response = await fetch('/api/channels/' + encodeURIComponent(id), { method: 'DELETE' });
                    if (!response.ok) throw new Error('Failed to unsubscribe');
                    showToast('Unsubscribed successfully', 'success');
                    card.remove();
                    updateTabBadge('channels', parseInt(document.querySelector('.tab-btn[data-tab="channels"] .tab-badge')?.textContent || '0') - 1);
                } catch (error) {
                    showToast(error.message, 'error');
                }
            });

            return card;
        };

        const browseChannel = async (channelId, channelName) => {
            selectedVideos.clear();
            updateDownloadButton();
            browseChannelName = channelName || '';
            const grid = document.getElementById('channelResultsGrid');
            const wrapper = document.getElementById('channelResultsSection');
            const titleEl = document.getElementById('channelResultsTitle');
            if (!grid) return;
            grid.innerHTML = '';
            if (wrapper) wrapper.classList.remove('hidden');
            if (titleEl) titleEl.textContent = escapeHtml(channelName) + ' — loading...';
            grid.innerHTML = '<div class="col-span-full text-center py-8"><div class="loader mx-auto mb-4"></div><p class="text-gray-500">Fetching all videos...</p></div>';

            try {
                const response = await fetch('/api/channels/' + encodeURIComponent(channelId) + '/scrape', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: '{}'
                });
                if (!response.ok) {
                    let errMsg = 'Failed to browse channel';
                    try { const d = await response.json(); errMsg = d.error || errMsg; } catch (e) {}
                    throw new Error(errMsg);
                }
                const data = await response.json();
                const videoArray = Array.isArray(data.results) ? data.results : (Array.isArray(data) ? data : []);

                grid.innerHTML = '';
                if (videoArray.length === 0) {
                    grid.innerHTML = '<div class="col-span-full text-center py-8 text-gray-500"><i class="fa-solid fa-video-slash text-3xl mb-2"></i><p>No videos found</p></div>';
                    if (titleEl) titleEl.textContent = escapeHtml(channelName) + ' — no videos found';
                    return;
                }

                if (titleEl) titleEl.textContent = escapeHtml(channelName) + ' (' + videoArray.length + ' videos)';

                videoArray.forEach(v => {
                    if (!v) return;
                    const card = document.createElement('div');
                    card.className = 'bg-white overflow-hidden shadow rounded-lg border border-gray-100 transition-transform hover:-translate-y-1 hover:shadow-lg duration-200';

                    const thumbnail = escapeHtml(v.thumbnail || 'https://via.placeholder.com/320x180.png?text=No+Thumbnail');
                    const title = escapeHtml(v.title || 'Unknown');
                    const duration = formatDuration(v.duration);
                    const vidUrl = v.url || v.webpage_url || '';
                    const type = v.type || 'video';
                    const typeBadge = type === 'short'
                        ? '<span class="bg-pink-500 text-white text-[10px] px-1.5 py-0.5 rounded font-medium">Short</span>'
                        : type === 'stream'
                        ? '<span class="bg-green-500 text-white text-[10px] px-1.5 py-0.5 rounded font-medium">Stream</span>'
                        : '<span class="bg-blue-500 text-white text-[10px] px-1.5 py-0.5 rounded font-medium">Video</span>';

                    card.innerHTML = `
                        <div class="relative pt-[56.25%] bg-gray-100 group">
                            <img class="absolute inset-0 w-full h-full object-cover" src="${thumbnail}" alt="Thumbnail" onerror="this.src='https://via.placeholder.com/320x180.png?text=Image+Error'">
                            <div class="absolute bottom-2 right-2 bg-black bg-opacity-80 text-white text-xs px-1.5 py-0.5 rounded font-medium flex items-center gap-1">
                                <i class="fa-solid fa-clock"></i>${duration}
                            </div>
                            <div class="absolute top-2 left-2">${typeBadge}</div>
                            <label class="absolute top-2 right-2 w-8 h-8 bg-white bg-opacity-90 rounded-full flex items-center justify-center cursor-pointer shadow hover:bg-opacity-100 transition-all">
                                <input type="checkbox" class="video-checkbox w-4 h-4 text-blue-600 focus:ring-blue-500 rounded cursor-pointer" data-url="${escapeHtml(vidUrl)}" ${vidUrl && selectedVideos.has(vidUrl) ? 'checked' : ''}>
                            </label>
                            <div class="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-10 transition-opacity duration-200"></div>
                        </div>
                        <div class="p-3">
                            <h4 class="text-xs font-semibold text-gray-900 mb-1 line-clamp-2">${title}</h4>
                            <div class="flex items-center gap-2 text-xs text-gray-400">
                                ${v.viewCount ? '<span><i class="fa-solid fa-eye mr-1"></i>' + (v.viewCount >= 1000000 ? (v.viewCount / 1000000).toFixed(1) + 'M' : v.viewCount >= 1000 ? (v.viewCount / 1000).toFixed(1) + 'K' : v.viewCount) + '</span>' : ''}
                                ${v.uploaded ? '<span><i class="fa-solid fa-calendar mr-1"></i>' + formatDate(v.uploaded) + '</span>' : ''}
                            </div>
                        </div>
                    `;

                    const checkbox = card.querySelector('.video-checkbox');
                    if (checkbox) {
                        checkbox.addEventListener('change', () => {
                            const url = checkbox.dataset.url;
                            if (checkbox.checked) {
                                selectedVideos.add(url);
                            } else {
                                selectedVideos.delete(url);
                            }
                            updateDownloadButton();
                        });
                    }

                    grid.appendChild(card);
                });
            } catch (error) {
                grid.innerHTML = '<div class="col-span-full text-center py-8 text-red-500"><i class="fa-solid fa-circle-xmark text-3xl mb-2"></i><p>' + escapeHtml(error.message) + '</p></div>';
                showToast(error.message, 'error');
            }
        };

        window.loadChannels = loadChannels;
    }

    // ======================== QUEUE TAB ========================

    const queueTab = document.getElementById('tab-queue');
    let queueJobsBody = null;
    let concurrencyInput = null;
    let concurrencyDisplay = null;
    let queueFilter = 'all';

    if (queueTab) {

        queueJobsBody = document.getElementById('queueBody');
        concurrencyInput = document.getElementById('concurrencySlider');
        concurrencyDisplay = document.getElementById('concurrencyValue');
        const btnCancelAll = document.getElementById('btnCancelAll');
        const queueLoading = document.getElementById('queueLoading');
        const queueEmpty = document.getElementById('queueEmpty');
        const queueTableWrapper = document.getElementById('queueTableWrapper');

        initTooltip(concurrencyInput, '', 'How many downloads to run at the same time. 1 = one at a time, 5 = five at once. Higher numbers use more internet bandwidth but finish faster.');
        initTooltip(btnCancelAll, '', 'Remove every download from the queue. Downloads that are already in progress will be stopped too.');
        initTooltip(queueEmpty, '', 'No downloads queued yet. Go to the Download or Channels tab to start some.');

        // Filter buttons
        document.querySelectorAll('.queue-filter-btn').forEach(btn => {
            initTooltip(btn, '', 'Show only downloads with this status. \u201cAll\u201d shows everything.');
            btn.addEventListener('click', () => {
                document.querySelectorAll('.queue-filter-btn').forEach(b => {
                    b.classList.remove('bg-blue-600', 'text-white', 'border-blue-600');
                    b.classList.add('bg-white', 'text-gray-700', 'border-gray-300');
                });
                btn.classList.remove('bg-white', 'text-gray-700', 'border-gray-300');
                btn.classList.add('bg-blue-600', 'text-white', 'border-blue-600');
                queueFilter = btn.dataset.status;
                renderQueueJobs();
            });
        });
        // Set initial active filter
        document.querySelectorAll('.queue-filter-btn').forEach(btn => {
            if (btn.dataset.status === 'all' || (!btn.dataset.status && btn.textContent.trim() === 'All')) {
                btn.classList.remove('bg-white', 'text-gray-700', 'border-gray-300');
                btn.classList.add('bg-blue-600', 'text-white', 'border-blue-600');
            }
        });

        concurrencyInput.addEventListener('change', async () => {
            const val = parseInt(concurrencyInput.value);
            if (isNaN(val) || val < 1 || val > 5) return;
            try {
                const response = await fetch('/api/download/concurrency', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ concurrency: val })
                });
                if (!response.ok) throw new Error('Failed to set concurrency');
                if (concurrencyDisplay) concurrencyDisplay.textContent = val;
            } catch (error) {
                showToast(error.message, 'error');
            }
        });

        btnCancelAll.addEventListener('click', async () => {
            if (!confirm('Cancel all queued and downloading jobs?')) return;
            try {
                const response = await fetch('/api/download/queue/cancel-all', { method: 'POST' });
                if (!response.ok) throw new Error('Failed to cancel all');
                showToast('All jobs cancelled', 'success');
                renderQueueJobs();
            } catch (error) {
                showToast(error.message, 'error');
            }
        });

        // Fetch current concurrency on load
        const fetchConcurrency = async () => {
            try {
                const response = await fetch('/api/download/concurrency');
                if (!response.ok) return;
                const data = await response.json();
                const val = (data && typeof data.concurrency === 'number') ? data.concurrency : 2;
                if (concurrencyInput) concurrencyInput.value = val;
                if (concurrencyDisplay) concurrencyDisplay.textContent = val;
            } catch (e) {}
        };

        // Queue data
        let queueData = [];

        const renderQueueJobs = () => {
            // Clear loading timeout
            if (window._queueLoadingTimeout) {
                clearTimeout(window._queueLoadingTimeout);
                window._queueLoadingTimeout = null;
            }
            if (!queueJobsBody) return;

            const filtered = queueFilter === 'all' ? queueData : queueData.filter(j => j.status === queueFilter);

            const activeCount = queueData.filter(j => j.status === 'queued' || j.status === 'downloading').length;
            updateTabBadge('queue', activeCount);

            if (queueData.length === 0) {
                if (queueLoading) queueLoading.classList.add('hidden');
                if (queueEmpty) queueEmpty.classList.remove('hidden');
                if (queueTableWrapper) queueTableWrapper.classList.add('hidden');
                return;
            }

            if (queueLoading) queueLoading.classList.add('hidden');
            if (queueEmpty) queueEmpty.classList.add('hidden');
            if (queueTableWrapper) queueTableWrapper.classList.remove('hidden');

            queueJobsBody.innerHTML = '';
            if (filtered.length === 0) {
                queueJobsBody.innerHTML = `<tr><td colspan="4" class="px-6 py-8 text-center text-gray-500">No ${escapeHtml(queueFilter)} jobs</td></tr>`;
                return;
            }

            filtered.forEach(job => {
                const tr = document.createElement('tr');
                tr.className = 'hover:bg-gray-50';
                const statusColors = {
                    queued: 'bg-yellow-100 text-yellow-800',
                    downloading: 'bg-blue-100 text-blue-800',
                    completed: 'bg-green-100 text-green-800',
                    failed: 'bg-red-100 text-red-800',
                };
                const statusIcons = {
                    queued: '<i class="fa-solid fa-clock"></i>',
                    downloading: '<i class="fa-solid fa-arrow-down"></i>',
                    completed: '<i class="fa-solid fa-check"></i>',
                    failed: '<i class="fa-solid fa-xmark"></i>',
                };
                const status = job.status || 'queued';
                const progress = job.progress || 0;
                const title = escapeHtml(job.title || job.url || 'Unknown');
                const id = job.id || job._id;
                const escapedId = escapeHtml(id);

                tr.innerHTML = `
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 max-w-xs truncate">
                        ${title}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap">
                        <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[status] || statusColors.queued}">
                            ${statusIcons[status] || ''} ${status.charAt(0).toUpperCase() + status.slice(1)}
                        </span>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap">
                        <div class="flex items-center gap-3">
                            <div class="flex-1 bg-gray-200 rounded-full h-2 min-w-[80px]">
                                <div class="h-2 rounded-full transition-all duration-300 ${status === 'completed' ? 'bg-green-500' : status === 'failed' ? 'bg-red-500' : 'bg-blue-500'}" style="width: ${progress}%"></div>
                            </div>
                            <span class="text-xs text-gray-500 w-10 text-right">${status === 'completed' ? '100' : status === 'failed' ? '-' : Math.round(progress)}%</span>
                        </div>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        ${(status === 'queued' || status === 'downloading') ? `<button class="btn-cancel-job px-3 py-1.5 text-xs font-medium rounded-md text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 transition-colors" data-job-id="${escapedId}"><i class="fa-solid fa-ban mr-1"></i>Cancel</button>` : ''}
                        ${status === 'completed' ? `<span class="text-xs text-green-600"><i class="fa-solid fa-check-circle mr-1"></i>Done</span>` : ''}
                        ${status === 'failed' ? `<span class="text-xs text-red-500"><i class="fa-solid fa-circle-exclamation mr-1"></i>Failed</span>` : ''}
                    </td>
                `;

                // Tooltip on the title (shows full title when truncated)
                const titleTd = tr.querySelector('td:first-child');
                initTooltip(titleTd, '', title);

                // Tooltip on failed error span
                const errSpan = tr.querySelector('.text-red-500');
                if (errSpan && job.error) {
                    initTooltip(errSpan, '', job.error);
                }

                const cancelBtn = tr.querySelector('.btn-cancel-job');
                if (cancelBtn) {
                    cancelBtn.addEventListener('click', async () => {
                        const jobId = cancelBtn.dataset.jobId;
                        try {
                            const response = await fetch(`/api/download/queue/${encodeURIComponent(jobId)}`, { method: 'DELETE' });
                            if (!response.ok) throw new Error('Failed to cancel');
                            showToast('Job cancelled', 'info');
                            renderQueueJobs();
                        } catch (error) {
                            showToast(error.message, 'error');
                        }
                    });
                }

                queueJobsBody.appendChild(tr);
            });
        };

        const loadQueueJobs = async () => {
            try {
                const response = await fetch('/api/download/queue');
                if (!response.ok) throw new Error('Failed to fetch queue');
                const data = await response.json();
                queueData = Array.isArray(data) ? data : (data.jobs || data.queue || []);
                renderQueueJobs();
            } catch (error) {
                console.error('Queue fetch error:', error);
                queueData = [];
                renderQueueJobs();
            }
        };

        const initQueueSSE = () => {
            fetchConcurrency();
            loadQueueJobs();

            if (queueEventSource) { queueEventSource.close(); queueEventSource = null; }
            if (queuePollInterval) { clearInterval(queuePollInterval); queuePollInterval = null; }

            // Safety timeout: force-loading to resolve after 8 seconds no matter what
            if (window._queueLoadingTimeout) {
                clearTimeout(window._queueLoadingTimeout);
            }
            window._queueLoadingTimeout = setTimeout(() => {
                if (queueLoading && !queueLoading.classList.contains('hidden')) {
                    queueLoading.classList.add('hidden');
                    if (queueEmpty) queueEmpty.classList.remove('hidden');
                    // Show a subtle message that loading timed out
                    showToast('Queue loaded (empty)', 'info');
                }
            }, 8000);

            try {
                queueEventSource = new EventSource('/api/download/queue/events');
                queueEventSource.onmessage = (e) => {
                    try {
                        const data = JSON.parse(e.data);
                        if (data.jobs) {
                            queueData = data.jobs;
                        } else if (data.job) {
                            const idx = queueData.findIndex(j => (j.id || j._id) === (data.job.id || data.job._id));
                            if (idx >= 0) {
                                queueData[idx] = { ...queueData[idx], ...data.job };
                            } else {
                                queueData.push(data.job);
                            }
                        } else if (Array.isArray(data)) {
                            queueData = data;
                        }
                        renderQueueJobs();
                    } catch (err) {}
                };
                queueEventSource.onerror = () => {
                    // Fallback to polling if SSE fails
                    if (queueEventSource) { queueEventSource.close(); queueEventSource = null; }
                    if (!queuePollInterval) {
                        queuePollInterval = setInterval(loadQueueJobs, 3000);
                    }
                };
            } catch (err) {
                // Fallback to polling
                if (!queuePollInterval) {
                    queuePollInterval = setInterval(loadQueueJobs, 3000);
                }
            }
        };

        window.renderQueueJobs = renderQueueJobs;
        window.loadQueueJobs = loadQueueJobs;
    }

    // ======================== OPTIONS TAB ========================

    const optionsTab = document.getElementById('tab-options');
    let optionsForm = null;
    let optionInputs = {};

    if (optionsTab) {

        optionsForm = document.getElementById('optionsContainer');
        const btnApplyOptions = document.getElementById('btnSaveOptions');
        const btnResetOptions = document.getElementById('btnResetOptions');

        initTooltip(btnApplyOptions, '', 'Save these settings so every new download uses them automatically.');
        initTooltip(btnResetOptions, '', 'Undo all your changes and go back to yt-dlp\u2019s original default settings.');

        const categoryLabels = {
            general: 'General',
            videoSelection: 'Video Selection',
            downloadOptions: 'Download Options',
            filesystem: 'Filesystem',
            thumbnails: 'Thumbnails',
            subtitles: 'Subtitles',
            postProcessing: 'Post-Processing',
            network: 'Network',
            verbosity: 'Verbosity / Logging',
        };

        const loadOptions = async () => {
            if (optionsForm) {
                optionsForm.innerHTML = '<div class="flex flex-col items-center justify-center py-16"><div class="loader mb-4"></div><p class="text-gray-400">Loading options...</p></div>';
            }
            optionInputs = {};

            try {
                const response = await fetch('/api/options');
                if (!response.ok) throw new Error('Failed to fetch options');
                const data = await response.json();
                const optionsData = data.options || data.categories || data;

                // Loading removed when form is built

                if (!optionsForm) return;
                optionsForm.innerHTML = '';

                const categories = Object.entries(optionsData);
                if (categories.length === 0) {
                    optionsForm.innerHTML = '<p class="text-gray-500 text-center py-8">No options available</p>';
                    optionsForm.classList.remove('hidden');
                    return;
                }

                categories.forEach(([category, opts]) => {
                    if (!Array.isArray(opts) || opts.length === 0) return;
                    const section = document.createElement('div');
                    section.className = 'bg-white shadow rounded-lg border border-gray-200 overflow-hidden';

                    const label = categoryLabels[category] || category.charAt(0).toUpperCase() + category.slice(1);
                    section.innerHTML = `
                        <button class="option-category-header w-full flex items-center justify-between px-6 py-4 bg-gray-50 hover:bg-gray-100 transition-colors text-left" data-category="${category}">
                            <h3 class="text-base font-semibold text-gray-900">${escapeHtml(label)}</h3>
                            <i class="fa-solid fa-chevron-down text-gray-400 transition-transform duration-200"></i>
                        </button>
                        <div class="option-category-body px-6 py-4 space-y-3" data-category="${category}"></div>
                    `;

                    const body = section.querySelector('.option-category-body');
                    opts.forEach(opt => {
                        const row = createOptionRow(opt);
                        if (row) body.appendChild(row);
                    });

                    // Toggle collapsible
                    const header = section.querySelector('.option-category-header');
                    header.addEventListener('click', () => {
                        const bodyDiv = section.querySelector('.option-category-body');
                        const icon = header.querySelector('.fa-chevron-down');
                        if (bodyDiv) {
                            bodyDiv.classList.toggle('hidden');
                            if (icon) icon.style.transform = bodyDiv.classList.contains('hidden') ? 'rotate(-90deg)' : '';
                        }
                    });

                    optionsForm.appendChild(section);
                });

                optionsForm.classList.remove('hidden');
            } catch (error) {
                console.error('Options fetch error:', error);
                if (optionsForm) {
                    optionsForm.innerHTML = `<div class="text-center py-12 text-red-500"><i class="fa-solid fa-circle-xmark text-3xl mb-2"></i><p>Failed to load options: ${escapeHtml(error.message)}</p></div>`;
                }
            }
        };

        const createOptionRow = (opt) => {
            if (!opt || !opt.flag) return null;
            const div = document.createElement('div');
            div.className = 'flex items-start gap-4 py-2 border-b border-gray-100 last:border-0';

            const labelDiv = document.createElement('div');
            labelDiv.className = 'w-1/3 flex-shrink-0';

            const label = document.createElement('label');
            label.className = 'block text-sm font-medium text-gray-700';
            label.textContent = opt.label || opt.flag;
            if (opt.description) {
                label.className += ' cursor-help';
                label.innerHTML += ' <i class="fa-solid fa-circle-info text-gray-400 text-[10px]"></i>';
                initTooltip(label, '', opt.description);
            }
            labelDiv.appendChild(label);

            if (opt.flag) {
                const flagCode = document.createElement('code');
                flagCode.className = 'text-xs text-gray-400 mt-0.5 block';
                flagCode.textContent = opt.flag + (opt.param ? ` ${opt.param}` : '');
                labelDiv.appendChild(flagCode);
            }

            div.appendChild(labelDiv);

            const inputDiv = document.createElement('div');
            inputDiv.className = 'flex-1';

            const inputId = `opt-${opt.flag.replace(/[^a-zA-Z0-9-]/g, '_')}`;

            switch (opt.type) {
                case 'boolean': {
                    const wrapper = document.createElement('div');
                    wrapper.className = 'flex items-center';
                    const checkbox = document.createElement('input');
                    checkbox.type = 'checkbox';
                    checkbox.id = inputId;
                    checkbox.className = 'h-5 w-5 text-blue-600 focus:ring-blue-500 border-gray-300 rounded cursor-pointer';
                    checkbox.dataset.flag = opt.flag;
                    checkbox.addEventListener('change', () => {
                        if (checkbox.checked) currentOptions[opt.flag] = true;
                        else delete currentOptions[opt.flag];
                    });
                    wrapper.appendChild(checkbox);
                    const checkLabel = document.createElement('span');
                    checkLabel.className = 'ml-2 text-sm text-gray-500';
                    checkLabel.textContent = 'Enabled';
                    wrapper.appendChild(checkLabel);
                    inputDiv.appendChild(wrapper);
                    optionInputs[opt.flag] = checkbox;
                    break;
                }
                case 'number': {
                    const input = document.createElement('input');
                    input.type = 'number';
                    input.id = inputId;
                    input.placeholder = opt.param || 'Number';
                    input.className = 'block w-full px-3 py-2 text-sm border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 rounded-md border shadow-sm';
                    input.dataset.flag = opt.flag;
                    input.addEventListener('change', () => {
                        if (input.value) currentOptions[opt.flag] = input.value;
                        else delete currentOptions[opt.flag];
                    });
                    inputDiv.appendChild(input);
                    optionInputs[opt.flag] = input;
                    break;
                }
                case 'choice': {
                    const select = document.createElement('select');
                    select.id = inputId;
                    select.className = 'block w-full pl-3 pr-10 py-2 text-sm border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 rounded-md border shadow-sm';
                    select.dataset.flag = opt.flag;
                    const emptyOpt = document.createElement('option');
                    emptyOpt.value = '';
                    emptyOpt.textContent = 'Default';
                    select.appendChild(emptyOpt);
                    (opt.choices || []).forEach(choice => {
                        const optEl = document.createElement('option');
                        optEl.value = choice;
                        optEl.textContent = choice;
                        select.appendChild(optEl);
                    });
                    select.addEventListener('change', () => {
                        if (select.value) currentOptions[opt.flag] = select.value;
                        else delete currentOptions[opt.flag];
                    });
                    inputDiv.appendChild(select);
                    optionInputs[opt.flag] = select;
                    break;
                }
                case 'string':
                default: {
                    const input = document.createElement('input');
                    input.type = 'text';
                    input.id = inputId;
                    input.placeholder = opt.param || 'Value';
                    input.className = 'block w-full px-3 py-2 text-sm border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 rounded-md border shadow-sm';
                    input.dataset.flag = opt.flag;
                    input.addEventListener('change', () => {
                        if (input.value) currentOptions[opt.flag] = input.value;
                        else delete currentOptions[opt.flag];
                    });
                    inputDiv.appendChild(input);
                    optionInputs[opt.flag] = input;
                    break;
                }
            }

            div.appendChild(inputDiv);
            return div;
        };

        btnApplyOptions.addEventListener('click', async () => {
            try {
                // Collect all current option values from inputs
                Object.entries(optionInputs).forEach(([flag, el]) => {
                    if (el.type === 'checkbox') {
                        if (el.checked) currentOptions[flag] = true;
                        else delete currentOptions[flag];
                    } else if (el.value) {
                        currentOptions[flag] = el.value;
                    } else {
                        delete currentOptions[flag];
                    }
                });

                const response = await fetch('/api/options/apply', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ options: currentOptions })
                });
                if (!response.ok) throw new Error('Failed to apply options');
                showToast('Options applied successfully!', 'success');
            } catch (error) {
                showToast(error.message, 'error');
            }
        });

        btnResetOptions.addEventListener('click', async () => {
            try {
                const response = await fetch('/api/options/reset', { method: 'POST' });
                if (!response.ok) throw new Error('Failed to reset options');
                currentOptions = {};
                showToast('Options reset to defaults', 'info');
                loadOptions();
            } catch (error) {
                showToast(error.message, 'error');
            }
        });

        window.loadOptions = loadOptions;
    }



    // ======================== INIT ========================

    // Auto-init any remaining [data-tooltip] elements from HTML
    initDataTooltips();

    // Initialize micro-interactions on existing elements
    initCardTilt();
    initSpotlight();

    activateTab('download');

    // Expose activateTab globally so toasts can link to tabs
    window.activateTab = activateTab;
});

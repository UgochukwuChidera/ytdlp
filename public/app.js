document.addEventListener('DOMContentLoaded', () => {
    const urlInput = document.getElementById('urlInput');
    const btnMetadata = document.getElementById('btnMetadata');
    const btnScrape = document.getElementById('btnScrape');
    const qualitySelect = document.getElementById('qualitySelect');
    const formatSelect = document.getElementById('formatSelect');
    const audioOnlyToggle = document.getElementById('audioOnlyToggle');
    const statusMessage = document.getElementById('statusMessage');
    const statusIcon = document.getElementById('statusIcon');
    const statusText = document.getElementById('statusText');
    const loadingIndicator = document.getElementById('loadingIndicator');
    const loadingText = document.getElementById('loadingText');
    const resultsContainer = document.getElementById('resultsContainer');
    const resultsGrid = document.getElementById('resultsGrid');
    const resultsTitle = document.getElementById('resultsTitle');

    // Handle Audio Only toggle to disable format/quality if needed
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

    const showLoading = (text) => {
        statusMessage.classList.add('hidden');
        resultsContainer.classList.add('hidden');
        loadingIndicator.classList.remove('hidden');
        loadingIndicator.classList.add('flex');
        loadingText.textContent = text || 'Processing...';
    };

    const hideLoading = () => {
        loadingIndicator.classList.add('hidden');
        loadingIndicator.classList.remove('flex');
    };

    const showError = (message) => {
        statusMessage.className = 'rounded-md p-4 mb-8 bg-red-50 border border-red-200';
        statusIcon.innerHTML = '<i class="fa-solid fa-circle-xmark text-red-400 text-lg"></i>';
        statusText.className = 'text-sm font-medium text-red-800';
        statusText.textContent = message;
        statusMessage.classList.remove('hidden');
    };

    const showSuccess = (message) => {
        statusMessage.className = 'rounded-md p-4 mb-8 bg-green-50 border border-green-200';
        statusIcon.innerHTML = '<i class="fa-solid fa-circle-check text-green-400 text-lg"></i>';
        statusText.className = 'text-sm font-medium text-green-800';
        statusText.textContent = message;
        statusMessage.classList.remove('hidden');
    };

    const showInfo = (message) => {
        statusMessage.className = 'rounded-md p-4 mb-8 bg-blue-50 border border-blue-200';
        statusIcon.innerHTML = '<i class="fa-solid fa-circle-info text-blue-400 text-lg"></i>';
        statusText.className = 'text-sm font-medium text-blue-800';
        statusText.textContent = message;
        statusMessage.classList.remove('hidden');
    };

    const formatDuration = (seconds) => {
        if (!seconds || isNaN(seconds)) return 'Unknown';
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    const createVideoCard = (video) => {
        const card = document.createElement('div');
        card.className = 'bg-white overflow-hidden shadow rounded-lg flex flex-col transition-transform hover:-translate-y-1 hover:shadow-lg duration-200 border border-gray-100';
        
        const thumbnail = video.thumbnail || 'https://via.placeholder.com/320x180.png?text=No+Thumbnail';
        const title = video.title || 'Unknown Title';
        const channel = video.uploader || video.channel || 'Unknown Channel';
        const duration = formatDuration(video.duration);
        const url = video.webpage_url || video.url || urlInput.value;

        card.innerHTML = `
            <div class="relative pt-[56.25%] bg-gray-100 group">
                <img class="absolute inset-0 w-full h-full object-cover" src="${thumbnail}" alt="Thumbnail" onerror="this.src='https://via.placeholder.com/320x180.png?text=Image+Error'">
                <div class="absolute bottom-2 right-2 bg-black bg-opacity-80 text-white text-xs px-1.5 py-0.5 rounded font-medium tracking-wide">
                    ${duration}
                </div>
                <div class="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-10 transition-opacity duration-200"></div>
            </div>
            <div class="p-4 flex-1 flex flex-col">
                <h3 class="text-sm font-semibold text-gray-900 mb-1 line-clamp-2" title="${title.replace(/"/g, '&quot;')}">${title}</h3>
                <p class="text-xs text-gray-500 mb-4 flex items-center">
                    <i class="fa-solid fa-user-circle mr-1"></i>${channel}
                </p>
                <div class="mt-auto">
                    <button class="download-btn w-full inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors" data-url="${url.replace(/"/g, '&quot;')}">
                        <i class="fa-solid fa-download mr-2"></i>Download
                    </button>
                </div>
            </div>
        `;

        // Add event listener to the download button
        const downloadBtn = card.querySelector('.download-btn');
        downloadBtn.addEventListener('click', () => handleDownload(url, title, downloadBtn));

        return card;
    };

    const handleDownload = async (url, title, buttonEl) => {
        const originalText = buttonEl.innerHTML;
        buttonEl.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i>Starting...';
        buttonEl.disabled = true;
        buttonEl.classList.add('opacity-75', 'cursor-not-allowed');

        const requestBody = {
            url: url,
            format: formatSelect.value,
            quality: qualitySelect.value,
            audioOnly: audioOnlyToggle.checked
        };

        try {
            showInfo(`Starting download for: ${title}`);
            const response = await fetch('/api/download', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                // Try to parse json error, if not just text
                let errMsg = `HTTP Error ${response.status}`;
                try {
                    const errText = await response.text();
                    try {
                        const errData = JSON.parse(errText);
                        errMsg = errData.error || errMsg;
                    } catch (e) {
                        errMsg = errText || errMsg;
                    }
                } catch(e) {}
                throw new Error(errMsg);
            }

            // Get filename from Content-Disposition header if possible
            let filename = 'download';
            const disposition = response.headers.get('Content-Disposition');
            if (disposition && disposition.indexOf('attachment') !== -1) {
                const filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
                const matches = filenameRegex.exec(disposition);
                if (matches != null && matches[1]) { 
                    filename = matches[1].replace(/['"]/g, '');
                    // Decode URI encoded filename if needed
                    try { filename = decodeURIComponent(filename); } catch(e) {}
                }
            } else {
                // fallback extension
                const ext = audioOnlyToggle.checked ? 'mp3' : formatSelect.value;
                // create a safe filename
                const safeTitle = title.replace(/[/\\\\?%*:|"<>]/g, '-').substring(0, 50);
                filename = `${safeTitle}.${ext}`;
            }

            buttonEl.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i>Downloading...';
            
            const blob = await response.blob();
            const downloadUrl = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = downloadUrl;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(downloadUrl);
            document.body.removeChild(a);
            
            showSuccess(`Download completed: ${filename}`);
        } catch (error) {
            console.error('Download error:', error);
            showError(`Download failed: ${error.message}`);
        } finally {
            buttonEl.innerHTML = originalText;
            buttonEl.disabled = false;
            buttonEl.classList.remove('opacity-75', 'cursor-not-allowed');
        }
    };

    btnMetadata.addEventListener('click', async () => {
        const url = urlInput.value.trim();
        if (!url) return showError('Please enter a valid URL');

        showLoading('Fetching metadata...');
        try {
            const response = await fetch(`/api/metadata?url=${encodeURIComponent(url)}`);
            const data = await response.json();

            if (!response.ok) throw new Error(data.error || 'Failed to fetch metadata');

            hideLoading();
            statusMessage.classList.add('hidden'); // clear previous messages
            resultsGrid.innerHTML = '';
            resultsTitle.textContent = 'Single Video';
            
            // Render single video
            const card = createVideoCard(data);
            resultsGrid.appendChild(card);
            resultsContainer.classList.remove('hidden');
        } catch (error) {
            hideLoading();
            showError(error.message);
        }
    });

    btnScrape.addEventListener('click', async () => {
        const url = urlInput.value.trim();
        if (!url) return showError('Please enter a valid URL');

        showLoading('Scraping channel/playlist (this may take a while depending on size)...');
        try {
            const response = await fetch(`/api/scrape?url=${encodeURIComponent(url)}`);
            const data = await response.json();

            if (!response.ok) throw new Error(data.error || 'Failed to scrape URL');

            hideLoading();
            statusMessage.classList.add('hidden'); // clear previous messages
            resultsGrid.innerHTML = '';
            
            // Data could be an array of entries, or an object containing entries
            let entries = [];
            if (Array.isArray(data)) {
                entries = data;
            } else if (data.entries) {
                entries = data.entries;
            } else if (data.items) {
                entries = data.items;
            } else if (data.id) {
                // Single video returned
                entries = [data];
            }
            
            if (entries.length === 0) {
                resultsTitle.textContent = 'No videos found';
            } else {
                resultsTitle.textContent = `Found ${entries.length} Video${entries.length > 1 ? 's' : ''}`;
                entries.forEach(video => {
                    if (video) resultsGrid.appendChild(createVideoCard(video));
                });
            }
            
            resultsContainer.classList.remove('hidden');
        } catch (error) {
            hideLoading();
            showError(error.message);
        }
    });

    // Allow pressing Enter in the URL input to trigger metadata fetch
    urlInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            btnMetadata.click();
        }
    });
});
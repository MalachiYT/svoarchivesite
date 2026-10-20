// Pulls the file list for an archive.org item and renders it as download links.
// Tries the live archive.org Metadata API first. If the browser blocks it (CORS)
// or the request fails, falls back to a saved copy at data/files.json.

const ITEM_ID = 'sourcevoid-online-archiveproject';
const API_URL = `https://archive.org/metadata/${ITEM_ID}`;
const FALLBACK_URL = 'data/files.json';

const listEl = document.getElementById('file-list');
const statusEl = document.getElementById('file-status');
const filterEl = document.getElementById('file-filter');
const buildFilterEl = document.getElementById('build-filter');

let allFiles = [];

// Build types are detected from the uploaded file name. Order matters: a file
// such as "0.1b3_GodotSourceMountPatch" is a patch first, beta second.
const BUILD_TYPES = [
    { id: 'patch', label: 'Patch', match: name => /patch/i.test(name) },
    { id: 'prerelease', label: 'Pre-release', match: name => /\dpr\d*/i.test(name) },
    { id: 'beta', label: 'Beta', match: name => /\db\d+/i.test(name) },
    { id: 'experimental', label: 'Experimental', match: name => /\de\d+/i.test(name) },
];

function getBuildType(name) {
    return BUILD_TYPES.find(type => type.match(name)) || null;
}

async function getJSON(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${url} returned ${res.status}`);
    return res.json();
}

function formatSize(bytes) {
    const n = Number(bytes);
    if (!Number.isFinite(n) || n <= 0) return '';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.min(Math.floor(Math.log(n) / Math.log(1024)), units.length - 1);
    const value = n / Math.pow(1024, i);
    return `${value >= 100 || i === 0 ? Math.round(value) : value.toFixed(1)} ${units[i]}`;
}

function downloadUrl(name) {
    const path = name.split('/').map(encodeURIComponent).join('/');
    return `https://archive.org/download/${ITEM_ID}/${path}`;
}

// Keep the files someone actually uploaded; drop archive.org's auto-generated extras.
function pickFiles(data) {
    return (data.files || [])
        .filter(f => f.source === 'original')
        .filter(f => f.format !== 'Metadata' && f.format !== 'Item Tile')
        .filter(f => !f.name.startsWith('__ia_thumb'))
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
}

function render(files) {
    listEl.replaceChildren();

    for (const file of files) {
        const li = document.createElement('li');

        const link = document.createElement('a');
        link.href = downloadUrl(file.name);
        link.textContent = file.name;
        link.className = 'file-name';

        const size = document.createElement('span');
        size.className = 'file-size';
        size.textContent = formatSize(file.size);

        li.append(link);

        const buildType = getBuildType(file.name);
        if (buildType) {
            const badge = document.createElement('span');
            badge.className = `build-badge ${buildType.id}`;
            badge.textContent = buildType.label;
            li.append(badge);
        }

        li.append(size);

        listEl.append(li);
    }
}

function applyFilter() {
    const q = filterEl.value.trim().toLowerCase();
    const type = buildFilterEl.value;

    const shown = allFiles.filter(file => {
        if (q && !file.name.toLowerCase().includes(q)) return false;
        if (type === 'all') return true;

        const buildType = getBuildType(file.name);
        if (type === 'stable') return !buildType;
        return buildType?.id === type;
    });

    render(shown);

    if (!allFiles.length) return;
    statusEl.textContent = shown.length
        ? `${shown.length} of ${allFiles.length} files`
        : 'No files match those filters.';
}

async function load() {
    let data;
    let usedFallback = false;

    try {
        data = await getJSON(API_URL);
    } catch (liveError) {
        try {
            data = await getJSON(FALLBACK_URL);
            usedFallback = true;
        } catch (fallbackError) {
            statusEl.textContent = "Couldn't load the file list. Use the archive.org link below instead.";
            return;
        }
    }

    allFiles = pickFiles(data);

    if (!allFiles.length) {
        statusEl.textContent = 'No files found in this archive item yet.';
        return;
    }

    applyFilter();
    if (usedFallback) {
        statusEl.textContent += ' (saved copy, may be out of date)';
    }
}

filterEl.addEventListener('input', applyFilter);
buildFilterEl.addEventListener('change', applyFilter);
load();

/**
 * Security Review Dashboard — Core JS Module
 *
 * Provides: API wrapper, lightweight router, Chart.js helpers, and
 * comparison/diff rendering. No build step required — vanilla ES6.
 */

// ==========================================================================
// API — Fetch wrapper for all backend calls
// ==========================================================================
const api = {
    /** Generic JSON fetch with error handling. */
    async _fetch(url, options = {}) {
        try {
            const res = await fetch(url, {
                headers: { 'Content-Type': 'application/json' },
                ...options,
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.detail || `HTTP ${res.status}`);
            }
            return res.json();
        } catch (e) {
            console.error(`[API] ${url}:`, e);
            throw e;
        }
    },

    getProjects() { return this._fetch('/api/projects'); },
    getProjectScans(id) { return this._fetch(`/api/projects/${id}/scans`); },
    getScanDetail(id) { return this._fetch(`/api/scans/${id}`); },
    getScanStatus(id) { return this._fetch(`/api/scans/${id}/status`); },
    compareScan(a, b) { return this._fetch(`/api/scans/${a}/compare/${b}`); },
    launchScan(payload) {
        return this._fetch('/api/scans/launch', {
            method: 'POST',
            body: JSON.stringify(payload),
        });
    },
};


// ==========================================================================
// Helpers
// ==========================================================================
/** Render severity badge HTML. */
function severityBadge(severity, count = null) {
    const sev = (severity || '').toLowerCase();
    const label = severity.toUpperCase();
    const countHtml = count !== null
        ? `<span class="badge-count">${count}</span>`
        : '';
    return `<span class="badge badge-${sev}">${countHtml} ${label}</span>`;
}

/** Render a set of severity badges from counts object. */
function severityBadges(counts) {
    const order = ['critical', 'high', 'medium', 'low'];
    return order
        .filter(s => (counts[s] || 0) > 0)
        .map(s => severityBadge(s, counts[s]))
        .join('');
}

/** Format ISO date string to readable format. */
function formatDate(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', {
        year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit',
    });
}

/** Show a loading spinner inside a container element. */
function showLoading(container) {
    container.innerHTML = `
        <div class="loading">
            <div class="spinner"></div>
            <p>Loading…</p>
        </div>`;
}

/** Show an empty-state message. */
function showEmpty(container, message = 'No data found.', icon = '📭') {
    container.innerHTML = `
        <div class="empty-state">
            <div class="empty-icon">${icon}</div>
            <p>${message}</p>
        </div>`;
}


// ==========================================================================
// Charts — Chart.js wrappers (loaded via CDN in base.html)
// ==========================================================================
const charts = {
    /**
     * Severity donut chart.
     * @param {HTMLCanvasElement} canvas
     * @param {{critical, high, medium, low}} counts
     */
    severityDonut(canvas, counts) {
        return new Chart(canvas, {
            type: 'doughnut',
            data: {
                labels: ['Critical', 'High', 'Medium', 'Low'],
                datasets: [{
                    data: [counts.critical || 0, counts.high || 0,
                    counts.medium || 0, counts.low || 0],
                    backgroundColor: ['#DC2626', '#EA580C', '#CA8A04', '#16A34A'],
                    borderWidth: 0,
                    hoverOffset: 6,
                }],
            },
            options: {
                responsive: true,
                cutout: '68%',
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { font: { family: 'Inter', size: 12 }, padding: 16 },
                    },
                },
            },
        });
    },

    /**
     * Severity trend line chart (over multiple scans).
     * @param {HTMLCanvasElement} canvas
     * @param {Array} scans — sorted oldest → newest
     */
    trendLine(canvas, scans) {
        const labels = scans.map(s => {
            const d = new Date(s.started_at);
            return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        });
        return new Chart(canvas, {
            type: 'line',
            data: {
                labels,
                datasets: [
                    { label: 'Critical', data: scans.map(s => s.critical), borderColor: '#DC2626', tension: 0.3, borderWidth: 2 },
                    { label: 'High', data: scans.map(s => s.high), borderColor: '#EA580C', tension: 0.3, borderWidth: 2 },
                    { label: 'Medium', data: scans.map(s => s.medium), borderColor: '#CA8A04', tension: 0.3, borderWidth: 2 },
                    { label: 'Low', data: scans.map(s => s.low), borderColor: '#16A34A', tension: 0.3, borderWidth: 2 },
                ],
            },
            options: {
                responsive: true,
                interaction: { mode: 'index', intersect: false },
                plugins: {
                    legend: {
                        labels: { font: { family: 'Inter', size: 12 }, padding: 12 },
                    },
                },
                scales: {
                    y: { beginAtZero: true, ticks: { stepSize: 1 } },
                },
            },
        });
    },
};


// ==========================================================================
// Page renderers — called from each page template
// ==========================================================================

/**
 * Render the homepage projects grid.
 * @param {HTMLElement} container
 */
async function renderProjects(container) {
    showLoading(container);
    try {
        const projects = await api.getProjects();
        if (!projects.length) {
            showEmpty(container, 'No projects found. Launch a scan to get started!', '🔍');
            return;
        }
        container.innerHTML = `<div class="card-grid" id="projects-grid"></div>`;
        const grid = document.getElementById('projects-grid');

        projects.forEach(p => {
            const card = document.createElement('div');
            card.className = 'card project-card';
            card.onclick = () => window.location.href = `/project/${p.id}`;
            card.innerHTML = `
                <div class="project-name">${p.name}</div>
                <div class="project-meta">
                    Last scan: ${formatDate(p.last_scan_date)}
                    ${p.last_scan_status ? ` · <span class="badge badge-${p.last_scan_status === 'completed' ? 'low' : 'high'}">${p.last_scan_status}</span>` : ''}
                </div>
                <div class="severity-badges">
                    ${severityBadges({ critical: p.critical, high: p.high, medium: p.medium, low: p.low })}
                </div>
                <div class="text-muted text-sm mt-1">
                    ${p.total_findings != null ? `${p.total_findings} findings` : 'No scans yet'}
                </div>`;
            grid.appendChild(card);
        });
    } catch (e) {
        showEmpty(container, 'Failed to load projects.', '⚠️');
    }
}

/**
 * Render project detail: scans timeline + trend chart.
 * @param {HTMLElement} container
 * @param {number} projectId
 */
async function renderProjectDetail(container, projectId) {
    showLoading(container);
    try {
        const scans = await api.getProjectScans(projectId);

        // Trend chart (oldest → newest for X axis)
        const sortedAsc = [...scans].reverse();
        container.innerHTML = `
            <div class="card mb-3">
                <div class="card-header"><h3>Severity Trend</h3></div>
                <div class="chart-container">
                    <canvas id="trend-chart"></canvas>
                </div>
            </div>

            <div class="card">
                <div class="card-header flex-between">
                    <h3>Scan History</h3>
                    <a href="/launch" class="btn btn-primary btn-sm">🚀 New Scan</a>
                </div>
                <table class="data-table" id="scans-table">
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Status</th>
                            <th>Findings</th>
                            <th>Severity</th>
                            <th>Duration</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody id="scans-body"></tbody>
                </table>
            </div>`;

        // Render scans table
        const tbody = document.getElementById('scans-body');
        scans.forEach((s, i) => {
            const row = document.createElement('tr');
            const nextScan = scans[i + 1]; // previous chronologically (scans sorted DESC)
            const compareLink = nextScan
                ? `<a href="/compare?a=${nextScan.id}&b=${s.id}" class="btn btn-secondary btn-sm">Compare ↔</a>`
                : '';
            row.innerHTML = `
                <td>${formatDate(s.started_at)}</td>
                <td><span class="badge badge-${s.status === 'completed' ? 'low' : 'high'}">${s.status}</span></td>
                <td>${s.total_findings}</td>
                <td>${severityBadges(s)}</td>
                <td>${s.duration_seconds ? s.duration_seconds.toFixed(0) + 's' : '—'}</td>
                <td>
                    <a href="/scan/${s.id}" class="btn btn-primary btn-sm">View</a>
                    ${compareLink}
                </td>`;
            tbody.appendChild(row);
        });

        // Render trend chart
        if (sortedAsc.length > 1) {
            charts.trendLine(document.getElementById('trend-chart'), sortedAsc);
        }
    } catch (e) {
        showEmpty(container, 'Failed to load project data.', '⚠️');
    }
}

/**
 * Render full scan report: stats + donut chart + findings table.
 * @param {HTMLElement} container
 * @param {number} scanId
 */
async function renderScanReport(container, scanId) {
    showLoading(container);
    try {
        const data = await api.getScanDetail(scanId);
        const { scan, findings } = data;

        container.innerHTML = `
            <!-- Stats cards -->
            <div class="stats-row">
                <div class="card stat-card">
                    <div class="stat-value">${scan.total_findings}</div>
                    <div class="stat-label">Total Findings</div>
                </div>
                <div class="card stat-card">
                    <div class="stat-value" style="color: var(--severity-critical)">${scan.critical}</div>
                    <div class="stat-label">Critical</div>
                </div>
                <div class="card stat-card">
                    <div class="stat-value" style="color: var(--severity-high)">${scan.high}</div>
                    <div class="stat-label">High</div>
                </div>
                <div class="card stat-card">
                    <div class="stat-value" style="color: var(--severity-medium)">${scan.medium}</div>
                    <div class="stat-label">Medium</div>
                </div>
                <div class="card stat-card">
                    <div class="stat-value" style="color: var(--severity-low)">${scan.low}</div>
                    <div class="stat-label">Low</div>
                </div>
            </div>

            <!-- Donut chart -->
            <div class="card mb-3">
                <div class="card-header"><h3>Severity Distribution</h3></div>
                <div class="chart-container">
                    <canvas id="severity-donut"></canvas>
                </div>
            </div>

            <!-- Filter bar -->
            <div class="card mb-3">
                <div class="flex-between">
                    <h3>Findings (${findings.length})</h3>
                    <div class="flex gap-1">
                        <select class="form-select" id="filter-severity" style="width:auto; min-width:140px;">
                            <option value="">All Severities</option>
                            <option value="CRITICAL">Critical</option>
                            <option value="HIGH">High</option>
                            <option value="MEDIUM">Medium</option>
                            <option value="LOW">Low</option>
                        </select>
                    </div>
                </div>
            </div>

            <!-- Findings table -->
            <div class="card">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th style="width:50px">#</th>
                            <th>Finding</th>
                            <th>Severity</th>
                            <th>OWASP</th>
                            <th>File</th>
                        </tr>
                    </thead>
                    <tbody id="findings-body"></tbody>
                </table>
            </div>`;

        // Render donut
        charts.severityDonut(document.getElementById('severity-donut'), scan);

        // Render findings
        const tbody = document.getElementById('findings-body');
        renderFindingsRows(tbody, findings);

        // Filter handler
        document.getElementById('filter-severity').addEventListener('change', e => {
            const val = e.target.value;
            const filtered = val
                ? findings.filter(f => f.severity.toUpperCase() === val)
                : findings;
            renderFindingsRows(tbody, filtered);
        });

    } catch (e) {
        showEmpty(container, 'Failed to load scan report.', '⚠️');
    }
}

/** Render findings rows into a tbody element. */
function renderFindingsRows(tbody, findings) {
    tbody.innerHTML = '';
    findings.forEach((f, i) => {
        // Main row
        const tr = document.createElement('tr');
        tr.className = 'finding-row';
        tr.innerHTML = `
            <td>${i + 1}</td>
            <td><strong>${f.title}</strong></td>
            <td>${severityBadge(f.severity)}</td>
            <td class="text-sm">${f.owasp || '—'}</td>
            <td class="text-sm" style="font-family: monospace">${f.file || '—'}</td>`;
        tbody.appendChild(tr);

        // Detail row (expandable)
        const detailTr = document.createElement('tr');
        detailTr.innerHTML = `
            <td colspan="5" style="padding:0">
                <div class="finding-detail" id="detail-${f.id || i}">
                    <div class="detail-section">
                        <div class="detail-label">Description</div>
                        <p>${f.description || 'No description available.'}</p>
                    </div>
                    <div class="detail-section">
                        <div class="detail-label">Remediation</div>
                        <p>${f.remediation || 'No remediation suggested.'}</p>
                    </div>
                </div>
            </td>`;
        tbody.appendChild(detailTr);

        // Toggle detail on click
        tr.addEventListener('click', () => {
            const detail = document.getElementById(`detail-${f.id || i}`);
            detail.classList.toggle('open');
        });
    });
}

/**
 * Render scan comparison page.
 * @param {HTMLElement} container
 * @param {number} idA — older scan
 * @param {number} idB — newer scan
 */
async function renderComparison(container, idA, idB) {
    showLoading(container);
    try {
        const data = await api.compareScan(idA, idB);

        container.innerHTML = `
            <!-- Summary stats -->
            <div class="stats-row">
                <div class="card stat-card">
                    <div class="stat-value diff-new">${data.new.length}</div>
                    <div class="stat-label">🔴 New Issues</div>
                </div>
                <div class="card stat-card">
                    <div class="stat-value diff-resolved">${data.resolved.length}</div>
                    <div class="stat-label">🟢 Resolved</div>
                </div>
                <div class="card stat-card">
                    <div class="stat-value diff-unchanged">${data.unchanged.length}</div>
                    <div class="stat-label">⚪ Unchanged</div>
                </div>
            </div>

            <!-- Comparison header -->
            <div class="card mb-3 flex-between">
                <div>
                    <div class="text-sm text-muted">Scan A (older)</div>
                    <div class="fw-600">${formatDate(data.scan_a.started_at)}</div>
                    <div class="text-sm">${data.scan_a.total_findings} findings</div>
                </div>
                <div style="font-size:1.5rem">↔</div>
                <div style="text-align:right">
                    <div class="text-sm text-muted">Scan B (newer)</div>
                    <div class="fw-600">${formatDate(data.scan_b.started_at)}</div>
                    <div class="text-sm">${data.scan_b.total_findings} findings</div>
                </div>
            </div>

            <!-- New findings -->
            ${renderDiffSection('🔴 New Findings', data.new, 'diff-new')}
            <!-- Resolved findings -->
            ${renderDiffSection('🟢 Resolved Findings', data.resolved, 'diff-resolved')}
            <!-- Unchanged -->
            ${renderDiffSection('⚪ Unchanged Findings', data.unchanged, 'diff-unchanged')}
        `;
    } catch (e) {
        showEmpty(container, 'Failed to load comparison data.', '⚠️');
    }
}

/** Render a diff section (new / resolved / unchanged). */
function renderDiffSection(title, findings, cssClass) {
    if (!findings.length) {
        return `<div class="card mb-3"><h3 class="${cssClass}">${title}</h3><p class="text-muted mt-1">None</p></div>`;
    }
    const rows = findings.map(f => `
        <tr>
            <td><strong>${f.title}</strong></td>
            <td>${severityBadge(f.severity)}</td>
            <td class="text-sm">${f.owasp || '—'}</td>
            <td class="text-sm" style="font-family:monospace">${f.file || '—'}</td>
        </tr>
    `).join('');

    return `
        <div class="card mb-3">
            <h3 class="${cssClass}">${title} (${findings.length})</h3>
            <table class="data-table mt-2">
                <thead>
                    <tr><th>Finding</th><th>Severity</th><th>OWASP</th><th>File</th></tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        </div>`;
}


/**
 * Launch scan form handler.
 * @param {HTMLFormElement} form
 * @param {HTMLElement} statusContainer
 */
function setupLaunchForm(form, statusContainer) {
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const payload = {
            repo_path: form.repo_path.value.trim(),
            model: form.model?.value?.trim() || null,
            backend: form.backend?.value || null,
            parallel: parseInt(form.parallel?.value || '1'),
        };

        if (!payload.repo_path) {
            statusContainer.innerHTML = '<p class="diff-new">Please enter a repository path.</p>';
            return;
        }

        // Disable form during scan
        const submitBtn = form.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.textContent = '⏳ Launching…';

        try {
            const result = await api.launchScan(payload);

            statusContainer.innerHTML = `
                <div class="card">
                    <h3>Scan #${result.scan_id} — Running</h3>
                    <div class="progress-bar mt-2">
                        <div class="progress-fill" style="width: 30%"></div>
                    </div>
                    <p class="text-muted text-sm mt-1" id="scan-status-text">Scan in progress…</p>
                </div>`;

            // Poll status
            pollScanStatus(result.scan_id, statusContainer);
        } catch (err) {
            statusContainer.innerHTML = `<p class="diff-new">Launch failed: ${err.message}</p>`;
            submitBtn.disabled = false;
            submitBtn.textContent = '🚀 Launch Scan';
        }
    });
}

/** Poll scan status until completed or failed. */
async function pollScanStatus(scanId, statusContainer) {
    const interval = setInterval(async () => {
        try {
            const status = await api.getScanStatus(scanId);
            const text = document.getElementById('scan-status-text');

            if (status.status === 'completed') {
                clearInterval(interval);
                statusContainer.innerHTML = `
                    <div class="card">
                        <h3 class="diff-resolved">✅ Scan Completed!</h3>
                        <p class="mt-1"><a href="/scan/${scanId}" class="btn btn-primary">View Report →</a></p>
                    </div>`;
            } else if (status.status === 'failed') {
                clearInterval(interval);
                statusContainer.innerHTML = `
                    <div class="card">
                        <h3 class="diff-new">❌ Scan Failed</h3>
                        <p class="text-muted mt-1">Check the server logs for details.</p>
                    </div>`;
            } else if (text) {
                text.textContent = `Scan in progress… (polling)`;
            }
        } catch {
            // Continue polling even if a single request fails
        }
    }, 5000); // Poll every 5 seconds
}

/**
 * @NApiVersion 2.1
 * @NModuleScope SameAccount
 *
 * Name:        DA Operations Console UI
 * Purpose:     Browser side of the console: a React page styled with
 *              Bootstrap, with KPI cards and a searchable, sortable order
 *              table that flags orders waiting on credit review.
 * Build:       No bundler. React and htm load from pinned CDN versions and
 *              htm gives JSX style templates without a compile step.
 * @author      Dilshad Ali
 */
define([], () => {

    // ------------------------------------------------------------------
    // CLIENT APPLICATION (runs in the browser)
    // ------------------------------------------------------------------

    /* global React, ReactDOM, htm */
    const clientApp = function () {
        const { useEffect, useMemo, useState, createElement } = React;
        const html = htm.bind(createElement);
        const money = new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

        const Kpi = ({ label, value, note, tone }) => html`
            <div className="col-12 col-md-4">
                <div className=${'card h-100 border-0 shadow-sm kpi kpi-' + tone}>
                    <div className="card-body">
                        <div className="small text-uppercase fw-semibold text-body-secondary">${label}</div>
                        <div className="fs-3 fw-bold">${value}</div>
                        <div className="small text-body-secondary">${note}</div>
                    </div>
                </div>
            </div>`;

        const App = () => {
            const [data, setData] = useState(null);
            const [error, setError] = useState('');
            const [search, setSearch] = useState('');
            const [heldOnly, setHeldOnly] = useState(false);
            const [sort, setSort] = useState({ key: 'date', dir: -1 });

            const load = () => {
                const endpoint = new URL(window.location.href);
                endpoint.searchParams.set('action', 'data');
                fetch(endpoint, { credentials: 'same-origin' })
                    .then((r) => r.json())
                    .then((json) => (json.error ? setError(json.error) : setData(json)))
                    .catch((e) => setError(e.message));
            };
            useEffect(load, []);

            const rows = useMemo(() => {
                if (!data) return [];
                const needle = search.trim().toLowerCase();
                return data.orders
                    .filter((o) => !heldOnly || o.reason)
                    .filter((o) => !needle || `${o.number} ${o.customer} ${o.status}`.toLowerCase().includes(needle))
                    .sort((a, b) => (a[sort.key] > b[sort.key] ? 1 : a[sort.key] < b[sort.key] ? -1 : 0) * sort.dir);
            }, [data, search, heldOnly, sort]);

            const Th = ({ id, label, end }) => html`
                <th className=${'sortable' + (end ? ' text-end' : '')}
                    onClick=${() => setSort({ key: id, dir: sort.key === id ? -sort.dir : 1 })}>
                    ${label}${sort.key === id ? (sort.dir === 1 ? ' ▲' : ' ▼') : ''}
                </th>`;

            if (error) return html`<div className="alert alert-danger m-4">${error}</div>`;
            if (!data) return html`<div className="text-center p-5"><div className="spinner-border text-primary"></div></div>`;
            const k = data.kpis;

            return html`
                <main className="container-fluid p-4">
                    <div className="d-flex align-items-center mb-4">
                        <h1 className="h4 m-0">Operations Console</h1>
                        <button className="btn btn-sm btn-outline-primary ms-auto" onClick=${load}>Refresh</button>
                    </div>
                    <div className="row g-3 mb-4">
                        <${Kpi} label="Open orders" value=${k.backlogCount} note=${money.format(k.backlogAmount) + ' backlog'} tone="primary" />
                        <${Kpi} label="Overdue invoices" value=${k.overdueCount} note=${money.format(k.overdueAmount) + ' past due'} tone="danger" />
                        <${Kpi} label="Credit review" value=${k.heldCount} note="Orders waiting on finance" tone="warning" />
                    </div>
                    <div className="card border-0 shadow-sm"><div className="card-body">
                        <div className="d-flex flex-wrap gap-3 align-items-center mb-3">
                            <input className="form-control form-control-sm search" placeholder="Search order, customer or status"
                                value=${search} onInput=${(e) => setSearch(e.target.value)} />
                            <div className="form-check form-switch m-0">
                                <input className="form-check-input" type="checkbox" id="held" checked=${heldOnly}
                                    onChange=${(e) => setHeldOnly(e.target.checked)} />
                                <label className="form-check-label small" htmlFor="held">Credit review only</label>
                            </div>
                            <span className="ms-auto small text-body-secondary">${rows.length} of ${data.orders.length}</span>
                        </div>
                        <div className="table-responsive"><table className="table table-sm table-hover align-middle">
                            <thead><tr>
                                <${Th} id="number" label="Order" /><${Th} id="date" label="Date" />
                                <${Th} id="customer" label="Customer" /><${Th} id="status" label="Status" />
                                <${Th} id="total" label="Total" end=${true} />
                            </tr></thead>
                            <tbody>${rows.map((o) => html`
                                <tr key=${o.id}>
                                    <td><a href=${o.link} target="_blank" rel="noopener">${o.number}</a></td>
                                    <td>${o.date}</td>
                                    <td>${o.customer}</td>
                                    <td>${o.reason
                                        ? html`<span className="badge text-bg-warning" title=${o.reason}>Credit review</span>`
                                        : html`<span className="badge text-bg-light border">${o.status}</span>`}</td>
                                    <td className="text-end">${money.format(o.total)} <small className="text-body-secondary">${o.currency}</small></td>
                                </tr>`)}
                            </tbody>
                        </table></div>
                    </div></div>
                </main>`;
        };

        ReactDOM.createRoot(document.getElementById('app')).render(html`<${App} />`);
    };

    // ------------------------------------------------------------------
    // PAGE SHELL
    // ------------------------------------------------------------------

    const CDN = [
        'https://cdnjs.cloudflare.com/ajax/libs/react/18.3.1/umd/react.production.min.js',
        'https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.3.1/umd/react-dom.production.min.js',
        'https://cdn.jsdelivr.net/npm/htm@3.1.1/dist/htm.umd.js',
    ];

    const STYLES = `
        body { background: #f4f6f9; }
        .kpi { border-left: 4px solid var(--tone) !important; }
        .kpi-primary { --tone: var(--bs-primary); }
        .kpi-danger { --tone: var(--bs-danger); }
        .kpi-warning { --tone: var(--bs-warning); }
        .search { max-width: 320px; }
        th.sortable { cursor: pointer; user-select: none; white-space: nowrap; }`;

    const renderPage = (title) => `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css">
<style>${STYLES}</style>
</head><body>
<div id="app"></div>
${CDN.map((src) => `<script src="${src}"></script>`).join('\n')}
<script>(${clientApp.toString()})();</script>
</body></html>`;

    return { renderPage };
});

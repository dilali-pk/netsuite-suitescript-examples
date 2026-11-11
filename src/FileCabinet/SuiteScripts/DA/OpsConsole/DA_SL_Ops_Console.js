/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @NModuleScope SameAccount
 *
 * Name:        DA Operations Console
 * Purpose:     One screen for operations and finance: order backlog,
 *              overdue receivables and orders waiting on credit review.
 * Shape:       Single page app. GET returns the page; GET with action=data
 *              returns JSON, so the server spends governance on queries and
 *              the browser does the rendering.
 * Access:      Deployment audience. Queries run as the signed in role.
 * @author      Dilshad Ali
 */
define(['N/query', 'N/url', 'N/log', './DA_LIB_Ops_Console_UI'], (query, url, log, ui) => {

    const OPEN_STATUSES = "('A', 'B', 'D', 'E', 'F')";

    const SQL = {
        backlog: `SELECT COUNT(*) AS count, NVL(SUM(foreigntotal * exchangerate), 0) AS amount
                  FROM transaction WHERE type = 'SalesOrd' AND status IN ${OPEN_STATUSES}`,
        overdue: `SELECT COUNT(*) AS count, NVL(SUM(foreignamountunpaid * exchangerate), 0) AS amount
                  FROM transaction WHERE type = 'CustInvc' AND status = 'A' AND duedate < TRUNC(SYSDATE)`,
        orders: `SELECT t.id, t.tranid, t.trandate, BUILTIN.DF(t.entity) AS customer,
                        BUILTIN.DF(t.status) AS status, t.foreigntotal AS total,
                        BUILTIN.DF(t.currency) AS currency, t.custbody_da_credit_review_reason AS reason
                 FROM transaction t
                 WHERE t.type = 'SalesOrd' AND t.status IN ${OPEN_STATUSES}
                 ORDER BY t.trandate DESC`,
    };

    const one = (sql) => query.runSuiteQL({ query: sql }).asMappedResults()[0] || {};

    const firstPage = (sql, size) => {
        const paged = query.runSuiteQLPaged({ query: sql, pageSize: size });
        return paged.pageRanges.length ? paged.fetch({ index: 0 }).data.asMappedResults() : [];
    };

    const buildData = () => {
        const backlog = one(SQL.backlog);
        const overdue = one(SQL.overdue);
        const orders = firstPage(SQL.orders, 500).map((row) => ({
            id: row.id,
            number: row.tranid,
            date: row.trandate,
            customer: row.customer,
            status: row.status,
            reason: row.reason || '',
            total: Number(row.total) || 0,
            currency: row.currency,
            link: url.resolveRecord({ recordType: 'salesorder', recordId: row.id }),
        }));

        return {
            generatedAt: new Date().toISOString(),
            kpis: {
                backlogCount: Number(backlog.count) || 0,
                backlogAmount: Number(backlog.amount) || 0,
                overdueCount: Number(overdue.count) || 0,
                overdueAmount: Number(overdue.amount) || 0,
                heldCount: orders.filter((o) => o.reason).length,
            },
            orders,
        };
    };

    const onRequest = ({ request, response }) => {
        if (request.parameters.action !== 'data') {
            response.write(ui.renderPage('Operations Console'));
            return;
        }
        response.setHeader({ name: 'Content-Type', value: 'application/json' });
        try {
            response.write(JSON.stringify(buildData()));
        } catch (error) {
            log.error({ title: 'Console data failed', details: error });
            response.write(JSON.stringify({ error: error.message }));
        }
    };

    return { onRequest };
});

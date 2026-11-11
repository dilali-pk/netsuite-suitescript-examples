/**
 * @NApiVersion 2.1
 * @NModuleScope SameAccount
 *
 * Name:        DA Order Intake Library
 * Purpose:     Validates a channel order, maps it to a sales order and
 *              creates it exactly once.
 * Idempotency: The channel order id becomes the sales order External ID,
 *              which NetSuite keeps unique, so a resent order returns the
 *              one already created instead of a second copy.
 * @author      Dilshad Ali
 */
define(['N/record', 'N/query'], (record, query) => {

    const MAX_LINES = 200;

    const text = (value) => (value === null || value === undefined ? '' : String(value).trim());

    const intakeError = (code, message) => {
        const error = new Error(message);
        error.name = code;
        return error;
    };

    // ------------------------------------------------------------------
    // VALIDATION
    // ------------------------------------------------------------------

    /** Returns { ok, errors } or { ok, order } with same SKU lines merged. */
    const validateOrder = (payload) => {
        const body = payload && typeof payload === 'object' ? payload : {};
        const errors = [];

        const externalId = text(body.externalId);
        const customerExternalId = text(body.customerExternalId);
        if (!externalId) errors.push('externalId is required');
        if (!customerExternalId) errors.push('customerExternalId is required');

        const rawLines = Array.isArray(body.lines) ? body.lines : [];
        if (!rawLines.length) errors.push('lines must contain at least one line');
        if (rawLines.length > MAX_LINES) errors.push(`lines is limited to ${MAX_LINES}`);

        const merged = new Map();
        rawLines.forEach((line, i) => {
            const sku = text(line && line.sku);
            const quantity = Number(line && line.quantity);
            const rate = line && line.rate !== undefined && line.rate !== null ? Number(line.rate) : null;

            if (!sku) errors.push(`lines[${i}].sku is required`);
            if (!(quantity > 0)) errors.push(`lines[${i}].quantity must be above zero`);
            if (rate !== null && !(rate >= 0)) errors.push(`lines[${i}].rate must be zero or more`);
            if (!sku || !(quantity > 0)) return;

            const key = `${sku.toUpperCase()}|${rate}`;
            if (merged.has(key)) merged.get(key).quantity += quantity;
            else merged.set(key, { sku, quantity, rate });
        });

        if (errors.length) return { ok: false, errors };
        return {
            ok: true,
            order: { externalId, customerExternalId, memo: text(body.memo), lines: [...merged.values()] },
        };
    };

    // ------------------------------------------------------------------
    // MAPPING
    // ------------------------------------------------------------------

    /** itemIdsBySku is keyed by upper case SKU. */
    const buildSalesOrderSpec = (order, customerId, itemIdsBySku) => {
        const missing = order.lines.map((l) => l.sku).filter((sku) => !itemIdsBySku[sku.toUpperCase()]);
        if (missing.length) throw intakeError('UNKNOWN_SKU', `No active item for SKU ${missing.join(', ')}`);

        return {
            body: { entity: customerId, externalid: order.externalId, otherrefnum: order.externalId, memo: order.memo },
            lines: order.lines.map((line) => {
                const values = { item: itemIdsBySku[line.sku.toUpperCase()], quantity: line.quantity };
                if (line.rate !== null) values.rate = line.rate;
                return values;
            }),
        };
    };

    // ------------------------------------------------------------------
    // DATA ACCESS
    // ------------------------------------------------------------------

    const firstId = (sql, params) => {
        const rows = query.runSuiteQL({ query: sql, params }).asMappedResults();
        return rows.length ? rows[0].id : null;
    };

    const findOrderId = (externalId) =>
        firstId("SELECT id FROM transaction WHERE type = 'SalesOrd' AND externalid = ?", [externalId]);

    const findCustomerId = (externalId) =>
        firstId("SELECT id FROM customer WHERE externalid = ? AND isinactive = 'F'", [externalId]);

    const findItemIds = (skus) => {
        const rows = query
            .runSuiteQL({
                query: `SELECT id, itemid FROM item WHERE isinactive = 'F'
                        AND UPPER(itemid) IN (${skus.map(() => '?').join(', ')})`,
                params: skus.map((sku) => sku.toUpperCase()),
            })
            .asMappedResults();
        return Object.fromEntries(rows.map((row) => [String(row.itemid).toUpperCase(), row.id]));
    };

    const saveSalesOrder = (spec) => {
        const order = record.create({ type: record.Type.SALES_ORDER });
        Object.entries(spec.body).forEach(([fieldId, value]) => {
            if (value !== '' && value !== null) order.setValue({ fieldId, value });
        });
        spec.lines.forEach((values, line) => {
            Object.entries(values).forEach(([fieldId, value]) => {
                order.setSublistValue({ sublistId: 'item', fieldId, line, value });
            });
        });
        return order.save({ enableSourcing: true });
    };

    // ------------------------------------------------------------------
    // ORCHESTRATION
    // ------------------------------------------------------------------

    /** Returns { status: 'created' | 'duplicate', orderId }. */
    const processOrder = (order) => {
        const existing = findOrderId(order.externalId);
        if (existing) return { status: 'duplicate', orderId: existing };

        const customerId = findCustomerId(order.customerExternalId);
        if (!customerId) throw intakeError('UNKNOWN_CUSTOMER', `No customer with external id ${order.customerExternalId}`);

        const spec = buildSalesOrderSpec(order, customerId, findItemIds(order.lines.map((l) => l.sku)));
        try {
            return { status: 'created', orderId: saveSalesOrder(spec) };
        } catch (error) {
            // Two requests for one order can race: the loser fails on the
            // duplicate External ID and the winner's order is the answer.
            const raced = findOrderId(order.externalId);
            if (raced) return { status: 'duplicate', orderId: raced };
            throw error;
        }
    };

    return { validateOrder, buildSalesOrderSpec, findOrderId, processOrder };
});

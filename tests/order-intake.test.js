'use strict';

const { loadAmd, queryMock } = require('./amd');

const LIB = 'src/FileCabinet/SuiteScripts/DA/OrderIntake/DA_LIB_Order_Intake.js';
const RESTLET = 'src/FileCabinet/SuiteScripts/DA/OrderIntake/DA_RL_Order_Intake.js';

const validOrder = () => ({
    externalId: 'WEB-1001',
    customerExternalId: 'CUST-9',
    lines: [
        { sku: 'sku-1', quantity: 2, rate: 10 },
        { sku: 'SKU-1', quantity: 3, rate: 10 },
        { sku: 'SKU-2', quantity: 1 },
    ],
});

const recordMock = (saveResult) => {
    const order = { setValue: jest.fn(), setSublistValue: jest.fn(), save: jest.fn(saveResult) };
    return { order, module: { Type: { SALES_ORDER: 'salesorder' }, create: jest.fn(() => order) } };
};

// Answers like the account would: one customer, two items, and the
// order table driven by the test.
const accountQuery = (orderIds) =>
    queryMock((sql) => {
        if (sql.includes('FROM transaction')) {
            const id = orderIds.shift();
            return id ? [{ id }] : [];
        }
        if (sql.includes('FROM customer')) return [{ id: 77 }];
        if (sql.includes('FROM item')) return [{ id: 501, itemid: 'SKU-1' }, { id: 502, itemid: 'sku-2' }];
        return [];
    });

describe('validateOrder', () => {
    const lib = loadAmd(LIB, { 'N/query': queryMock(() => []), 'N/record': {} });

    test('rejects an order with every problem listed', () => {
        const result = lib.validateOrder({ lines: [{ sku: '', quantity: 0, rate: -1 }] });
        expect(result.ok).toBe(false);
        expect(result.errors).toEqual([
            'externalId is required',
            'customerExternalId is required',
            'lines[0].sku is required',
            'lines[0].quantity must be above zero',
            'lines[0].rate must be zero or more',
        ]);
    });

    test('merges lines for the same SKU and price, ignoring case', () => {
        const result = lib.validateOrder(validOrder());
        expect(result.ok).toBe(true);
        expect(result.order.lines).toEqual([
            { sku: 'sku-1', quantity: 5, rate: 10 },
            { sku: 'SKU-2', quantity: 1, rate: null },
        ]);
    });

    test('rejects a payload that is not an object', () => {
        expect(lib.validateOrder(null).ok).toBe(false);
    });
});

describe('buildSalesOrderSpec', () => {
    const lib = loadAmd(LIB, { 'N/query': queryMock(() => []), 'N/record': {} });
    const order = lib.validateOrder(validOrder()).order;

    test('maps body and lines, leaving rate to the price level when not sent', () => {
        const spec = lib.buildSalesOrderSpec(order, 77, { 'SKU-1': 501, 'SKU-2': 502 });
        expect(spec.body).toMatchObject({ entity: 77, externalid: 'WEB-1001' });
        expect(spec.lines).toEqual([
            { item: 501, quantity: 5, rate: 10 },
            { item: 502, quantity: 1 },
        ]);
    });

    test('names every SKU that has no active item', () => {
        expect(() => lib.buildSalesOrderSpec(order, 77, { 'SKU-1': 501 })).toThrow('No active item for SKU SKU-2');
    });
});

describe('processOrder', () => {
    const order = () => loadAmd(LIB, { 'N/query': queryMock(() => []), 'N/record': {} }).validateOrder(validOrder()).order;

    test('returns the existing order instead of creating a second one', () => {
        const rec = recordMock(() => 900);
        const lib = loadAmd(LIB, { 'N/query': accountQuery([321]), 'N/record': rec.module });
        expect(lib.processOrder(order())).toEqual({ status: 'duplicate', orderId: 321 });
        expect(rec.module.create).not.toHaveBeenCalled();
    });

    test('creates the order with its lines', () => {
        const rec = recordMock(() => 900);
        const lib = loadAmd(LIB, { 'N/query': accountQuery([]), 'N/record': rec.module });
        expect(lib.processOrder(order())).toEqual({ status: 'created', orderId: 900 });
        expect(rec.order.setValue).toHaveBeenCalledWith({ fieldId: 'externalid', value: 'WEB-1001' });
        expect(rec.order.setSublistValue).toHaveBeenCalledWith({ sublistId: 'item', fieldId: 'item', line: 1, value: 502 });
    });

    test('a request that loses a race returns the winning order', () => {
        const rec = recordMock(() => {
            throw new Error('duplicate external id');
        });
        const lib = loadAmd(LIB, { 'N/query': accountQuery([null, 654]), 'N/record': rec.module });
        expect(lib.processOrder(order())).toEqual({ status: 'duplicate', orderId: 654 });
    });
});

describe('RESTlet', () => {
    const log = { audit: jest.fn(), error: jest.fn() };

    test('POST answers rejected with the reasons, without touching records', () => {
        const rec = recordMock(() => 1);
        const restlet = loadAmd(RESTLET, { 'N/log': log, 'N/query': accountQuery([]), 'N/record': rec.module });
        expect(restlet.post({ externalId: 'X' })).toMatchObject({ status: 'rejected' });
        expect(rec.module.create).not.toHaveBeenCalled();
    });

    test('POST reports a failure as JSON rather than throwing', () => {
        const rec = recordMock(() => {
            throw Object.assign(new Error('Record has been changed'), { name: 'RCRD_HAS_BEEN_CHANGED' });
        });
        const restlet = loadAmd(RESTLET, { 'N/log': log, 'N/query': accountQuery([]), 'N/record': rec.module });
        expect(restlet.post(validOrder())).toMatchObject({ status: 'failed', error: 'RCRD_HAS_BEEN_CHANGED' });
    });

    test('GET reports an order that has arrived', () => {
        const restlet = loadAmd(RESTLET, { 'N/log': log, 'N/query': accountQuery([42]), 'N/record': {} });
        expect(restlet.get({ externalId: 'WEB-1001' })).toEqual({ status: 'created', externalId: 'WEB-1001', orderId: 42 });
    });
});

'use strict';

const { loadAmd } = require('./amd');

const DIR = 'src/FileCabinet/SuiteScripts/DA';

describe('Customer tier', () => {
    const mr = loadAmd(`${DIR}/CustomerTier/DA_MR_Customer_Tier.js`);

    test.each([
        [750000, 'Platinum'],
        [100000, 'Gold'],
        [99999.99, 'Silver'],
        [0, 'Bronze'],
        [-250, 'Bronze'],
    ])('%d in net sales is %s', (sales, tier) => {
        expect(mr.tierFor(sales)).toBe(tier);
    });

    test('writes a customer only when the tier changes', () => {
        const record = { Type: { CUSTOMER: 'customer' }, submitFields: jest.fn() };
        const search = { Type: { CUSTOMER: 'customer' }, lookupFields: jest.fn(() => ({ custentity_da_sales_tier: 'Gold' })) };
        const job = loadAmd(`${DIR}/CustomerTier/DA_MR_Customer_Tier.js`, { 'N/record': record, 'N/search': search });
        const write = jest.fn();

        job.map({ value: JSON.stringify({ values: [5, '150000'] }), write });
        expect(record.submitFields).not.toHaveBeenCalled();

        job.map({ value: JSON.stringify({ values: [6, '600000'] }), write });
        expect(record.submitFields).toHaveBeenCalledWith({
            type: 'customer',
            id: 6,
            values: { custentity_da_sales_tier: 'Platinum' },
        });
        expect(write).toHaveBeenCalledWith({ key: 'Platinum', value: 6 });
    });
});

describe('Approval level', () => {
    const matrix = JSON.stringify({ default: [5000, 25000, 100000], 12: [2000, 10000, 50000] });
    const action = (fields) => {
        const runtime = { getCurrentScript: () => ({ getParameter: () => matrix }) };
        const wa = loadAmd(`${DIR}/ApprovalRouting/DA_WA_Approval_Level.js`, { 'N/runtime': runtime });
        return wa.onAction({ newRecord: { getValue: ({ fieldId }) => fields[fieldId] } });
    };

    test('uses the default thresholds for an unlisted department', () => {
        expect(action({ department: 3, total: 4999 })).toBe(0);
        expect(action({ department: 3, total: 25000 })).toBe(2);
    });

    test('uses the department row when there is one', () => {
        expect(action({ department: 12, total: 25000 })).toBe(2);
        expect(action({ department: 12, total: 60000 })).toBe(3);
    });
});

describe('Margin guard', () => {
    const run = (rate, floor, confirmAnswer) => {
        global.window = { confirm: jest.fn(() => confirmAnswer) };
        const search = { Type: { ITEM: 'item' }, lookupFields: jest.fn(() => ({ averagecost: '80', cost: '90' })) };
        const runtime = { getCurrentScript: () => ({ getParameter: () => String(floor) }) };
        const cs = loadAmd(`${DIR}/MarginGuard/DA_CS_Margin_Guard.js`, { 'N/search': search, 'N/runtime': runtime });
        const line = { item: 7, rate };
        const result = cs.validateLine({
            sublistId: 'item',
            currentRecord: { getCurrentSublistValue: ({ fieldId }) => line[fieldId] },
        });
        return { result, confirm: global.window.confirm };
    };

    afterEach(() => {
        delete global.window;
    });

    test('lets a line at or above the minimum margin through silently', () => {
        const { result, confirm } = run(100, 20, false);
        expect(result).toBe(true);
        expect(confirm).not.toHaveBeenCalled();
    });

    test('asks before committing a line below the minimum, quoting the floor rate', () => {
        const { result, confirm } = run(95, 20, false);
        expect(result).toBe(false);
        expect(confirm.mock.calls[0][0]).toMatch('The lowest rate at the minimum is 100.00');
    });
});

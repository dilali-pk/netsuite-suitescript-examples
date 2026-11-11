'use strict';

const { loadAmd, queryMock } = require('./amd');

const LIB = 'src/FileCabinet/SuiteScripts/DA/CreditReview/DA_LIB_Credit_Review.js';
const UE = 'src/FileCabinet/SuiteScripts/DA/CreditReview/DA_UE_Credit_Review.js';

const base = {
    creditLimit: 10000,
    balance: 4000,
    overdueBalance: 0,
    daysOverdue: 0,
    openOrders: 3000,
    orderTotal: 2000,
    graceDays: 15,
    tolerancePct: 5,
};

describe('evaluate', () => {
    const { evaluate } = loadAmd(LIB, { 'N/query': queryMock(() => []) });

    test('clears a customer within limit and terms', () => {
        expect(evaluate(base)).toEqual({ hold: false, reasons: [], exposure: 9000, headroom: 1000 });
    });

    test('counts unbilled open orders toward exposure', () => {
        const result = evaluate({ ...base, openOrders: 6000 });
        expect(result.hold).toBe(true);
        expect(result.exposure).toBe(12000);
        expect(result.reasons[0]).toMatch('over the credit limit');
    });

    test('tolerates the configured band over the limit', () => {
        expect(evaluate({ ...base, orderTotal: 3500 }).hold).toBe(false);
        expect(evaluate({ ...base, orderTotal: 3600 }).hold).toBe(true);
    });

    test('holds for overdue age past the grace period, even with no limit', () => {
        const result = evaluate({ ...base, creditLimit: 0, overdueBalance: 800, daysOverdue: 40 });
        expect(result).toMatchObject({ hold: true, headroom: null });
        expect(result.reasons).toHaveLength(1);
        expect(result.reasons[0]).toMatch('oldest 40 days');
    });
});

describe('beforeSubmit', () => {
    const setup = (type) => {
        const values = { entity: 77, total: 9000 };
        const newRecord = { id: null, getValue: ({ fieldId }) => values[fieldId], setValue: jest.fn() };
        const query = queryMock((sql) =>
            sql.includes('FROM customer')
                ? [{ creditlimit: 10000, balance: 4000, overdue: 0, daysoverdue: 0 }]
                : [{ amount: 0 }]
        );
        const runtime = { getCurrentScript: () => ({ getParameter: () => '0' }) };
        const ue = loadAmd(UE, { 'N/query': query, 'N/runtime': runtime, 'N/log': { audit: jest.fn() } });
        ue.beforeSubmit({ type, newRecord, UserEventType: { CREATE: 'create', EDIT: 'edit' } });
        return newRecord.setValue;
    };

    test('a new order over the limit goes to Pending Approval with its reason', () => {
        const setValue = setup('create');
        expect(setValue).toHaveBeenCalledWith({ fieldId: 'orderstatus', value: 'A' });
        expect(setValue.mock.calls[0][0].value).toMatch('over the credit limit');
    });

    test('an edit refreshes the reason but never changes the status', () => {
        const setValue = setup('edit');
        expect(setValue).not.toHaveBeenCalledWith(expect.objectContaining({ fieldId: 'orderstatus' }));
        expect(setValue).toHaveBeenCalledWith(expect.objectContaining({ fieldId: 'custbody_da_credit_review_reason' }));
    });
});

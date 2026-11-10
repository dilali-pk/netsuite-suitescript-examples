/**
 * Customer credit alert (Sales Order).
 *
 * - Shows a banner when the selected customer has an overdue balance.
 * - Asks for confirmation on save when the order would push the customer
 *   over their credit limit.
 *
 * Deploy on: Sales Order. No parameters.
 *
 * @NApiVersion 2.1
 * @NScriptType ClientScript
 * @NModuleScope SameAccount
 */
define(['N/search', 'N/ui/message'], (search, message) => {
    let banner = null;

    const toNumber = (value) => Number(value) || 0;

    const getCustomerCredit = (customerId) => {
        if (!customerId) return null;
        const fields = search.lookupFields({
            type: search.Type.CUSTOMER,
            id: customerId,
            columns: ['balance', 'overduebalance', 'creditlimit'],
        });
        return {
            balance: toNumber(fields.balance),
            overdue: toNumber(fields.overduebalance),
            creditLimit: toNumber(fields.creditlimit),
        };
    };

    const refreshBanner = (rec) => {
        if (banner) {
            banner.hide();
            banner = null;
        }
        const credit = getCustomerCredit(rec.getValue({ fieldId: 'entity' }));
        if (!credit || credit.overdue <= 0) return;

        banner = message.create({
            type: message.Type.WARNING,
            title: 'Customer has an overdue balance',
            message: `Overdue: ${credit.overdue.toFixed(2)}. Total open balance: ${credit.balance.toFixed(2)}.`,
        });
        banner.show();
    };

    const pageInit = (context) => {
        refreshBanner(context.currentRecord);
    };

    const fieldChanged = (context) => {
        if (context.fieldId === 'entity') {
            refreshBanner(context.currentRecord);
        }
    };

    const saveRecord = (context) => {
        const rec = context.currentRecord;
        const credit = getCustomerCredit(rec.getValue({ fieldId: 'entity' }));
        if (!credit || credit.creditLimit <= 0) return true;

        const orderTotal = toNumber(rec.getValue({ fieldId: 'total' }));
        const exposure = credit.balance + orderTotal;
        if (exposure <= credit.creditLimit) return true;

        return window.confirm(
            `This order takes the customer to ${exposure.toFixed(2)}, ` +
                `above their credit limit of ${credit.creditLimit.toFixed(2)}.\n\nSave anyway?`
        );
    };

    return { pageInit, fieldChanged, saveRecord };
});

/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 * @NModuleScope SameAccount
 *
 * Name:        DA Credit Review
 * Record:      Sales Order
 * Purpose:     Routes a new sales order to Pending Approval, with the reason
 *              written on the order, when the customer's exposure or overdue
 *              age crosses the limits finance has set. Finance releases it
 *              through the standard approval, so there is no custom button,
 *              page or status to maintain.
 * Events:      beforeSubmit on create and edit. On edit the reason is kept
 *              current but the status is left alone, so an approved order is
 *              never pulled back by a later change.
 * Parameters:  custscript_da_cr_grace_days   days overdue tolerated
 *              custscript_da_cr_tolerance    percent over limit tolerated
 * Requires:    Sales order approval switched on in Accounting Preferences.
 * @author      Dilshad Ali
 */
define(['N/runtime', 'N/log', './DA_LIB_Credit_Review'], (runtime, log, credit) => {

    const PENDING_APPROVAL = 'A';
    const REASON_FIELD = 'custbody_da_credit_review_reason';

    const beforeSubmit = (context) => {
        const { CREATE, EDIT } = context.UserEventType;
        if (context.type !== CREATE && context.type !== EDIT) return;

        const order = context.newRecord;
        const customerId = order.getValue({ fieldId: 'entity' });
        if (!customerId) return;

        const script = runtime.getCurrentScript();
        const result = credit.evaluate({
            ...credit.loadCustomerCredit(customerId),
            openOrders: credit.loadOpenOrderTotal(customerId, order.id),
            orderTotal: Number(order.getValue({ fieldId: 'total' })) || 0,
            graceDays: Number(script.getParameter({ name: 'custscript_da_cr_grace_days' })) || 0,
            tolerancePct: Number(script.getParameter({ name: 'custscript_da_cr_tolerance' })) || 0,
        });

        order.setValue({ fieldId: REASON_FIELD, value: result.reasons.join('\n') });

        if (result.hold && context.type === CREATE) {
            order.setValue({ fieldId: 'orderstatus', value: PENDING_APPROVAL });
            log.audit({
                title: `Order held for credit review: customer ${customerId}`,
                details: result.reasons.join(' | '),
            });
        }
    };

    return { beforeSubmit };
});

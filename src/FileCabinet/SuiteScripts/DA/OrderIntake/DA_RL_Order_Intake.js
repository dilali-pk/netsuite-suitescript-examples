/**
 * @NApiVersion 2.1
 * @NScriptType Restlet
 * @NModuleScope SameAccount
 *
 * Name:        DA Order Intake
 * Purpose:     One endpoint for outside channels (web stores, marketplaces,
 *              partner systems) to send sales orders.
 * Methods:     POST  creates the order, or returns the one already created.
 *              GET   ?externalId=  says whether an order has arrived.
 * Responses:   Always JSON with a status of created, duplicate, rejected,
 *              failed or unknown, so the caller never parses an error page.
 * Auth:        Token Based Authentication on an integration role.
 * @author      Dilshad Ali
 */
define(['N/log', './DA_LIB_Order_Intake'], (log, intake) => {

    const post = (payload) => {
        const checked = intake.validateOrder(typeof payload === 'string' ? JSON.parse(payload) : payload);
        if (!checked.ok) return { status: 'rejected', errors: checked.errors };

        const { externalId } = checked.order;
        try {
            const result = intake.processOrder(checked.order);
            log.audit({ title: `Order ${result.status}`, details: `${externalId} -> ${result.orderId}` });
            return { status: result.status, externalId, orderId: Number(result.orderId) };
        } catch (error) {
            log.error({ title: `Order ${externalId} failed`, details: error });
            return { status: 'failed', externalId, error: error.name, message: error.message };
        }
    };

    const get = (params) => {
        const externalId = String((params && params.externalId) || '').trim();
        if (!externalId) return { status: 'rejected', errors: ['externalId is required'] };

        const orderId = intake.findOrderId(externalId);
        return orderId ? { status: 'created', externalId, orderId: Number(orderId) } : { status: 'unknown', externalId };
    };

    return { post, get };
});

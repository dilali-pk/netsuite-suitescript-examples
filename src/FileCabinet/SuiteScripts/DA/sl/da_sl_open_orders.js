/**
 * Open Sales Orders page.
 *
 * A simple internal page: pick a customer (optional), press Search,
 * and see the Sales Orders that are still open, with a link to each one.
 *
 * No parameters.
 *
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @NModuleScope SameAccount
 */
define(['N/ui/serverWidget', 'N/search', 'N/url'], (serverWidget, search, url) => {
    const MAX_ROWS = 200;

    // Pending Fulfillment, Partially Fulfilled, Pending Billing/Partially Fulfilled
    const OPEN_STATUSES = ['SalesOrd:B', 'SalesOrd:D', 'SalesOrd:E'];

    const findOpenOrders = (customerId) => {
        const filters = [['mainline', 'is', 'T'], 'and', ['status', 'anyof', OPEN_STATUSES]];
        if (customerId) {
            filters.push('and', ['entity', 'anyof', customerId]);
        }
        return search
            .create({
                type: search.Type.SALES_ORDER,
                filters,
                columns: [
                    search.createColumn({ name: 'trandate', sort: search.Sort.ASC }),
                    'tranid',
                    'entity',
                    'status',
                    'total',
                ],
            })
            .run()
            .getRange({ start: 0, end: MAX_ROWS });
    };

    const onRequest = (context) => {
        const { request, response } = context;
        const customerId = request.parameters.custpage_customer || '';

        const form = serverWidget.createForm({ title: 'Open Sales Orders' });

        const customerField = form.addField({
            id: 'custpage_customer',
            type: serverWidget.FieldType.SELECT,
            label: 'Customer',
            source: 'customer',
        });
        customerField.defaultValue = customerId;
        form.addSubmitButton({ label: 'Search' });

        const sublist = form.addSublist({
            id: 'custpage_orders',
            type: serverWidget.SublistType.LIST,
            label: 'Orders',
        });
        sublist.addField({ id: 'custpage_link', type: serverWidget.FieldType.URL, label: 'Open' }).linkText = 'View';
        sublist.addField({ id: 'custpage_tranid', type: serverWidget.FieldType.TEXT, label: 'Order #' });
        sublist.addField({ id: 'custpage_date', type: serverWidget.FieldType.TEXT, label: 'Date' });
        sublist.addField({ id: 'custpage_entity', type: serverWidget.FieldType.TEXT, label: 'Customer' });
        sublist.addField({ id: 'custpage_status', type: serverWidget.FieldType.TEXT, label: 'Status' });
        sublist.addField({ id: 'custpage_total', type: serverWidget.FieldType.CURRENCY, label: 'Total' });

        // Sublist values must be non-empty strings, so blanks are skipped.
        const setValue = (id, line, value) => {
            if (value === null || value === undefined || value === '') return;
            sublist.setSublistValue({ id, line, value: String(value) });
        };

        const orders = findOpenOrders(customerId);
        orders.forEach((order, line) => {
            setValue(
                'custpage_link',
                line,
                url.resolveRecord({ recordType: search.Type.SALES_ORDER, recordId: order.id })
            );
            setValue('custpage_tranid', line, order.getValue('tranid'));
            setValue('custpage_date', line, order.getValue('trandate'));
            setValue('custpage_entity', line, order.getText('entity'));
            setValue('custpage_status', line, order.getText('status'));
            setValue('custpage_total', line, order.getValue('total'));
        });

        sublist.label = `Orders (${orders.length}${orders.length === MAX_ROWS ? '+' : ''})`;
        response.writePage(form);
    };

    return { onRequest };
});

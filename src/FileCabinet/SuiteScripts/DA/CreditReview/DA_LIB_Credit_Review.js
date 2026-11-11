/**
 * @NApiVersion 2.1
 * @NModuleScope SameAccount
 *
 * Name:        DA Credit Review Library
 * Purpose:     Decides whether a sales order needs finance review before it
 *              is released, using the customer's full exposure: the open
 *              receivable, every unbilled open order, and this order.
 * Why:         The native credit limit preference warns or blocks at entry.
 *              Here sales keeps entering orders, and the risky ones wait in
 *              the native approval queue with a written reason, judged on
 *              the full exposure and a tolerance band finance sets. The
 *              native preference stays on underneath.
 * @author      Dilshad Ali
 */
define(['N/query'], (query) => {

    // ------------------------------------------------------------------
    // RULES
    // ------------------------------------------------------------------

    const round2 = (value) => Math.round((Number(value) || 0) * 100) / 100;

    /**
     * Pure decision. All amounts are in the customer's currency.
     *
     * @param {object} input
     * @param {number} input.creditLimit     0 or empty means no limit set
     * @param {number} input.balance         open receivable
     * @param {number} input.overdueBalance  part of the balance past due
     * @param {number} input.daysOverdue     oldest overdue invoice, in days
     * @param {number} input.openOrders      unbilled open sales orders, excluding this one
     * @param {number} input.orderTotal      this order
     * @param {number} input.graceDays       days overdue tolerated before review
     * @param {number} input.tolerancePct    percent over the limit tolerated
     */
    const evaluate = (input) => {
        const creditLimit = round2(input.creditLimit);
        const exposure = round2(input.balance + input.openOrders + input.orderTotal);
        const ceiling = round2(creditLimit * (1 + (Number(input.tolerancePct) || 0) / 100));
        const reasons = [];

        if (creditLimit > 0 && exposure > ceiling) {
            reasons.push(`Exposure ${exposure.toFixed(2)} is over the credit limit of ${creditLimit.toFixed(2)}`);
        }
        if (round2(input.overdueBalance) > 0 && Number(input.daysOverdue) > Number(input.graceDays)) {
            reasons.push(
                `${round2(input.overdueBalance).toFixed(2)} overdue, oldest ${input.daysOverdue} days ` +
                    `against a grace period of ${input.graceDays}`
            );
        }

        return {
            hold: reasons.length > 0,
            reasons,
            exposure,
            headroom: creditLimit > 0 ? round2(creditLimit - exposure) : null,
        };
    };

    // ------------------------------------------------------------------
    // DATA ACCESS
    // ------------------------------------------------------------------

    // Pending Fulfillment, Partially Fulfilled, Pending Billing and
    // Pending Billing/Partially Fulfilled: ordered but not yet invoiced.
    const UNBILLED_STATUSES = ['B', 'D', 'E', 'F'];

    const loadCustomerCredit = (customerId) => {
        const rows = query
            .runSuiteQL({
                query: `SELECT creditlimit, balancesearch AS balance, overduebalancesearch AS overdue,
                               daysoverduesearch AS daysoverdue
                        FROM customer WHERE id = ?`,
                params: [customerId],
            })
            .asMappedResults();
        const row = rows[0] || {};
        return {
            creditLimit: Number(row.creditlimit) || 0,
            balance: Number(row.balance) || 0,
            overdueBalance: Number(row.overdue) || 0,
            daysOverdue: Number(row.daysoverdue) || 0,
        };
    };

    const loadOpenOrderTotal = (customerId, excludeOrderId) => {
        const placeholders = UNBILLED_STATUSES.map(() => '?').join(', ');
        const rows = query
            .runSuiteQL({
                query: `SELECT NVL(SUM(foreigntotal), 0) AS amount FROM transaction
                        WHERE type = 'SalesOrd' AND entity = ? AND id <> ? AND status IN (${placeholders})`,
                params: [customerId, excludeOrderId || -1].concat(UNBILLED_STATUSES),
            })
            .asMappedResults();
        return Number(rows[0] && rows[0].amount) || 0;
    };

    return { evaluate, loadCustomerCredit, loadOpenOrderTotal };
});

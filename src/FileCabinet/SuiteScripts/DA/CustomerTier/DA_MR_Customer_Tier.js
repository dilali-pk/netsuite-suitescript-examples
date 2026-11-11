/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 * @NModuleScope SameAccount
 *
 * Name:        DA Customer Tier
 * Purpose:     Sets each customer's sales tier from their trailing twelve
 *              month net sales, so pricing, service levels and reports can
 *              key off one maintained field.
 * Schedule:    Monthly.
 * Design:      Sales are summed in SuiteQL, not in a reduce stage: the
 *              database aggregates far faster than script can, and the map
 *              stage gets one row per customer. A customer is only written
 *              when the tier actually changes, which keeps the run cheap and
 *              the system notes meaningful.
 * Field:       custentity_da_sales_tier (free form text)
 * @author      Dilshad Ali
 */
define(['N/record', 'N/search', 'N/log'], (record, search, log) => {

    const TIER_FIELD = 'custentity_da_sales_tier';

    // Ordered highest first; the first tier the amount reaches wins.
    const TIERS = [
        { name: 'Platinum', min: 500000 },
        { name: 'Gold', min: 100000 },
        { name: 'Silver', min: 25000 },
        { name: 'Bronze', min: 0 },
    ];

    const tierFor = (netSales) => (TIERS.find((tier) => netSales >= tier.min) || TIERS[TIERS.length - 1]).name;

    const getInputData = () => ({
        type: 'suiteql',
        query: `SELECT t.entity AS customer, SUM(-tl.netamount) AS net_sales
                FROM transaction t JOIN transactionline tl ON tl.transaction = t.id
                WHERE t.type IN ('CustInvc', 'CashSale', 'CustCred')
                  AND tl.mainline = 'F' AND tl.taxline = 'F' AND tl.item IS NOT NULL
                  AND t.trandate >= ADD_MONTHS(TRUNC(SYSDATE), -12)
                GROUP BY t.entity`,
    });

    const map = (context) => {
        const [customerId, netSales] = JSON.parse(context.value).values;
        const tier = tierFor(Number(netSales) || 0);

        const current = search.lookupFields({ type: search.Type.CUSTOMER, id: customerId, columns: [TIER_FIELD] });
        if (current[TIER_FIELD] === tier) return;

        record.submitFields({ type: record.Type.CUSTOMER, id: customerId, values: { [TIER_FIELD]: tier } });
        context.write({ key: tier, value: customerId });
    };

    const summarize = (summary) => {
        const moved = {};
        summary.output.iterator().each((tier) => {
            moved[tier] = (moved[tier] || 0) + 1;
            return true;
        });
        summary.mapSummary.errors.iterator().each((key, error) => {
            log.error({ title: `Customer ${key} not updated`, details: error });
            return true;
        });
        log.audit({ title: 'Tier changes', details: JSON.stringify(moved) });
    };

    return { getInputData, map, summarize, tierFor };
});

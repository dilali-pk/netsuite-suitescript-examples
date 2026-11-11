/**
 * @NApiVersion 2.1
 * @NScriptType ClientScript
 * @NModuleScope SameAccount
 *
 * Name:        DA Margin Guard
 * Record:      Sales Order, Estimate
 * Purpose:     Stops a line from being committed below the minimum margin
 *              unless the rep confirms it, and says by how much.
 * Cost basis:  Item average cost, falling back to purchase price. Cached per
 *              item for the session, so each item costs one lookup.
 * Parameter:   custscript_da_mg_min_margin   minimum margin percent
 * @author      Dilshad Ali
 */
define(['N/search', 'N/runtime'], (search, runtime) => {

    const costCache = {};

    const itemCost = (itemId) => {
        if (!(itemId in costCache)) {
            const fields = search.lookupFields({ type: search.Type.ITEM, id: itemId, columns: ['averagecost', 'cost'] });
            costCache[itemId] = Number(fields.averagecost) || Number(fields.cost) || 0;
        }
        return costCache[itemId];
    };

    const marginPct = (rate, cost) => (rate > 0 ? ((rate - cost) / rate) * 100 : -100);

    const validateLine = (context) => {
        if (context.sublistId !== 'item') return true;
        const rec = context.currentRecord;

        const itemId = rec.getCurrentSublistValue({ sublistId: 'item', fieldId: 'item' });
        const rate = Number(rec.getCurrentSublistValue({ sublistId: 'item', fieldId: 'rate' })) || 0;
        if (!itemId) return true;

        const cost = itemCost(itemId);
        if (!cost) return true;

        const floor = Number(runtime.getCurrentScript().getParameter({ name: 'custscript_da_mg_min_margin' })) || 0;
        const margin = marginPct(rate, cost);
        if (margin >= floor) return true;

        const floorRate = cost / (1 - floor / 100);
        return window.confirm(
            `Margin on this line is ${margin.toFixed(1)}%, below the ${floor}% minimum.\n` +
                `The lowest rate at the minimum is ${floorRate.toFixed(2)}.\n\nKeep this price?`
        );
    };

    return { validateLine };
});

/**
 * @NApiVersion 2.1
 * @NScriptType WorkflowActionScript
 * @NModuleScope SameAccount
 *
 * Name:        DA Approval Level
 * Record:      Purchase Order (any transaction with a total and department)
 * Purpose:     Returns how many approval levels a transaction needs, from a
 *              matrix finance maintains as a script parameter. The approval
 *              workflow branches on the number, so the routing stays in
 *              SuiteFlow where admins can see and change it, and only the
 *              matrix lookup lives in code.
 * Parameter:   custscript_da_al_matrix   JSON, for example
 *              {"default":[5000,25000,100000],"12":[2000,10000,50000]}
 *              Keys are department ids; each list holds the totals at which
 *              level 1, 2 and 3 approval start.
 * Returns:     0 to 3 into a workflow field.
 * @author      Dilshad Ali
 */
define(['N/runtime'], (runtime) => {

    const levelFor = (total, thresholds) => thresholds.filter((limit) => total >= limit).length;

    const onAction = (context) => {
        const rec = context.newRecord;
        const matrix = JSON.parse(runtime.getCurrentScript().getParameter({ name: 'custscript_da_al_matrix' }) || '{}');

        const department = String(rec.getValue({ fieldId: 'department' }) || '');
        const thresholds = matrix[department] || matrix.default || [];
        const total = Math.abs(Number(rec.getValue({ fieldId: 'total' })) || 0);

        // Never save the record here: the workflow owns the save.
        return levelFor(total, thresholds);
    };

    return { onAction, levelFor };
});

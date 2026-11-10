/**
 * Saved search emailer.
 *
 * Runs a saved search on a schedule and emails the results as a CSV attachment.
 * Useful for daily or weekly reports to people who do not log in to NetSuite.
 *
 * Script parameters:
 *   custscript_da_report_search     (List/Record: Saved Search)  search to run, required
 *   custscript_da_report_author     (List/Record: Employee)      sender, required
 *   custscript_da_report_recipients (Free-Form Text)             comma-separated emails, required
 *
 * @NApiVersion 2.1
 * @NScriptType ScheduledScript
 * @NModuleScope SameAccount
 */
define(['N/search', 'N/file', 'N/email', 'N/runtime', 'N/log'], (search, file, email, runtime, log) => {
    const MAX_ROWS = 5000;
    const MIN_USAGE = 200;

    const csvCell = (value) => {
        const text = value === null || value === undefined ? '' : String(value);
        return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    };

    const execute = () => {
        const script = runtime.getCurrentScript();
        const searchId = script.getParameter({ name: 'custscript_da_report_search' });
        const author = script.getParameter({ name: 'custscript_da_report_author' });
        const recipients = String(script.getParameter({ name: 'custscript_da_report_recipients' }) || '')
            .split(',')
            .map((address) => address.trim())
            .filter(Boolean);

        if (!searchId || !author || recipients.length === 0) {
            log.error({ title: 'Missing parameters', details: 'Search, author and recipients are all required.' });
            return;
        }

        const savedSearch = search.load({ id: searchId });
        const columns = savedSearch.columns;
        const lines = [columns.map((column) => csvCell(column.label || column.name)).join(',')];

        let rowCount = 0;
        let truncated = false;
        const paged = savedSearch.runPaged({ pageSize: 1000 });

        for (const range of paged.pageRanges) {
            if (rowCount >= MAX_ROWS || script.getRemainingUsage() < MIN_USAGE) {
                truncated = true;
                break;
            }
            const page = paged.fetch({ index: range.index });
            for (const result of page.data) {
                if (rowCount >= MAX_ROWS) {
                    truncated = true;
                    break;
                }
                lines.push(columns.map((column) => csvCell(result.getText(column) || result.getValue(column))).join(','));
                rowCount += 1;
            }
        }

        const title = savedSearch.title || `Saved search ${searchId}`;
        const attachment = file.create({
            name: `${title.replace(/[^\w\- ]+/g, '').trim() || 'report'}.csv`,
            fileType: file.Type.CSV,
            contents: lines.join('\n'),
        });

        email.send({
            author: Number(author),
            recipients,
            subject: `${title}: ${rowCount} row${rowCount === 1 ? '' : 's'}`,
            body:
                `Attached are the latest results for "${title}".` +
                (truncated ? `<br><br>Note: the report was cut off at ${rowCount} rows.` : ''),
            attachments: [attachment],
        });

        log.audit({ title: 'Report sent', details: `${title}: ${rowCount} rows to ${recipients.join(', ')}` });
    };

    return { execute };
});

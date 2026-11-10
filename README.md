# NetSuite SuiteScript Examples

Working examples of the kind of NetSuite customization I build for clients: SuiteScript 2.1 scripts and Advanced PDF/HTML templates. Organized as a SuiteCloud (SDF) project.

**Dilshad Ali** · Certified NetSuite Developer · Islamabad, Pakistan
[Upwork profile](https://www.upwork.com/freelancers/~01b9fd4cc496f6fae0)

## What is included

| File | Type | What it does |
| --- | --- | --- |
| `cs/da_cs_customer_credit_alert.js` | Client Script | On a Sales Order, warns when the customer has an overdue balance and asks for confirmation when the order exceeds their credit limit |
| `sl/da_sl_open_orders.js` | Suitelet | Internal page listing open Sales Orders, filterable by customer, with a link to each order |
| `ss/da_ss_saved_search_emailer.js` | Scheduled Script | Runs a saved search on a schedule and emails the results as a CSV attachment |
| `templates/da_packing_slip.xml` | Advanced PDF/HTML | Packing slip with a scannable barcode and shaded rows |
| `templates/freemarker-snippets.md` | Reference | FreeMarker patterns used in most template work |

Script files live under `src/FileCabinet/SuiteScripts/DA/`.

## Script parameters

Only the saved search emailer needs parameters:

| ID | Type | Purpose |
| --- | --- | --- |
| `custscript_da_report_search` | List/Record (Saved Search) | The search to run |
| `custscript_da_report_author` | List/Record (Employee) | Sender of the email |
| `custscript_da_report_recipients` | Free-Form Text | Comma-separated email addresses |

## Setup

1. Install the [SuiteCloud CLI](https://www.npmjs.com/package/@oracle/suitecloud-cli): `npm install -g @oracle/suitecloud-cli`
2. Connect an account from the project root: `suitecloud account:setup`
3. Upload the files: `suitecloud project:deploy`
4. In NetSuite, create a script record and deployment for each script (Customization > Scripting > Scripts > New).
5. For the packing slip, go to Customization > Forms > Advanced PDF/HTML Templates, create a new Packing Slip template, switch to Source Code, and paste the file.

Deploy to a sandbox first and test with your own data before moving anything to production.

## What I work on

- SuiteScript 2.x: User Event, Client, Scheduled, Map/Reduce, RESTlet, Suitelet
- Advanced PDF/HTML templates: invoices, payments, purchase orders, packing slips
- SuiteCommerce Advanced: themes, extensions, storefront customization
- Integrations: SuiteTalk REST and SOAP, RESTlets, token-based authentication
- SuiteFlow workflows, saved searches, and SuiteAnalytics reporting

Oracle NetSuite certified: BI & Reporting Associate, AI Foundations Associate.

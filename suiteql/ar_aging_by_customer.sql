-- AR aging by customer, in base currency.
-- Buckets on days past due date; invoices without a due date age from
-- their transaction date. One row per customer, largest balance first.
-- Author: Dilshad Ali

SELECT
    BUILTIN.DF(t.entity) AS customer,
    SUM(CASE WHEN TRUNC(SYSDATE) - NVL(t.duedate, t.trandate) <= 0
             THEN t.foreignamountunpaid * t.exchangerate ELSE 0 END) AS current_due,
    SUM(CASE WHEN TRUNC(SYSDATE) - NVL(t.duedate, t.trandate) BETWEEN 1 AND 30
             THEN t.foreignamountunpaid * t.exchangerate ELSE 0 END) AS days_1_30,
    SUM(CASE WHEN TRUNC(SYSDATE) - NVL(t.duedate, t.trandate) BETWEEN 31 AND 60
             THEN t.foreignamountunpaid * t.exchangerate ELSE 0 END) AS days_31_60,
    SUM(CASE WHEN TRUNC(SYSDATE) - NVL(t.duedate, t.trandate) BETWEEN 61 AND 90
             THEN t.foreignamountunpaid * t.exchangerate ELSE 0 END) AS days_61_90,
    SUM(CASE WHEN TRUNC(SYSDATE) - NVL(t.duedate, t.trandate) > 90
             THEN t.foreignamountunpaid * t.exchangerate ELSE 0 END) AS over_90,
    SUM(t.foreignamountunpaid * t.exchangerate) AS total_open
FROM transaction t
WHERE t.type = 'CustInvc'
  AND t.status = 'A'
GROUP BY BUILTIN.DF(t.entity)
ORDER BY total_open DESC

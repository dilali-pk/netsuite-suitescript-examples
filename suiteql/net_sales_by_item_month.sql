-- Net sales and units by item and month, trailing twelve months.
-- Invoices and cash sales post revenue lines as negative amounts and
-- credit memos as positive, so negating the sum gives sales net of credits.
-- Author: Dilshad Ali

SELECT
    TO_CHAR(t.trandate, 'YYYY-MM') AS period,
    BUILTIN.DF(tl.item) AS item,
    SUM(-tl.quantity) AS units,
    SUM(-tl.netamount) AS net_sales
FROM transaction t
JOIN transactionline tl ON tl.transaction = t.id
WHERE t.type IN ('CustInvc', 'CashSale', 'CustCred')
  AND tl.mainline = 'F'
  AND tl.taxline = 'F'
  AND tl.item IS NOT NULL
  AND t.trandate >= ADD_MONTHS(TRUNC(SYSDATE, 'MM'), -12)
GROUP BY TO_CHAR(t.trandate, 'YYYY-MM'), BUILTIN.DF(tl.item)
ORDER BY period DESC, net_sales DESC

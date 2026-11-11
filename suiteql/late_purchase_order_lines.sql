-- Open purchase order lines past their expected receipt date, latest
-- first, with the quantity still to come.
-- Author: Dilshad Ali

SELECT
    t.tranid AS purchase_order,
    BUILTIN.DF(t.entity) AS vendor,
    BUILTIN.DF(tl.item) AS item,
    tl.expectedreceiptdate AS expected,
    TRUNC(SYSDATE) - tl.expectedreceiptdate AS days_late,
    tl.quantity - NVL(tl.quantityshiprecv, 0) AS open_quantity
FROM transaction t
JOIN transactionline tl ON tl.transaction = t.id
WHERE t.type = 'PurchOrd'
  AND tl.mainline = 'F'
  AND tl.isclosed = 'F'
  AND tl.expectedreceiptdate < TRUNC(SYSDATE)
  AND tl.quantity > NVL(tl.quantityshiprecv, 0)
ORDER BY days_late DESC

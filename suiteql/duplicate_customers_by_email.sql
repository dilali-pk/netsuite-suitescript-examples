-- Active customers sharing an email address, the usual first sign of
-- duplicate records from web store and marketplace sign ups.
-- Ordering on an aggregate directly is rejected by SuiteQL, so the
-- grouped rows are ordered from an outer query.
-- Author: Dilshad Ali

SELECT d.*
FROM (
    SELECT
        LOWER(TRIM(c.email)) AS email,
        COUNT(*) AS customers,
        MIN(c.id) AS oldest_id,
        MAX(c.id) AS newest_id
    FROM customer c
    WHERE c.email IS NOT NULL
      AND c.isinactive = 'F'
    GROUP BY LOWER(TRIM(c.email))
    HAVING COUNT(*) > 1
) d
ORDER BY d.customers DESC

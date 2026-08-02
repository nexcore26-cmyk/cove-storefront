-- Backfill existing POS/admin staff to Brass Store (branch id 1), the only
-- branch that exists today, so live POS checkout keeps working unchanged
-- now that createOrder requires an active branch.
UPDATE `users` SET `activeBranchId` = 1 WHERE `role` IN ('pos', 'admin') AND `activeBranchId` IS NULL;

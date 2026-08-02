ALTER TABLE `users` ADD COLUMN `activeBranchId` int NULL;
ALTER TABLE `orders` ADD COLUMN `branchId` int NULL;

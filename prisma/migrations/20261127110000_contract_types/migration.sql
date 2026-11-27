-- AlterTable: existing contracts become TIMELY (the original behaviour).
ALTER TABLE `Contract` ADD COLUMN `type` ENUM('TIMELY', 'MILESTONE', 'FIXED') NOT NULL DEFAULT 'TIMELY';

-- AlterTable
ALTER TABLE `ContractRate` ADD COLUMN `hours` DECIMAL(10, 2) NULL;

-- AlterTable
ALTER TABLE `ContractTask` ADD COLUMN `isMilestone` BOOLEAN NOT NULL DEFAULT false;

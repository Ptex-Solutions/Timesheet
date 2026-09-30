-- AlterTable
ALTER TABLE `Timesheet` ADD COLUMN `resourceTypeId` INTEGER NULL;

-- AddForeignKey
ALTER TABLE `Timesheet` ADD CONSTRAINT `Timesheet_resourceTypeId_fkey` FOREIGN KEY (`resourceTypeId`) REFERENCES `Master`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;


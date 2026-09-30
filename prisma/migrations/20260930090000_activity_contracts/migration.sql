-- AlterTable
ALTER TABLE `Activity` ADD COLUMN `contractId` INTEGER NULL;

-- AlterTable
ALTER TABLE `Task` ADD COLUMN `contractTaskId` INTEGER NULL;

-- CreateTable
CREATE TABLE `ActivityMember` (
    `activityId` INTEGER NOT NULL,
    `userId` INTEGER NOT NULL,
    `resourceTypeId` INTEGER NOT NULL,

    INDEX `ActivityMember_userId_idx`(`userId`),
    INDEX `ActivityMember_resourceTypeId_idx`(`resourceTypeId`),
    PRIMARY KEY (`activityId`, `userId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `Activity_contractId_idx` ON `Activity`(`contractId`);

-- CreateIndex
CREATE INDEX `Task_contractTaskId_idx` ON `Task`(`contractTaskId`);

-- CreateIndex
CREATE UNIQUE INDEX `Task_activityId_contractTaskId_key` ON `Task`(`activityId`, `contractTaskId`);

-- AddForeignKey
ALTER TABLE `Activity` ADD CONSTRAINT `Activity_contractId_fkey` FOREIGN KEY (`contractId`) REFERENCES `Contract`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ActivityMember` ADD CONSTRAINT `ActivityMember_activityId_fkey` FOREIGN KEY (`activityId`) REFERENCES `Activity`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ActivityMember` ADD CONSTRAINT `ActivityMember_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ActivityMember` ADD CONSTRAINT `ActivityMember_resourceTypeId_fkey` FOREIGN KEY (`resourceTypeId`) REFERENCES `Master`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Task` ADD CONSTRAINT `Task_contractTaskId_fkey` FOREIGN KEY (`contractTaskId`) REFERENCES `ContractTask`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;


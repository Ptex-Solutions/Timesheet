-- CreateTable
CREATE TABLE `Contract` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `clientId` INTEGER NOT NULL,
    `currencyId` INTEGER NOT NULL,
    `status` ENUM('DRAFT', 'ACTIVE', 'CLOSED') NOT NULL DEFAULT 'DRAFT',
    `activatedAt` DATETIME(3) NULL,
    `closedAt` DATETIME(3) NULL,
    `createdById` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Contract_code_key`(`code`),
    INDEX `Contract_clientId_idx`(`clientId`),
    INDEX `Contract_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ContractRate` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `contractId` INTEGER NOT NULL,
    `resourceTypeId` INTEGER NOT NULL,
    `ratePerHour` DECIMAL(12, 2) NOT NULL,

    UNIQUE INDEX `ContractRate_contractId_resourceTypeId_key`(`contractId`, `resourceTypeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ContractTask` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `contractId` INTEGER NOT NULL,
    `taskMasterId` INTEGER NOT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,

    UNIQUE INDEX `ContractTask_contractId_taskMasterId_key`(`contractId`, `taskMasterId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ContractTaskBudget` (
    `contractTaskId` INTEGER NOT NULL,
    `resourceTypeId` INTEGER NOT NULL,
    `hours` DECIMAL(10, 2) NOT NULL,

    INDEX `ContractTaskBudget_resourceTypeId_idx`(`resourceTypeId`),
    PRIMARY KEY (`contractTaskId`, `resourceTypeId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Contract` ADD CONSTRAINT `Contract_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `Master`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Contract` ADD CONSTRAINT `Contract_currencyId_fkey` FOREIGN KEY (`currencyId`) REFERENCES `Master`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Contract` ADD CONSTRAINT `Contract_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ContractRate` ADD CONSTRAINT `ContractRate_contractId_fkey` FOREIGN KEY (`contractId`) REFERENCES `Contract`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ContractRate` ADD CONSTRAINT `ContractRate_resourceTypeId_fkey` FOREIGN KEY (`resourceTypeId`) REFERENCES `Master`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ContractTask` ADD CONSTRAINT `ContractTask_contractId_fkey` FOREIGN KEY (`contractId`) REFERENCES `Contract`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ContractTask` ADD CONSTRAINT `ContractTask_taskMasterId_fkey` FOREIGN KEY (`taskMasterId`) REFERENCES `Master`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ContractTaskBudget` ADD CONSTRAINT `ContractTaskBudget_contractTaskId_fkey` FOREIGN KEY (`contractTaskId`) REFERENCES `ContractTask`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ContractTaskBudget` ADD CONSTRAINT `ContractTaskBudget_resourceTypeId_fkey` FOREIGN KEY (`resourceTypeId`) REFERENCES `Master`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;


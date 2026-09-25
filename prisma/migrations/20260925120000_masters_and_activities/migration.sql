-- Masters + Activities rework (destructive dev-data reset, approved).
-- Old Client/Project/Task/Timesheet/Sandbox/MIS rows cannot map to the new
-- shape, so wipe them first (children before parents). AuditLog, User,
-- UserPermission and Session are left untouched.
DELETE FROM `MISReport`;
DELETE FROM `SandboxEntry`;
DELETE FROM `Timesheet`;
DELETE FROM `Task`;
DELETE FROM `Project`;
DELETE FROM `Client`;

-- DropForeignKey
ALTER TABLE `Project` DROP FOREIGN KEY `Project_clientId_fkey`;

-- DropForeignKey
ALTER TABLE `Task` DROP FOREIGN KEY `Task_projectId_fkey`;

-- DropForeignKey
ALTER TABLE `Timesheet` DROP FOREIGN KEY `Timesheet_clientId_fkey`;

-- DropForeignKey
ALTER TABLE `Timesheet` DROP FOREIGN KEY `Timesheet_projectId_fkey`;

-- AlterTable
ALTER TABLE `SandboxEntry` DROP COLUMN `projectId`,
    ADD COLUMN `activityId` INTEGER NOT NULL;

-- AlterTable
ALTER TABLE `Task` DROP COLUMN `projectId`,
    ADD COLUMN `activityId` INTEGER NOT NULL;

-- AlterTable
ALTER TABLE `Timesheet` DROP COLUMN `projectId`,
    ADD COLUMN `activityId` INTEGER NOT NULL;

-- DropTable
DROP TABLE `Client`;

-- DropTable
DROP TABLE `Project`;

-- CreateTable
CREATE TABLE `Master` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `type` ENUM('TYPE', 'CLIENT', 'PRODUCT', 'VERSION', 'MODULE', 'CLOUD_ON_PREM') NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Master_type_idx`(`type`),
    UNIQUE INDEX `Master_type_code_key`(`type`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ActivitySequence` (
    `id` INTEGER NOT NULL DEFAULT 1,
    `current` INTEGER NOT NULL DEFAULT 4389,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Activity` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `activityId` VARCHAR(191) NOT NULL,
    `seq` INTEGER NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `clientId` INTEGER NOT NULL,
    `typeId` INTEGER NOT NULL,
    `productId` INTEGER NOT NULL,
    `versionId` INTEGER NOT NULL,
    `moduleId` INTEGER NOT NULL,
    `cloudOnPremId` INTEGER NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Activity_activityId_key`(`activityId`),
    UNIQUE INDEX `Activity_seq_key`(`seq`),
    INDEX `Activity_clientId_idx`(`clientId`),
    INDEX `Activity_typeId_idx`(`typeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `SandboxEntry_clientId_idx` ON `SandboxEntry`(`clientId`);

-- CreateIndex
CREATE INDEX `SandboxEntry_activityId_idx` ON `SandboxEntry`(`activityId`);

-- CreateIndex
CREATE INDEX `Task_activityId_idx` ON `Task`(`activityId`);

-- CreateIndex
CREATE INDEX `Timesheet_activityId_idx` ON `Timesheet`(`activityId`);

-- AddForeignKey
ALTER TABLE `Activity` ADD CONSTRAINT `Activity_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `Master`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Activity` ADD CONSTRAINT `Activity_typeId_fkey` FOREIGN KEY (`typeId`) REFERENCES `Master`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Activity` ADD CONSTRAINT `Activity_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Master`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Activity` ADD CONSTRAINT `Activity_versionId_fkey` FOREIGN KEY (`versionId`) REFERENCES `Master`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Activity` ADD CONSTRAINT `Activity_moduleId_fkey` FOREIGN KEY (`moduleId`) REFERENCES `Master`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Activity` ADD CONSTRAINT `Activity_cloudOnPremId_fkey` FOREIGN KEY (`cloudOnPremId`) REFERENCES `Master`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Task` ADD CONSTRAINT `Task_activityId_fkey` FOREIGN KEY (`activityId`) REFERENCES `Activity`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Timesheet` ADD CONSTRAINT `Timesheet_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `Master`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Timesheet` ADD CONSTRAINT `Timesheet_activityId_fkey` FOREIGN KEY (`activityId`) REFERENCES `Activity`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SandboxEntry` ADD CONSTRAINT `SandboxEntry_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `Master`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SandboxEntry` ADD CONSTRAINT `SandboxEntry_activityId_fkey` FOREIGN KEY (`activityId`) REFERENCES `Activity`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;


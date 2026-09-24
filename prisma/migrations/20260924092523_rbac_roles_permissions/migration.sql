-- AlterTable
ALTER TABLE `user` MODIFY `role` ENUM('EMPLOYEE', 'MANAGER', 'ADMIN', 'SUPER_ADMIN') NOT NULL DEFAULT 'EMPLOYEE';

-- CreateTable
CREATE TABLE `UserPermission` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `module` VARCHAR(191) NOT NULL,
    `action` VARCHAR(191) NOT NULL,
    `granted` BOOLEAN NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `UserPermission_userId_idx`(`userId`),
    UNIQUE INDEX `UserPermission_userId_module_action_key`(`userId`, `module`, `action`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `UserPermission` ADD CONSTRAINT `UserPermission_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

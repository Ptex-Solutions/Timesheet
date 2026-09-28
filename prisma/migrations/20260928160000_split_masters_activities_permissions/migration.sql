-- Permission catalogue change (data only, no schema change):
-- 1. The combined "clients" module ("Masters & Activities") is split into
--    "masters" and "activities". Carry every existing override to both.
-- 2. "timesheets.edit" / "timesheets.delete" no longer exist; drop overrides.

INSERT INTO `UserPermission` (`userId`, `module`, `action`, `granted`, `updatedAt`)
SELECT `userId`, 'masters', `action`, `granted`, CURRENT_TIMESTAMP(3)
FROM `UserPermission` WHERE `module` = 'clients';

INSERT INTO `UserPermission` (`userId`, `module`, `action`, `granted`, `updatedAt`)
SELECT `userId`, 'activities', `action`, `granted`, CURRENT_TIMESTAMP(3)
FROM `UserPermission` WHERE `module` = 'clients';

DELETE FROM `UserPermission` WHERE `module` = 'clients';

DELETE FROM `UserPermission` WHERE `module` = 'timesheets' AND `action` IN ('edit', 'delete');

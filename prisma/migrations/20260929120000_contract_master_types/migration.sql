-- Season 2: three new Master categories. Additive enum change; existing rows untouched.
ALTER TABLE `Master` MODIFY `type` ENUM('TYPE', 'CLIENT', 'PRODUCT', 'VERSION', 'MODULE', 'CLOUD_ON_PREM', 'CURRENCY', 'RESOURCE_TYPE', 'TASK') NOT NULL;

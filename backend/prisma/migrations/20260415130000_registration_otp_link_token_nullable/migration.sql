-- После появления linkToken: допускаем NULL для старых/промежуточных строк.
ALTER TABLE "RegistrationOtp" ALTER COLUMN "linkToken" DROP NOT NULL;

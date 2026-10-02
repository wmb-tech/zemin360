-- İkinci operatör girişi: ekip kurucusunun kendi kutusuna bağlanır.
-- wmbyazilim+girvak kutusu ortak hesapta; sunum ve provada operatör girişi tek kişiye bağlı kalmasın.
-- Artı adresi, aynı kişinin GitHub ile açtığı genç hesabıyla e-posta çakışmasını önler.
INSERT INTO "users" ("email", "name", "role")
VALUES ('hhasanhh125+evidex@gmail.com', 'GİRVAK Operatör (Hasan)', 'operator')
ON CONFLICT ("email") DO UPDATE SET "role" = 'operator';

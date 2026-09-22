-- GİRVAK operatör hesabı: ulaşılabilir bir adrese bağlanır.
-- Seed'deki operator@evidex.dev kutusu yok; sihirli bağlantı gidemediği için canlıda operatör
-- girişi mümkün değildi. Bu kayıt tekrar çalıştırılabilir: hesap varsa rolü operatöre çeker,
-- yoksa oluşturur. Rol ataması ürün içinden yapılamaz (kayıt olan herkes kurum açar).
INSERT INTO "users" ("email", "name", "role")
VALUES ('wmbyazilim+girvak@gmail.com', 'GİRVAK Operatör', 'operator')
ON CONFLICT ("email") DO UPDATE SET "role" = 'operator';

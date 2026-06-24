-- Belediyesinden · PostgreSQL ilk kurulum
-- Bu script yalnızca volume ilk kez boşken (ilk init) çalışır — POSTGRES_DB (belediyesinden) içinde.

-- 1) 'shared' şeması: tüm tenant'ları aşan ortak tablolar (tenants, users, audit_log, lookup).
CREATE SCHEMA IF NOT EXISTS shared;

-- 2) pgcrypto: audit hash-chain (digest/hmac) + UUID üretimi için.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 3) Keycloak için ayrı veritabanı (aynı postgres instance, veri izolasyonu).
--    Conditional: tekrar çalıştırılırsa hata vermesin.
SELECT 'CREATE DATABASE keycloak'
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = 'keycloak')\gexec

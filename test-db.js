#!/usr/bin/env node
/**
 * Veritabanı bağlantı testi - gerçek hata mesajını görmek için
 */
require("dotenv").config();

const mysql = require("mysql2/promise");

async function test() {
  const config = {
    host: process.env.MYSQL_HOST || "localhost",
    user: process.env.MYSQL_USER || "root",
    password: process.env.MYSQL_PASSWORD || "",
    database: process.env.MYSQL_DATABASE || "flywork1_aimusic",
    port: parseInt(process.env.MYSQL_PORT || "3306", 10),
  };

  console.log("Bağlantı bilgileri:", {
    host: config.host,
    user: config.user,
    database: config.database,
    port: config.port,
  });

  try {
    const conn = await mysql.createConnection(config);
    console.log("✓ MySQL bağlantısı başarılı!");

    // users tablosu var mı?
    const [tables] = await conn.execute(
      "SHOW TABLES LIKE 'users'"
    );
    if (tables.length === 0) {
      console.log("✗ 'users' tablosu YOK! schema.sql çalıştırılmalı.");
    } else {
      console.log("✓ 'users' tablosu mevcut");
    }

    // artists tablosu var mı?
    const [artistsTables] = await conn.execute(
      "SHOW TABLES LIKE 'artists'"
    );
    if (artistsTables.length === 0) {
      console.log("✗ 'artists' tablosu YOK! schema.sql çalıştırılmalı.");
    } else {
      console.log("✓ 'artists' tablosu mevcut");
    }

    await conn.end();
  } catch (err) {
    console.error("✗ HATA:", err.message);
    console.error("   Kod:", err.code);
    if (err.code === "ECONNREFUSED") {
      console.error("   → MySQL çalışmıyor veya host/port yanlış");
    } else if (err.code === "ER_ACCESS_DENIED_ERROR") {
      console.error("   → Kullanıcı adı veya şifre yanlış");
    } else if (err.code === "ER_BAD_DB_ERROR") {
      console.error("   → Veritabanı mevcut değil");
    }
    process.exit(1);
  }
}

test();

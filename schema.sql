-- Soniva - MySQL veritabanı şeması

-- Veritabanı: flywork1_aimusic 

USE flywork1_aimusic;

-- Kullanıcılar (Firebase Auth ile senkronize)
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(128) PRIMARY KEY,
  name VARCHAR(255) NOT NULL DEFAULT 'User',
  email VARCHAR(255) NOT NULL DEFAULT '',
  photo_url VARCHAR(512) DEFAULT '',
  credits INT NOT NULL DEFAULT 2,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Parçalar (müzik track'leri)
CREATE TABLE IF NOT EXISTS tracks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(128) NOT NULL,
  task_id VARCHAR(255) DEFAULT '',
  remote_id VARCHAR(255) DEFAULT NULL,
  title VARCHAR(255) DEFAULT NULL,
  audio_url VARCHAR(512) DEFAULT NULL,
  image_url VARCHAR(512) DEFAULT NULL,
  prompt TEXT NOT NULL,
  style VARCHAR(255) DEFAULT NULL,
  tags VARCHAR(512) DEFAULT NULL,
  instrumental TINYINT(1) DEFAULT 0,
  duration DECIMAL(10,2) DEFAULT NULL,
  play_count INT DEFAULT 0,
  user_name VARCHAR(255) DEFAULT NULL,
  artist_id VARCHAR(64) DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_created (user_id, created_at),
  INDEX idx_play_count (play_count)
);

-- Sanatçılar
CREATE TABLE IF NOT EXISTS artists (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(128) NOT NULL,
  name VARCHAR(255) NOT NULL,
  gender VARCHAR(16) DEFAULT 'male',
  description TEXT,
  image_url VARCHAR(512) DEFAULT NULL,
  persona_id VARCHAR(255) DEFAULT NULL,
  persona_task_id VARCHAR(255) DEFAULT NULL,
  persona_audio_id VARCHAR(255) DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_created (user_id, created_at)
);

-- Abonelik satışları (in-app purchase)
CREATE TABLE IF NOT EXISTS subscriptions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(128) NOT NULL,
  user_email VARCHAR(255) DEFAULT NULL,
  user_name VARCHAR(255) DEFAULT NULL,
  product_id VARCHAR(128) NOT NULL,
  product_title VARCHAR(255) DEFAULT NULL,
  platform VARCHAR(16) NOT NULL DEFAULT 'ios',
  transaction_id VARCHAR(255) DEFAULT NULL,
  purchase_token TEXT DEFAULT NULL,
  price DECIMAL(10,2) DEFAULT NULL,
  currency VARCHAR(8) DEFAULT NULL,
  status VARCHAR(32) DEFAULT 'active',
  purchase_date DATETIME DEFAULT NULL,
  expires_at DATETIME DEFAULT NULL,
  raw_data JSON DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_sub (user_id, created_at),
  INDEX idx_sub_created (created_at),
  INDEX idx_product (product_id)
);

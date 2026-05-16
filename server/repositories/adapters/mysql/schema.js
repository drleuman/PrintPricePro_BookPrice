const { query } = require('./mysqlClient');

async function initializeSchema() {
    console.log('[MYSQL_SCHEMA_INITIALIZATION_STARTED]');
    
    try {
        // 0. Notification Events
        await query(`
            CREATE TABLE IF NOT EXISTS marketplace_notification_events (
                notification_id VARCHAR(80) PRIMARY KEY,
                order_intent_id VARCHAR(80),
                public_ref VARCHAR(120),
                recipient_email VARCHAR(255),
                event_type VARCHAR(120),
                provider VARCHAR(60),
                status VARCHAR(60),
                subject VARCHAR(255),
                payload_json JSON,
                error_json JSON,
                created_at DATETIME,
                sent_at DATETIME NULL,
                INDEX(order_intent_id),
                INDEX(public_ref),
                INDEX(event_type),
                INDEX(status),
                INDEX(created_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);

        // 1. Production Files
        await query(`
            CREATE TABLE IF NOT EXISTS marketplace_production_files (
                file_id VARCHAR(80) PRIMARY KEY,
                role VARCHAR(40) NOT NULL,
                filename VARCHAR(255),
                safe_filename VARCHAR(255),
                size_bytes BIGINT,
                mime_type VARCHAR(120),
                status VARCHAR(60) NOT NULL,
                source_type VARCHAR(40),
                checksum_algorithm VARCHAR(40),
                checksum_value VARCHAR(128),
                storage_provider VARCHAR(40),
                storage_key TEXT,
                session_id VARCHAR(120),
                cart_id VARCHAR(120),
                order_intent_id VARCHAR(120),
                order_ref VARCHAR(120),
                user_id VARCHAR(120),
                validation_json JSON,
                replacement_json JSON,
                metadata_json JSON,
                created_at DATETIME,
                updated_at DATETIME,
                deleted_at DATETIME NULL,
                INDEX idx_session_id (session_id),
                INDEX idx_order_intent_id (order_intent_id),
                INDEX idx_user_id (user_id),
                INDEX idx_status (status),
                INDEX idx_checksum (checksum_value)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);

        // 2. Offer Sessions
        await query(`
            CREATE TABLE IF NOT EXISTS marketplace_offer_sessions (
                offer_session_id VARCHAR(80) PRIMARY KEY,
                session_id VARCHAR(120),
                cart_id VARCHAR(120),
                user_id VARCHAR(120),
                input_specs_json JSON,
                normalized_specs_json JSON,
                offers_json JSON NOT NULL,
                selected_offer_id VARCHAR(120),
                expires_at DATETIME,
                created_at DATETIME,
                updated_at DATETIME,
                INDEX idx_session_id (session_id),
                INDEX idx_user_id (user_id),
                INDEX idx_expires_at (expires_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);

        // 3. Order Intents
        await query(`
            CREATE TABLE IF NOT EXISTS marketplace_order_intents (
                order_intent_id VARCHAR(80) PRIMARY KEY,
                public_ref VARCHAR(120) UNIQUE,
                session_id VARCHAR(120),
                cart_id VARCHAR(120),
                user_id VARCHAR(120),
                status VARCHAR(80) NOT NULL,
                payload JSON NULL,
                lifecycle JSON NULL,
                lifecycle_json JSON NULL,
                offer JSON NULL,
                offer_json JSON NULL,
                production_files JSON NULL,
                production_files_json JSON NULL,
                customer JSON NULL,
                customer_json JSON NULL,
                totals JSON NULL,
                totals_json JSON NULL,
                preflight JSON NULL,
                preflight_json JSON NULL,
                invoice JSON NULL,
                invoice_json JSON NULL,
                payment JSON NULL,
                payment_json JSON NULL,
                control_plane JSON NULL,
                control_plane_json JSON NULL,
                printhouse_handoff JSON NULL,
                printhouse_handoff_json JSON NULL,
                exception JSON NULL,
                exception_json JSON NULL,
                production_files_history JSON NULL,
                production_files_history_json JSON NULL,
                metadata_json JSON NULL,
                created_at DATETIME,
                updated_at DATETIME,
                cancelled_at DATETIME NULL,
                cancellation_reason VARCHAR(255) NULL,
                INDEX idx_session_id (session_id),
                INDEX idx_user_id (user_id),
                INDEX idx_status (status),
                INDEX idx_public_ref (public_ref),
                INDEX idx_created_at (created_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);

        // 4. Audit Events
        await query(`
            CREATE TABLE IF NOT EXISTS marketplace_audit_events (
                id BIGINT AUTO_INCREMENT PRIMARY KEY,
                event_id VARCHAR(80) UNIQUE,
                entity_type VARCHAR(80),
                entity_id VARCHAR(120),
                event_type VARCHAR(120),
                actor_type VARCHAR(60),
                actor_id VARCHAR(120),
                session_id VARCHAR(120),
                ip_hash VARCHAR(128),
                payload JSON NULL,
                payload_json JSON NULL,
                created_at DATETIME,
                INDEX idx_entity (entity_type, entity_id),
                INDEX idx_event_type (event_type),
                INDEX idx_created_at (created_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);

        // 5. Dispatch Packages (Phase 11/12)
        await query(`
            CREATE TABLE IF NOT EXISTS marketplace_dispatch_packages (
                package_id VARCHAR(80) PRIMARY KEY,
                order_intent_id VARCHAR(80) NOT NULL,
                public_ref VARCHAR(120),
                printhouse_id VARCHAR(120) NOT NULL,
                status VARCHAR(80) NOT NULL,
                production_queue_json JSON,
                payload_json JSON NOT NULL,
                access_json JSON,
                created_at DATETIME,
                updated_at DATETIME,
                expires_at DATETIME,
                revoked_at DATETIME NULL,
                INDEX idx_order_intent_id (order_intent_id),
                INDEX idx_printhouse_id (printhouse_id),
                INDEX idx_status (status),
                INDEX idx_expires_at (expires_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);

        console.log('[MYSQL_SCHEMA_READY]');
        return true;
    } catch (err) {
        console.error(`[MYSQL_SCHEMA_ERROR] ${err.message}`);
        throw err;
    }
}

module.exports = {
    initializeSchema
};

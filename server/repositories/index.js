const PERSISTENCE_ADAPTER = process.env.PERSISTENCE_ADAPTER || 'json';


let productionFileRepository;
let offerSessionRepository;
let orderIntentRepository;
let auditEventRepository;
let dispatchPackageRepository;
let notificationRepository;

if (PERSISTENCE_ADAPTER === 'mysql') {
    productionFileRepository = require('./adapters/mysql/productionFileMysqlRepository');
    offerSessionRepository = require('./adapters/mysql/offerSessionMysqlRepository');
    orderIntentRepository = require('./adapters/mysql/orderIntentMysqlRepository');
    auditEventRepository = require('./adapters/mysql/auditEventMysqlRepository');
    dispatchPackageRepository = require('./adapters/mysql/dispatchPackageMysqlRepository');
    notificationRepository = require('./adapters/mysql/notificationMysqlRepository');
} else {
    productionFileRepository = require('./adapters/json/productionFileJsonRepository');
    offerSessionRepository = require('./adapters/json/offerSessionJsonRepository');
    orderIntentRepository = require('./adapters/json/orderIntentJsonRepository');
    auditEventRepository = require('./adapters/json/auditEventJsonRepository');
    dispatchPackageRepository = require('./adapters/json/dispatchPackageJsonRepository');
    notificationRepository = require('./adapters/json/notificationJsonRepository');
}

module.exports = {
    productionFiles: productionFileRepository,
    offerSessions: offerSessionRepository,
    orderIntents: orderIntentRepository,
    auditEvents: auditEventRepository,
    dispatchPackages: dispatchPackageRepository,
    notifications: notificationRepository,
    adapter: PERSISTENCE_ADAPTER,
    
    async initialize() {
        console.log(`[PERSISTENCE_ADAPTER_SELECTED] mode=${PERSISTENCE_ADAPTER}`);
        if (PERSISTENCE_ADAPTER === 'mysql') {
            const { testConnection } = require('./adapters/mysql/mysqlClient');
            const { initializeSchema } = require('./adapters/mysql/schema');
            
            await testConnection();
            await initializeSchema();
        }
    }
};

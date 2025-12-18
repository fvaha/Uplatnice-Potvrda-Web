import { migrateExcelToDb } from '../utils/migrateToDb.js';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '../..');
const resourcesDir = join(projectRoot, 'resources');

async function runUpdate() {
    console.log('--- Starting Database Update from Excel ---');

    try {
        // 1. Update Uplatnice
        console.log('Migrating Uplatnice...');
        const uplatniceFile = join(projectRoot, 'novi data', 'UPLATNICE.xlsx');
        const resU = await migrateExcelToDb(uplatniceFile, 'uplatnice', resourcesDir);
        console.log('Uplatnice result:', resU);

        // 2. Update Potvrde
        console.log('\nMigrating Potvrde...');
        const potvrdeFile = join(projectRoot, 'novi data', 'POTVRDE.xlsx');
        const resP = await migrateExcelToDb(potvrdeFile, 'potvrde', resourcesDir);
        console.log('Potvrde result:', resP);

        console.log('\n--- Update Finished Successfully ---');
        console.log('Databases in resources/ have been updated.');
    } catch (error) {
        console.error('\n--- Update Failed ---');
        console.error(error.message);
        process.exit(1);
    }
}

runUpdate();

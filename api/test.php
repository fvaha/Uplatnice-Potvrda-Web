<?php
/**
 * Test file for API debugging
 * Access: nplpa.rs/uplatnice/api/test.php
 */

// Enable error display for debugging
error_reporting(E_ALL);
ini_set('display_errors', 1);
ini_set('log_errors', 1);

header('Content-Type: text/plain; charset=utf-8');

echo "=== API Test ===\n\n";

// Check PHP version
echo "PHP Version: " . phpversion() . "\n";

// Check PDO SQLite
if (extension_loaded('pdo_sqlite')) {
    echo "✓ PDO SQLite: Enabled\n";
} else {
    echo "✗ PDO SQLite: NOT ENABLED\n";
}

// Check paths
$baseDir = dirname(__DIR__);
$resourcesDir = $baseDir . '/resources';
$uplatniceDb = $resourcesDir . '/uplatnice.db';
$potvrdeDb = $resourcesDir . '/potvrde.db';

echo "\n=== Paths ===\n";
echo "Base Dir: " . $baseDir . "\n";
echo "Resources Dir: " . $resourcesDir . "\n";
echo "Uplatnice DB: " . $uplatniceDb . "\n";
echo "Potvrde DB: " . $potvrdeDb . "\n";

echo "\n=== Directory Check ===\n";
echo "Resources dir exists: " . (is_dir($resourcesDir) ? 'YES' : 'NO') . "\n";
echo "Resources dir writable: " . (is_writable($resourcesDir) ? 'YES' : 'NO') . "\n";

echo "\n=== Database Files ===\n";
echo "Uplatnice DB exists: " . (file_exists($uplatniceDb) ? 'YES' : 'NO') . "\n";
if (file_exists($uplatniceDb)) {
    echo "Uplatnice DB readable: " . (is_readable($uplatniceDb) ? 'YES' : 'NO') . "\n";
    echo "Uplatnice DB writable: " . (is_writable($uplatniceDb) ? 'YES' : 'NO') . "\n";
    echo "Uplatnice DB size: " . filesize($uplatniceDb) . " bytes\n";
}

echo "Potvrde DB exists: " . (file_exists($potvrdeDb) ? 'YES' : 'NO') . "\n";
if (file_exists($potvrdeDb)) {
    echo "Potvrde DB readable: " . (is_readable($potvrdeDb) ? 'YES' : 'NO') . "\n";
    echo "Potvrde DB writable: " . (is_writable($potvrdeDb) ? 'YES' : 'NO') . "\n";
    echo "Potvrde DB size: " . filesize($potvrdeDb) . " bytes\n";
}

echo "\n=== Database Connection Test ===\n";
try {
    if (file_exists($uplatniceDb)) {
        $db = new PDO('sqlite:' . $uplatniceDb);
        $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        echo "✓ Uplatnice DB: Connection successful\n";
        
        // Check tables
        $stmt = $db->query("SELECT name FROM sqlite_master WHERE type='table'");
        $tables = $stmt->fetchAll(PDO::FETCH_COLUMN);
        echo "  Tables: " . (empty($tables) ? 'NONE' : implode(', ', $tables)) . "\n";
        
        if (in_array('uplatnice', $tables)) {
            $stmt = $db->query("SELECT COUNT(*) FROM uplatnice");
            $count = $stmt->fetchColumn();
            echo "  Records: " . $count . "\n";
        }
    } else {
        echo "✗ Uplatnice DB: File not found\n";
    }
} catch (Exception $e) {
    echo "✗ Uplatnice DB: " . $e->getMessage() . "\n";
}

try {
    if (file_exists($potvrdeDb)) {
        $db = new PDO('sqlite:' . $potvrdeDb);
        $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        echo "✓ Potvrde DB: Connection successful\n";
        
        // Check tables
        $stmt = $db->query("SELECT name FROM sqlite_master WHERE type='table'");
        $tables = $stmt->fetchAll(PDO::FETCH_COLUMN);
        echo "  Tables: " . (empty($tables) ? 'NONE' : implode(', ', $tables)) . "\n";
        
        if (in_array('potvrde', $tables)) {
            $stmt = $db->query("SELECT COUNT(*) FROM potvrde");
            $count = $stmt->fetchColumn();
            echo "  Records: " . $count . "\n";
        }
    } else {
        echo "✗ Potvrde DB: File not found\n";
    }
} catch (Exception $e) {
    echo "✗ Potvrde DB: " . $e->getMessage() . "\n";
}

echo "\n=== API Test ===\n";
echo "Try accessing: nplpa.rs/uplatnice/api/api.php/uplatnice?action=getStats&debug=1\n";
?>


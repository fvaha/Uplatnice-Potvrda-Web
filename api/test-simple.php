<?php
/**
 * Simple test file for API debugging
 * This file tests basic PHP functionality
 */

// Disable error display, but enable error reporting
error_reporting(E_ALL);
ini_set('display_errors', 1);
ini_set('log_errors', 1);

header('Content-Type: text/plain; charset=utf-8');

echo "=== Simple PHP Test ===\n\n";

// Test 1: Basic PHP
echo "1. PHP Version: " . phpversion() . "\n";

// Test 2: PDO
if (class_exists('PDO')) {
    echo "2. PDO: Available\n";
} else {
    echo "2. PDO: NOT AVAILABLE\n";
}

// Test 3: PDO SQLite
if (extension_loaded('pdo_sqlite')) {
    echo "3. PDO SQLite: Available\n";
} else {
    echo "3. PDO SQLite: NOT AVAILABLE\n";
    echo "   ERROR: PDO SQLite extension is required!\n";
}

// Test 4: Paths
$baseDir = dirname(__DIR__);
$resourcesDir = $baseDir . '/resources';

echo "\n4. Paths:\n";
echo "   Base Dir: " . $baseDir . "\n";
echo "   Resources Dir: " . $resourcesDir . "\n";
echo "   Resources exists: " . (is_dir($resourcesDir) ? 'YES' : 'NO') . "\n";

// Test 5: File permissions
if (is_dir($resourcesDir)) {
    echo "   Resources writable: " . (is_writable($resourcesDir) ? 'YES' : 'NO') . "\n";
}

// Test 6: Database files
$uplatniceDb = $resourcesDir . '/uplatnice.db';
$potvrdeDb = $resourcesDir . '/potvrde.db';

echo "\n5. Database Files:\n";
echo "   Uplatnice DB: " . (file_exists($uplatniceDb) ? 'EXISTS' : 'NOT FOUND') . "\n";
echo "   Potvrde DB: " . (file_exists($potvrdeDb) ? 'EXISTS' : 'NOT FOUND') . "\n";

// Test 7: Try to connect
if (extension_loaded('pdo_sqlite')) {
    echo "\n6. Database Connection Test:\n";
    
    if (file_exists($uplatniceDb)) {
        try {
            $db = new PDO('sqlite:' . $uplatniceDb);
            $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
            echo "   ✓ Uplatnice DB: Connected\n";
            
            // Check tables
            $stmt = $db->query("SELECT name FROM sqlite_master WHERE type='table'");
            $tables = $stmt->fetchAll(PDO::FETCH_COLUMN);
            echo "   Tables: " . (empty($tables) ? 'NONE' : implode(', ', $tables)) . "\n";
        } catch (Exception $e) {
            echo "   ✗ Uplatnice DB: " . $e->getMessage() . "\n";
        }
    } else {
        echo "   ⚠ Uplatnice DB: File not found, will be created on first use\n";
    }
} else {
    echo "\n6. Database Connection: SKIPPED (PDO SQLite not available)\n";
}

echo "\n=== Test Complete ===\n";
echo "\nIf PDO SQLite is NOT AVAILABLE, you need to enable it in cPanel:\n";
echo "1. Go to cPanel > Select PHP Version\n";
echo "2. Enable 'pdo_sqlite' extension\n";
echo "3. Save changes\n";
?>


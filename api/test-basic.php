<?php
/**
 * Basic PHP test - minimal test to see if PHP works at all
 */

// Enable all error reporting
error_reporting(E_ALL);
ini_set('display_errors', 1);
ini_set('log_errors', 1);

header('Content-Type: text/plain; charset=utf-8');

echo "=== Basic PHP Test ===\n\n";

// Test 1: PHP works
echo "1. PHP Version: " . phpversion() . "\n";

// Test 2: Basic functions
echo "2. Basic functions work: YES\n";

// Test 3: Check if we can read files
echo "3. Current directory: " . __DIR__ . "\n";
echo "   Parent directory: " . dirname(__DIR__) . "\n";

// Test 4: Check if resources folder exists
$resourcesDir = dirname(__DIR__) . '/resources';
echo "4. Resources directory: " . $resourcesDir . "\n";
echo "   Exists: " . (is_dir($resourcesDir) ? 'YES' : 'NO') . "\n";

// Test 5: Check PDO
if (class_exists('PDO')) {
    echo "5. PDO class: Available\n";
} else {
    echo "5. PDO class: NOT AVAILABLE\n";
}

// Test 6: Check PDO SQLite
if (extension_loaded('pdo_sqlite')) {
    echo "6. PDO SQLite extension: Available\n";
} else {
    echo "6. PDO SQLite extension: NOT AVAILABLE\n";
}

// Test 7: Try to create a simple PDO connection
if (extension_loaded('pdo_sqlite')) {
    echo "\n7. Testing PDO SQLite connection...\n";
    try {
        // Try to create an in-memory database
        $testDb = new PDO('sqlite::memory:');
        $testDb->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        echo "   ✓ In-memory database: Connected\n";
        
        // Try a simple query
        $testDb->exec("CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT)");
        $testDb->exec("INSERT INTO test (name) VALUES ('test')");
        $stmt = $testDb->query("SELECT * FROM test");
        $result = $stmt->fetch(PDO::FETCH_ASSOC);
        echo "   ✓ Query test: " . ($result['name'] === 'test' ? 'PASSED' : 'FAILED') . "\n";
    } catch (Exception $e) {
        echo "   ✗ Error: " . $e->getMessage() . "\n";
    }
} else {
    echo "7. PDO SQLite test: SKIPPED (extension not available)\n";
}

// Test 8: Check file permissions
if (is_dir($resourcesDir)) {
    echo "\n8. File permissions:\n";
    echo "   Resources dir readable: " . (is_readable($resourcesDir) ? 'YES' : 'NO') . "\n";
    echo "   Resources dir writable: " . (is_writable($resourcesDir) ? 'YES' : 'NO') . "\n";
    
    $dbFile = $resourcesDir . '/uplatnice.db';
    if (file_exists($dbFile)) {
        echo "   Database file readable: " . (is_readable($dbFile) ? 'YES' : 'NO') . "\n";
        echo "   Database file writable: " . (is_writable($dbFile) ? 'YES' : 'NO') . "\n";
    }
}

echo "\n=== Test Complete ===\n";
echo "\nIf you see this message, PHP is working!\n";
echo "If PDO SQLite is available, the API should work.\n";
?>


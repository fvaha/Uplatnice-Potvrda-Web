<?php
/**
 * Simple phpinfo test
 * This will show PHP configuration
 */

// Show only essential info, not full phpinfo
header('Content-Type: text/plain; charset=utf-8');

echo "=== PHP Info ===\n\n";
echo "PHP Version: " . phpversion() . "\n\n";

echo "=== Extensions ===\n";
echo "PDO: " . (extension_loaded('pdo') ? 'YES' : 'NO') . "\n";
echo "PDO SQLite: " . (extension_loaded('pdo_sqlite') ? 'YES' : 'NO') . "\n";
echo "SQLite3: " . (extension_loaded('sqlite3') ? 'YES' : 'NO') . "\n\n";

echo "=== Paths ===\n";
echo "Current file: " . __FILE__ . "\n";
echo "Current dir: " . __DIR__ . "\n";
echo "Parent dir: " . dirname(__DIR__) . "\n";
echo "Resources dir: " . dirname(__DIR__) . "/resources\n";
echo "Resources exists: " . (is_dir(dirname(__DIR__) . '/resources') ? 'YES' : 'NO') . "\n\n";

echo "=== Permissions ===\n";
$resourcesDir = dirname(__DIR__) . '/resources';
if (is_dir($resourcesDir)) {
    echo "Resources readable: " . (is_readable($resourcesDir) ? 'YES' : 'NO') . "\n";
    echo "Resources writable: " . (is_writable($resourcesDir) ? 'YES' : 'NO') . "\n";
}

echo "\n=== Test Complete ===\n";
?>


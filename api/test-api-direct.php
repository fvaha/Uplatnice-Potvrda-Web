<?php
/**
 * Direct API test - tests the actual API endpoint
 * 
 * If this gives 500 error, there's a syntax error or fatal error in this file
 */

// Try to catch any fatal errors
register_shutdown_function(function() {
    $error = error_get_last();
    if ($error !== NULL && in_array($error['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR])) {
        header('Content-Type: text/plain; charset=utf-8');
        echo "FATAL ERROR:\n";
        echo "Type: " . $error['type'] . "\n";
        echo "Message: " . $error['message'] . "\n";
        echo "File: " . $error['file'] . "\n";
        echo "Line: " . $error['line'] . "\n";
    }
});

error_reporting(E_ALL);
ini_set('display_errors', 1);
ini_set('log_errors', 1);

header('Content-Type: text/plain; charset=utf-8');

echo "=== Direct API Test ===\n\n";

// Simulate the API call
$_SERVER['REQUEST_METHOD'] = 'POST';
$_SERVER['REQUEST_URI'] = '/uplatnice/api/api.php/uplatnice';

// Set input
$testInput = json_encode([
    'action' => 'getStats',
    'params' => []
]);

// Capture output
ob_start();

// Include the API file
try {
    // Set up input stream
    $GLOBALS['HTTP_RAW_POST_DATA'] = $testInput;
    
    // Override file_get_contents for php://input
    function file_get_contents_override($filename) {
        if ($filename === 'php://input') {
            return $GLOBALS['HTTP_RAW_POST_DATA'];
        }
        return file_get_contents($filename);
    }
    
    // Actually, let's just test the API directly
    echo "Testing API endpoint...\n\n";
    
    // Test 1: Check if api.php exists
    $apiPath = __DIR__ . '/api.php';
    echo "1. API file exists: " . (file_exists($apiPath) ? 'YES' : 'NO') . "\n";
    echo "   Path: " . $apiPath . "\n";
    
    // Test 2: Check syntax
    echo "\n2. Checking PHP syntax...\n";
    $output = [];
    $return = 0;
    exec("php -l " . escapeshellarg($apiPath) . " 2>&1", $output, $return);
    if ($return === 0) {
        echo "   ✓ Syntax OK\n";
    } else {
        echo "   ✗ Syntax Error:\n";
        foreach ($output as $line) {
            echo "     " . $line . "\n";
        }
    }
    
    // Test 3: Try to include and see what happens
    echo "\n3. Testing API inclusion...\n";
    
    // Save current error handler
    $oldErrorHandler = set_error_handler(function($errno, $errstr, $errfile, $errline) {
        echo "   ERROR: [$errno] $errstr in $errfile:$errline\n";
        return true;
    });
    
    // Try to include
    try {
        // We can't easily test the full API without proper setup, but we can check paths
        $baseDir = dirname(__DIR__);
        $resourcesDir = $baseDir . '/resources';
        $uplatniceDb = $resourcesDir . '/uplatnice.db';
        
        echo "   Base Dir: " . $baseDir . "\n";
        echo "   Resources Dir: " . $resourcesDir . "\n";
        echo "   Resources exists: " . (is_dir($resourcesDir) ? 'YES' : 'NO') . "\n";
        echo "   Uplatnice DB: " . $uplatniceDb . "\n";
        echo "   DB exists: " . (file_exists($uplatniceDb) ? 'YES' : 'NO') . "\n";
        
        if (file_exists($uplatniceDb)) {
            echo "   DB readable: " . (is_readable($uplatniceDb) ? 'YES' : 'NO') . "\n";
            echo "   DB writable: " . (is_writable($uplatniceDb) ? 'YES' : 'NO') . "\n";
        }
        
    } catch (Exception $e) {
        echo "   EXCEPTION: " . $e->getMessage() . "\n";
    } catch (Error $e) {
        echo "   FATAL ERROR: " . $e->getMessage() . "\n";
    }
    
    // Restore error handler
    if ($oldErrorHandler) {
        set_error_handler($oldErrorHandler);
    }
    
} catch (Exception $e) {
    echo "ERROR: " . $e->getMessage() . "\n";
    echo "Trace: " . $e->getTraceAsString() . "\n";
}

echo "\n=== Test Complete ===\n";
echo "\nNext step: Check Error Log in cPanel for exact error message.\n";
?>


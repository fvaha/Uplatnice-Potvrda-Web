<?php
/**
 * Authentication API endpoint
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Load credentials from .env file
function loadEnv($filePath) {
    $env = [];
    if (file_exists($filePath)) {
        $lines = file($filePath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        foreach ($lines as $line) {
            $line = trim($line);
            if (empty($line) || strpos($line, '#') === 0) continue; // Skip comments and empty lines
            if (strpos($line, '=') !== false) {
                list($key, $value) = explode('=', $line, 2);
                $key = trim($key);
                $value = trim($value);
                // Remove quotes if present
                $value = trim($value, '"\'');
                $env[$key] = $value;
            }
        }
    }
    return $env;
}

$baseDir = dirname(__DIR__);
$envFile = $baseDir . '/.env';
$env = loadEnv($envFile);

// Load credentials from .env file (required)
$username = $env['VITE_ADMIN_USERNAME'] ?? '';
$password = $env['VITE_ADMIN_PASSWORD'] ?? '';

// Validate that credentials are set
if (empty($username) || empty($password)) {
    http_response_code(500);
    echo json_encode([
        'error' => 'Server configuration error',
        'message' => 'Admin credentials not configured. Please set VITE_ADMIN_USERNAME and VITE_ADMIN_PASSWORD in .env file.'
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);
$action = $input['action'] ?? $_GET['action'] ?? 'login';

try {
    switch ($action) {
        case 'login':
            $inputUsername = $input['username'] ?? '';
            $inputPassword = $input['password'] ?? '';
            
            if ($inputUsername === $username && $inputPassword === $password) {
                // Generate session token
                $token = bin2hex(random_bytes(32));
                
                // Store token in session (or you could use database)
                session_start();
                $_SESSION['auth_token'] = $token;
                $_SESSION['auth_time'] = time();
                
                echo json_encode([
                    'success' => true,
                    'token' => $token,
                    'message' => 'Login successful'
                ], JSON_UNESCAPED_UNICODE);
            } else {
                http_response_code(401);
                echo json_encode([
                    'success' => false,
                    'error' => 'Invalid username or password'
                ], JSON_UNESCAPED_UNICODE);
            }
            break;
            
        case 'verify':
            session_start();
            $token = $input['token'] ?? $_SESSION['auth_token'] ?? null;
            
            if ($token && isset($_SESSION['auth_token']) && $_SESSION['auth_token'] === $token) {
                // Check if session is not expired (24 hours)
                $authTime = $_SESSION['auth_time'] ?? 0;
                if (time() - $authTime < 86400) {
                    echo json_encode([
                        'success' => true,
                        'authenticated' => true
                    ], JSON_UNESCAPED_UNICODE);
                } else {
                    session_destroy();
                    http_response_code(401);
                    echo json_encode([
                        'success' => false,
                        'error' => 'Session expired'
                    ], JSON_UNESCAPED_UNICODE);
                }
            } else {
                http_response_code(401);
                echo json_encode([
                    'success' => false,
                    'error' => 'Not authenticated'
                ], JSON_UNESCAPED_UNICODE);
            }
            break;
            
        case 'logout':
            session_start();
            session_destroy();
            echo json_encode([
                'success' => true,
                'message' => 'Logged out'
            ], JSON_UNESCAPED_UNICODE);
            break;
            
        default:
            http_response_code(400);
            echo json_encode(['error' => 'Invalid action']);
            break;
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'error' => $e->getMessage()
    ], JSON_UNESCAPED_UNICODE);
}
?>


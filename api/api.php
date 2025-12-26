<?php
// Enable error reporting for debugging (disable in production)
error_reporting(E_ALL);
ini_set('display_errors', 0); // Don't display errors, but log them
ini_set('log_errors', 1);

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Authentication check function
function checkAuthentication() {
    $requestUri = $_SERVER['REQUEST_URI'] ?? '';
    $isAuthEndpoint = strpos($requestUri, '/auth.php') !== false;
    $isTestFile = preg_match('/\/(test|phpinfo|test-.*)\.php/', $requestUri);
    
    // Skip auth for auth endpoint and test files
    if ($isAuthEndpoint || $isTestFile) {
        return true;
    }
    
    session_start();
    
    // Get token from request
    $rawInput = file_get_contents('php://input');
    $input = json_decode($rawInput, true);
    $token = $input['token'] ?? $_GET['token'] ?? null;
    
    $sessionToken = $_SESSION['auth_token'] ?? null;
    $authTime = $_SESSION['auth_time'] ?? 0;
    
    // Check if authenticated
    if ($token && $sessionToken && $token === $sessionToken) {
        // Check if session is not expired (24 hours)
        if (time() - $authTime < 86400) {
            return true;
        } else {
            // Session expired
            session_destroy();
        }
    }
    
    // Also check Authorization header
    $authHeader = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    if ($authHeader) {
        $headerToken = str_replace('Bearer ', '', $authHeader);
        if ($headerToken && $sessionToken && $headerToken === $sessionToken) {
            if (time() - $authTime < 86400) {
                return true;
            }
        }
    }
    
    return false;
}

// Database path - adjust if needed
$baseDir = dirname(__DIR__);
$resourcesDir = $baseDir . '/resources';
$uplatniceDb = $resourcesDir . '/uplatnice.db';
$potvrdeDb = $resourcesDir . '/potvrde.db';

// Ensure resources directory exists
if (!is_dir($resourcesDir)) {
    http_response_code(500);
    echo json_encode(['error' => 'Resources directory not found: ' . $resourcesDir]);
    exit;
}

// Normalize text function for search
function normalizeText($text) {
    if (empty($text)) return '';
    $text = mb_strtolower($text, 'UTF-8');
    $text = str_replace(['č', 'ć'], 'c', $text);
    $text = str_replace('š', 's', $text);
    $text = str_replace('ž', 'z', $text);
    $text = str_replace('đ', 'd', $text);
    return $text;
}

// Initialize database tables if they don't exist
function initializeDatabase($db, $table) {
    try {
        // Check if table exists
        $stmt = $db->query("SELECT name FROM sqlite_master WHERE type='table' AND name='{$table}'");
        $exists = $stmt->fetch();
        
        if (!$exists) {
            // Create table based on type
            if ($table === 'uplatnice') {
                $db->exec("
                    CREATE TABLE IF NOT EXISTS uplatnice (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        jmbg TEXT UNIQUE NOT NULL,
                        ime_i_prezime TEXT NOT NULL,
                        adresa TEXT,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    );
                    CREATE INDEX IF NOT EXISTS idx_uplatnice_jmbg ON uplatnice(jmbg);
                ");
            } else if ($table === 'potvrde') {
                $db->exec("
                    CREATE TABLE IF NOT EXISTS potvrde (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        sifra_opstine INTEGER,
                        sifra_akta TEXT,
                        broj_prijave TEXT,
                        jmbg TEXT NOT NULL,
                        vlasnistvo_od INTEGER,
                        vlasnistvo_do INTEGER,
                        status_prijave TEXT,
                        izvor_podataka TEXT,
                        datum_prijave INTEGER,
                        pib TEXT,
                        obveznik TEXT,
                        stanuje TEXT,
                        adresa_obveznika TEXT,
                        adresa_objekta TEXT,
                        vrsta_prava TEXT,
                        vrsta_nepokretnosti TEXT,
                        zona TEXT,
                        oporeziva_povrsina REAL,
                        datum_izgradnje_rekonstrukcije INTEGER,
                        osnovica_preth_god REAL,
                        porez_preth_god REAL,
                        status_lica TEXT,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        UNIQUE(jmbg, sifra_akta, broj_prijave)
                    );
                    CREATE INDEX IF NOT EXISTS idx_potvrde_jmbg ON potvrde(jmbg);
                    CREATE INDEX IF NOT EXISTS idx_potvrde_pib ON potvrde(pib);
                ");
            }
        }
    } catch (Exception $e) {
        // Log error but don't fail - table might already exist
        error_log('Database initialization error: ' . $e->getMessage());
    }
}

// Get database connection
function getDb($dbPath) {
    try {
        // Check if database file exists, if not create it
        if (!file_exists($dbPath)) {
            // Try to create the database file
            $dbDir = dirname($dbPath);
            if (!is_writable($dbDir)) {
                throw new Exception('Database directory is not writable: ' . $dbDir);
            }
            // Create empty database file
            touch($dbPath);
            chmod($dbPath, 0666);
        }
        
        // Check if database file is readable
        if (!is_readable($dbPath)) {
            throw new Exception('Database file is not readable: ' . $dbPath);
        }
        
        $db = new PDO('sqlite:' . $dbPath);
        $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        $db->exec("PRAGMA foreign_keys = ON");
        
        // Try to create NORMALIZE_TEXT function for SQLite (if available)
        if (method_exists($db, 'sqliteCreateFunction')) {
            try {
                $db->sqliteCreateFunction('NORMALIZE_TEXT', 'normalizeText', 1);
            } catch (Exception $e) {
                // Function creation failed, will use PHP-side filtering
            }
        }
        
        return $db;
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode([
            'error' => 'Database connection failed',
            'message' => $e->getMessage(),
            'path' => $dbPath,
            'file_exists' => file_exists($dbPath),
            'is_readable' => file_exists($dbPath) ? is_readable($dbPath) : false
        ]);
        exit;
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode([
            'error' => 'Database setup failed',
            'message' => $e->getMessage(),
            'path' => $dbPath
        ]);
        exit;
    }
}

// Search helper that filters results in PHP if SQL function not available
function searchWithNormalization($db, $table, $query, $normalizedQuery, $words) {
    $searchTerm = '%' . $normalizedQuery . '%';
    
    // Try to use SQL function first
    $useSqlFunction = method_exists($db, 'sqliteCreateFunction');
    
    if ($table === 'uplatnice') {
        if ($useSqlFunction) {
            // Use SQL function
            $nameConditions = 'NORMALIZE_TEXT(ime_i_prezime) LIKE ?';
            $nameParams = [$searchTerm];
            
            if (count($words) > 0) {
                $wordConditions = [];
                foreach ($words as $word) {
                    $wordConditions[] = 'NORMALIZE_TEXT(ime_i_prezime) LIKE ?';
                    $nameParams[] = '%' . $word . '%';
                }
                $nameConditions = '(' . $nameConditions . ' OR ' . implode(' OR ', $wordConditions) . ')';
            }

            $sqlParams = array_merge($nameParams, [$searchTerm, $searchTerm, $searchTerm, $searchTerm]);
            
            $stmt = $db->prepare("
                SELECT * FROM uplatnice 
                WHERE {$nameConditions}
                   OR NORMALIZE_TEXT(jmbg) LIKE ? 
                   OR NORMALIZE_TEXT(adresa) LIKE ?
                ORDER BY 
                  CASE 
                    WHEN NORMALIZE_TEXT(ime_i_prezime) LIKE ? THEN 1
                    WHEN NORMALIZE_TEXT(jmbg) LIKE ? THEN 2
                    ELSE 3
                  END,
                  ime_i_prezime
                LIMIT 100
            ");
            $stmt->execute($sqlParams);
            return $stmt->fetchAll(PDO::FETCH_ASSOC);
        } else {
            // Fallback: fetch all and filter in PHP
            $stmt = $db->prepare('SELECT * FROM uplatnice');
            $stmt->execute();
            $all = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            $results = [];
            foreach ($all as $row) {
                $normalizedIme = normalizeText($row['ime_i_prezime']);
                $normalizedJmbg = normalizeText($row['jmbg']);
                $normalizedAdresa = normalizeText($row['adresa'] ?? '');
                
                $matches = false;
                if (strpos($normalizedIme, $normalizedQuery) !== false || 
                    strpos($normalizedJmbg, $normalizedQuery) !== false ||
                    strpos($normalizedAdresa, $normalizedQuery) !== false) {
                    $matches = true;
                } else if (count($words) > 0) {
                    $nameWords = explode(' ', $normalizedIme);
                    $allWordsMatch = true;
                    foreach ($words as $word) {
                        $wordMatches = false;
                        foreach ($nameWords as $nameWord) {
                            if (strpos($nameWord, $word) !== false) {
                                $wordMatches = true;
                                break;
                            }
                        }
                        if (!$wordMatches) {
                            $allWordsMatch = false;
                            break;
                        }
                    }
                    $matches = $allWordsMatch;
                }
                
                if ($matches) {
                    $results[] = $row;
                }
                
                if (count($results) >= 100) break;
            }
            
            // Sort results
            usort($results, function($a, $b) use ($normalizedQuery) {
                $aNorm = normalizeText($a['ime_i_prezime']);
                $bNorm = normalizeText($b['ime_i_prezime']);
                $aJmbg = normalizeText($a['jmbg']);
                $bJmbg = normalizeText($b['jmbg']);
                
                $aScore = (strpos($aNorm, $normalizedQuery) === 0 ? 1 : (strpos($aJmbg, $normalizedQuery) === 0 ? 2 : 3));
                $bScore = (strpos($bNorm, $normalizedQuery) === 0 ? 1 : (strpos($bJmbg, $normalizedQuery) === 0 ? 2 : 3));
                
                if ($aScore !== $bScore) {
                    return $aScore - $bScore;
                }
                return strcmp($a['ime_i_prezime'], $b['ime_i_prezime']);
            });
            
            return $results;
        }
    } else {
        // Potvrde search
        if ($useSqlFunction) {
            $nameConditions = 'NORMALIZE_TEXT(obveznik) LIKE ?';
            $nameParams = [$searchTerm];
            
            if (count($words) > 0) {
                $wordConditions = [];
                foreach ($words as $word) {
                    $wordConditions[] = 'NORMALIZE_TEXT(obveznik) LIKE ?';
                    $nameParams[] = '%' . $word . '%';
                }
                $nameConditions = '(' . $nameConditions . ' OR ' . implode(' OR ', $wordConditions) . ')';
            }

            $addressConditions = '(NORMALIZE_TEXT(adresa_objekta) LIKE ? OR NORMALIZE_TEXT(adresa_obveznika) LIKE ?)';
            $addressParams = [$searchTerm, $searchTerm];
            
            if (count($words) > 0) {
                $wordAddressConditions = [];
                foreach ($words as $word) {
                    $wordAddressConditions[] = '(NORMALIZE_TEXT(adresa_objekta) LIKE ? OR NORMALIZE_TEXT(adresa_obveznika) LIKE ?)';
                    $addressParams[] = '%' . $word . '%';
                    $addressParams[] = '%' . $word . '%';
                }
                $addressConditions = '(' . $addressConditions . ' OR ' . implode(' OR ', $wordAddressConditions) . ')';
            }

            $sqlParams = array_merge($nameParams, [$searchTerm], $addressParams, [$searchTerm, $searchTerm, $searchTerm, $searchTerm]);
            
            $stmt = $db->prepare("
                SELECT * FROM potvrde 
                WHERE {$nameConditions}
                   OR NORMALIZE_TEXT(jmbg) LIKE ?
                   OR {$addressConditions}
                   OR NORMALIZE_TEXT(pib) LIKE ?
                ORDER BY 
                  CASE 
                    WHEN NORMALIZE_TEXT(obveznik) LIKE ? THEN 1
                    WHEN NORMALIZE_TEXT(jmbg) LIKE ? THEN 2
                    WHEN NORMALIZE_TEXT(pib) LIKE ? THEN 3
                    ELSE 4
                  END,
                  obveznik
                LIMIT 100
            ");
            $stmt->execute($sqlParams);
            return $stmt->fetchAll(PDO::FETCH_ASSOC);
        } else {
            // Fallback: fetch all and filter in PHP
            $stmt = $db->prepare('SELECT * FROM potvrde');
            $stmt->execute();
            $all = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            $results = [];
            foreach ($all as $row) {
                $normalizedObveznik = normalizeText($row['obveznik'] ?? '');
                $normalizedJmbg = normalizeText($row['jmbg']);
                $normalizedAdresaObjekta = normalizeText($row['adresa_objekta'] ?? '');
                $normalizedAdresaObveznika = normalizeText($row['adresa_obveznika'] ?? '');
                $normalizedPib = normalizeText($row['pib'] ?? '');
                
                $matches = false;
                if (strpos($normalizedObveznik, $normalizedQuery) !== false || 
                    strpos($normalizedJmbg, $normalizedQuery) !== false ||
                    strpos($normalizedAdresaObjekta, $normalizedQuery) !== false ||
                    strpos($normalizedAdresaObveznika, $normalizedQuery) !== false ||
                    strpos($normalizedPib, $normalizedQuery) !== false) {
                    $matches = true;
                } else if (count($words) > 0) {
                    $nameWords = explode(' ', $normalizedObveznik);
                    $allWordsMatch = true;
                    foreach ($words as $word) {
                        $wordMatches = false;
                        foreach ($nameWords as $nameWord) {
                            if (strpos($nameWord, $word) !== false) {
                                $wordMatches = true;
                                break;
                            }
                        }
                        if (!$wordMatches) {
                            // Check addresses
                            if (strpos($normalizedAdresaObjekta, $word) !== false || 
                                strpos($normalizedAdresaObveznika, $word) !== false) {
                                $wordMatches = true;
                            }
                        }
                        if (!$wordMatches) {
                            $allWordsMatch = false;
                            break;
                        }
                    }
                    $matches = $allWordsMatch;
                }
                
                if ($matches) {
                    $results[] = $row;
                }
                
                if (count($results) >= 100) break;
            }
            
            // Sort results
            usort($results, function($a, $b) use ($normalizedQuery) {
                $aNorm = normalizeText($a['obveznik'] ?? '');
                $bNorm = normalizeText($b['obveznik'] ?? '');
                $aJmbg = normalizeText($a['jmbg']);
                $bJmbg = normalizeText($b['jmbg']);
                $aPib = normalizeText($a['pib'] ?? '');
                $bPib = normalizeText($b['pib'] ?? '');
                
                $aScore = (strpos($aNorm, $normalizedQuery) === 0 ? 1 : (strpos($aJmbg, $normalizedQuery) === 0 ? 2 : (strpos($aPib, $normalizedQuery) === 0 ? 3 : 4)));
                $bScore = (strpos($bNorm, $normalizedQuery) === 0 ? 1 : (strpos($bJmbg, $normalizedQuery) === 0 ? 2 : (strpos($bPib, $normalizedQuery) === 0 ? 3 : 4)));
                
                if ($aScore !== $bScore) {
                    return $aScore - $bScore;
                }
                return strcmp($a['obveznik'] ?? '', $b['obveznik'] ?? '');
            });
            
            return $results;
        }
    }
}

// Check authentication before processing request
if (!checkAuthentication()) {
    http_response_code(401);
    echo json_encode([
        'error' => 'Unauthorized',
        'message' => 'Authentication required. Please login first.'
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

// Get request data
$rawInput = file_get_contents('php://input');
$input = json_decode($rawInput, true);
$method = $_SERVER['REQUEST_METHOD'];
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$pathParts = array_filter(explode('/', trim($path, '/')));
$pathParts = array_values($pathParts); // Re-index array

// Log request for debugging (only if debug parameter is present)
if (isset($_GET['debug']) || isset($input['debug'])) {
    error_log("API Request: Method=$method, Path=$path, Input=" . substr($rawInput, 0, 200));
}

// Route: /uplatnice/api/api.php/uplatnice or /api/api.php/uplatnice
// Find table name in path (should be after api.php)
$table = null;
$apiIndex = -1;
foreach ($pathParts as $index => $part) {
    if (strpos($part, 'api.php') !== false) {
        $apiIndex = $index;
        break;
    }
}

if ($apiIndex >= 0 && isset($pathParts[$apiIndex + 1])) {
    $potentialTable = $pathParts[$apiIndex + 1];
    if (in_array($potentialTable, ['uplatnice', 'potvrde'])) {
        $table = $potentialTable;
    }
}

// Fallback: try to get from query string or check last part
if (!$table) {
    if (isset($_GET['table']) && in_array($_GET['table'], ['uplatnice', 'potvrde'])) {
        $table = $_GET['table'];
    } else if (count($pathParts) > 0) {
        $lastPart = end($pathParts);
        if (in_array($lastPart, ['uplatnice', 'potvrde'])) {
            $table = $lastPart;
        }
    }
}

if (!$table) {
    http_response_code(400);
    echo json_encode([
        'error' => 'Invalid table name',
        'path' => $path,
        'pathParts' => $pathParts,
        'requestUri' => $_SERVER['REQUEST_URI'] ?? 'unknown',
        'method' => $method
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

$dbPath = $table === 'uplatnice' ? $uplatniceDb : $potvrdeDb;

// Try to get database connection
try {
    $db = getDb($dbPath);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'error' => 'Failed to connect to database',
        'message' => $e->getMessage(),
        'path' => $dbPath,
        'table' => $table
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

// Initialize database tables if needed
try {
    initializeDatabase($db, $table);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'error' => 'Failed to initialize database',
        'message' => $e->getMessage(),
        'table' => $table
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

// Handle different operations
$action = $input['action'] ?? $_GET['action'] ?? 'getAll';
$params = $input['params'] ?? [];

try {
    switch ($action) {
        case 'getAll':
            if ($table === 'uplatnice') {
                $stmt = $db->prepare('SELECT * FROM uplatnice ORDER BY ime_i_prezime');
                $stmt->execute();
                $result = $stmt->fetchAll(PDO::FETCH_ASSOC);
            } else {
                $stmt = $db->prepare('SELECT * FROM potvrde ORDER BY obveznik');
                $stmt->execute();
                $result = $stmt->fetchAll(PDO::FETCH_ASSOC);
            }
            echo json_encode($result, JSON_UNESCAPED_UNICODE);
            break;

        case 'getByJMBG':
            $jmbg = $params[0] ?? '';
            if ($table === 'uplatnice') {
                $stmt = $db->prepare('SELECT * FROM uplatnice WHERE jmbg = ?');
                $stmt->execute([$jmbg]);
                $result = $stmt->fetch(PDO::FETCH_ASSOC);
            } else {
                $stmt = $db->prepare('SELECT * FROM potvrde WHERE jmbg = ?');
                $stmt->execute([$jmbg]);
                $result = $stmt->fetchAll(PDO::FETCH_ASSOC);
            }
            echo json_encode($result, JSON_UNESCAPED_UNICODE);
            break;

        case 'getByPIB':
            if ($table !== 'potvrde') {
                throw new Exception('getByPIB only available for potvrde');
            }
            $pib = $params[0] ?? '';
            $stmt = $db->prepare('SELECT * FROM potvrde WHERE pib = ?');
            $stmt->execute([$pib]);
            $result = $stmt->fetchAll(PDO::FETCH_ASSOC);
            echo json_encode($result, JSON_UNESCAPED_UNICODE);
            break;

        case 'getByUnique':
            if ($table !== 'potvrde') {
                throw new Exception('getByUnique only available for potvrde');
            }
            $jmbg = $params[0] ?? '';
            $sifra_akta = $params[1] ?? '';
            $broj_prijave = $params[2] ?? '';
            $stmt = $db->prepare('SELECT * FROM potvrde WHERE jmbg = ? AND sifra_akta = ? AND broj_prijave = ?');
            $stmt->execute([$jmbg, $sifra_akta, $broj_prijave]);
            $result = $stmt->fetch(PDO::FETCH_ASSOC);
            echo json_encode($result, JSON_UNESCAPED_UNICODE);
            break;

        case 'search':
            $query = $params[0] ?? '';
            if (empty(trim($query))) {
                echo json_encode([], JSON_UNESCAPED_UNICODE);
                break;
            }

            $normalizedQuery = normalizeText(trim($query));
            $words = array_filter(explode(' ', $normalizedQuery));
            
            $result = searchWithNormalization($db, $table, $query, $normalizedQuery, $words);
            echo json_encode($result, JSON_UNESCAPED_UNICODE);
            break;

        case 'insert':
            $data = $params[0] ?? [];
            if ($table === 'uplatnice') {
                $stmt = $db->prepare('INSERT INTO uplatnice (jmbg, ime_i_prezime, adresa) VALUES (?, ?, ?)');
                $stmt->execute([$data['jmbg'], $data['ime_i_prezime'], $data['adresa'] ?? null]);
                $result = ['success' => true, 'lastInsertId' => $db->lastInsertId()];
            } else {
                $stmt = $db->prepare("
                    INSERT INTO potvrde (
                        sifra_opstine, sifra_akta, broj_prijave, jmbg, vlasnistvo_od, vlasnistvo_do,
                        status_prijave, izvor_podataka, datum_prijave, pib, obveznik, stanuje,
                        adresa_obveznika, adresa_objekta, vrsta_prava, vrsta_nepokretnosti, zona,
                        oporeziva_povrsina, datum_izgradnje_rekonstrukcije, osnovica_preth_god,
                        porez_preth_god, status_lica
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ");
                $stmt->execute([
                    $data['sifra_opstine'] ?? null, $data['sifra_akta'] ?? null, $data['broj_prijave'] ?? null,
                    $data['jmbg'], $data['vlasnistvo_od'] ?? null, $data['vlasnistvo_do'] ?? null,
                    $data['status_prijave'] ?? null, $data['izvor_podataka'] ?? null, $data['datum_prijave'] ?? null,
                    $data['pib'] ?? null, $data['obveznik'] ?? null, $data['stanuje'] ?? null,
                    $data['adresa_obveznika'] ?? null, $data['adresa_objekta'] ?? null,
                    $data['vrsta_prava'] ?? null, $data['vrsta_nepokretnosti'] ?? null, $data['zona'] ?? null,
                    $data['oporeziva_povrsina'] ?? null, $data['datum_izgradnje_rekonstrukcije'] ?? null,
                    $data['osnovica_preth_god'] ?? null, $data['porez_preth_god'] ?? null, $data['status_lica'] ?? null
                ]);
                $result = ['success' => true, 'lastInsertId' => $db->lastInsertId()];
            }
            echo json_encode($result, JSON_UNESCAPED_UNICODE);
            break;

        case 'update':
            $data = $params[0] ?? [];
            if ($table === 'uplatnice') {
                $stmt = $db->prepare('UPDATE uplatnice SET ime_i_prezime = ?, adresa = ?, updated_at = CURRENT_TIMESTAMP WHERE jmbg = ?');
                $stmt->execute([$data['ime_i_prezime'], $data['adresa'] ?? null, $data['jmbg']]);
                $result = ['success' => true, 'changes' => $stmt->rowCount()];
            } else {
                $stmt = $db->prepare("
                    UPDATE potvrde SET
                        sifra_opstine = ?, vlasnistvo_od = ?, vlasnistvo_do = ?,
                        status_prijave = ?, izvor_podataka = ?, datum_prijave = ?, pib = ?,
                        obveznik = ?, stanuje = ?, adresa_obveznika = ?, adresa_objekta = ?,
                        vrsta_prava = ?, vrsta_nepokretnosti = ?, zona = ?,
                        oporeziva_povrsina = ?, datum_izgradnje_rekonstrukcije = ?,
                        osnovica_preth_god = ?, porez_preth_god = ?, status_lica = ?,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE jmbg = ? AND sifra_akta = ? AND broj_prijave = ?
                ");
                $stmt->execute([
                    $data['sifra_opstine'] ?? null, $data['vlasnistvo_od'] ?? null, $data['vlasnistvo_do'] ?? null,
                    $data['status_prijave'] ?? null, $data['izvor_podataka'] ?? null, $data['datum_prijave'] ?? null,
                    $data['pib'] ?? null, $data['obveznik'] ?? null, $data['stanuje'] ?? null,
                    $data['adresa_obveznika'] ?? null, $data['adresa_objekta'] ?? null,
                    $data['vrsta_prava'] ?? null, $data['vrsta_nepokretnosti'] ?? null, $data['zona'] ?? null,
                    $data['oporeziva_povrsina'] ?? null, $data['datum_izgradnje_rekonstrukcije'] ?? null,
                    $data['osnovica_preth_god'] ?? null, $data['porez_preth_god'] ?? null, $data['status_lica'] ?? null,
                    $data['jmbg'], $data['sifra_akta'], $data['broj_prijave']
                ]);
                $result = ['success' => true, 'changes' => $stmt->rowCount()];
            }
            echo json_encode($result, JSON_UNESCAPED_UNICODE);
            break;

        case 'upsert':
            $data = $params[0] ?? [];
            if ($table === 'uplatnice') {
                $stmt = $db->prepare('SELECT * FROM uplatnice WHERE jmbg = ?');
                $stmt->execute([$data['jmbg']]);
                $existing = $stmt->fetch(PDO::FETCH_ASSOC);
                
                if ($existing) {
                    $stmt = $db->prepare('UPDATE uplatnice SET ime_i_prezime = ?, adresa = ?, updated_at = CURRENT_TIMESTAMP WHERE jmbg = ?');
                    $stmt->execute([$data['ime_i_prezime'], $data['adresa'] ?? null, $data['jmbg']]);
                    $result = ['success' => true, 'action' => 'updated', 'changes' => $stmt->rowCount()];
                } else {
                    $stmt = $db->prepare('INSERT INTO uplatnice (jmbg, ime_i_prezime, adresa) VALUES (?, ?, ?)');
                    $stmt->execute([$data['jmbg'], $data['ime_i_prezime'], $data['adresa'] ?? null]);
                    $result = ['success' => true, 'action' => 'inserted', 'lastInsertId' => $db->lastInsertId()];
                }
            } else {
                $stmt = $db->prepare('SELECT * FROM potvrde WHERE jmbg = ? AND sifra_akta = ? AND broj_prijave = ?');
                $stmt->execute([$data['jmbg'], $data['sifra_akta'], $data['broj_prijave']]);
                $existing = $stmt->fetch(PDO::FETCH_ASSOC);
                
                if ($existing) {
                    $stmt = $db->prepare("
                        UPDATE potvrde SET
                            sifra_opstine = ?, vlasnistvo_od = ?, vlasnistvo_do = ?,
                            status_prijave = ?, izvor_podataka = ?, datum_prijave = ?, pib = ?,
                            obveznik = ?, stanuje = ?, adresa_obveznika = ?, adresa_objekta = ?,
                            vrsta_prava = ?, vrsta_nepokretnosti = ?, zona = ?,
                            oporeziva_povrsina = ?, datum_izgradnje_rekonstrukcije = ?,
                            osnovica_preth_god = ?, porez_preth_god = ?, status_lica = ?,
                            updated_at = CURRENT_TIMESTAMP
                        WHERE jmbg = ? AND sifra_akta = ? AND broj_prijave = ?
                    ");
                    $stmt->execute([
                        $data['sifra_opstine'] ?? null, $data['vlasnistvo_od'] ?? null, $data['vlasnistvo_do'] ?? null,
                        $data['status_prijave'] ?? null, $data['izvor_podataka'] ?? null, $data['datum_prijave'] ?? null,
                        $data['pib'] ?? null, $data['obveznik'] ?? null, $data['stanuje'] ?? null,
                        $data['adresa_obveznika'] ?? null, $data['adresa_objekta'] ?? null,
                        $data['vrsta_prava'] ?? null, $data['vrsta_nepokretnosti'] ?? null, $data['zona'] ?? null,
                        $data['oporeziva_povrsina'] ?? null, $data['datum_izgradnje_rekonstrukcije'] ?? null,
                        $data['osnovica_preth_god'] ?? null, $data['porez_preth_god'] ?? null, $data['status_lica'] ?? null,
                        $data['jmbg'], $data['sifra_akta'], $data['broj_prijave']
                    ]);
                    $result = ['success' => true, 'action' => 'updated', 'changes' => $stmt->rowCount()];
                } else {
                    $stmt = $db->prepare("
                        INSERT INTO potvrde (
                            sifra_opstine, sifra_akta, broj_prijave, jmbg, vlasnistvo_od, vlasnistvo_do,
                            status_prijave, izvor_podataka, datum_prijave, pib, obveznik, stanuje,
                            adresa_obveznika, adresa_objekta, vrsta_prava, vrsta_nepokretnosti, zona,
                            oporeziva_povrsina, datum_izgradnje_rekonstrukcije, osnovica_preth_god,
                            porez_preth_god, status_lica
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ");
                    $stmt->execute([
                        $data['sifra_opstine'] ?? null, $data['sifra_akta'] ?? null, $data['broj_prijave'] ?? null,
                        $data['jmbg'], $data['vlasnistvo_od'] ?? null, $data['vlasnistvo_do'] ?? null,
                        $data['status_prijave'] ?? null, $data['izvor_podataka'] ?? null, $data['datum_prijave'] ?? null,
                        $data['pib'] ?? null, $data['obveznik'] ?? null, $data['stanuje'] ?? null,
                        $data['adresa_obveznika'] ?? null, $data['adresa_objekta'] ?? null,
                        $data['vrsta_prava'] ?? null, $data['vrsta_nepokretnosti'] ?? null, $data['zona'] ?? null,
                        $data['oporeziva_povrsina'] ?? null, $data['datum_izgradnje_rekonstrukcije'] ?? null,
                        $data['osnovica_preth_god'] ?? null, $data['porez_preth_god'] ?? null, $data['status_lica'] ?? null
                    ]);
                    $result = ['success' => true, 'action' => 'inserted', 'lastInsertId' => $db->lastInsertId()];
                }
            }
            echo json_encode($result, JSON_UNESCAPED_UNICODE);
            break;

        case 'bulkUpsert':
            $dataArray = $params[0] ?? [];
            $mode = $params[1] ?? 'update';
            
            if ($mode === 'replace') {
                $db->exec('DELETE FROM ' . $table);
            }
            
            $inserted = 0;
            $updated = 0;
            $skipped = 0;
            
            $db->beginTransaction();
            
            try {
                if ($table === 'uplatnice') {
                    $insertStmt = $db->prepare('INSERT INTO uplatnice (jmbg, ime_i_prezime, adresa) VALUES (?, ?, ?)');
                    $updateStmt = $db->prepare('UPDATE uplatnice SET ime_i_prezime = ?, adresa = ?, updated_at = CURRENT_TIMESTAMP WHERE jmbg = ?');
                    
                    if ($mode === 'append') {
                        $existingStmt = $db->prepare('SELECT jmbg FROM uplatnice');
                        $existingStmt->execute();
                        $existingJMBGs = array_flip(array_column($existingStmt->fetchAll(PDO::FETCH_ASSOC), 'jmbg'));
                    }
                    
                    foreach ($dataArray as $item) {
                        if ($mode === 'append' && isset($existingJMBGs[$item['jmbg']])) {
                            $skipped++;
                            continue;
                        }
                        
                        $checkStmt = $db->prepare('SELECT * FROM uplatnice WHERE jmbg = ?');
                        $checkStmt->execute([$item['jmbg']]);
                        $existing = $checkStmt->fetch(PDO::FETCH_ASSOC);
                        
                        if ($existing) {
                            $updateStmt->execute([$item['ime_i_prezime'], $item['adresa'] ?? null, $item['jmbg']]);
                            $updated++;
                        } else {
                            $insertStmt->execute([$item['jmbg'], $item['ime_i_prezime'], $item['adresa'] ?? null]);
                            $inserted++;
                        }
                    }
                } else {
                    $insertStmt = $db->prepare("
                        INSERT INTO potvrde (
                            sifra_opstine, sifra_akta, broj_prijave, jmbg, vlasnistvo_od, vlasnistvo_do,
                            status_prijave, izvor_podataka, datum_prijave, pib, obveznik, stanuje,
                            adresa_obveznika, adresa_objekta, vrsta_prava, vrsta_nepokretnosti, zona,
                            oporeziva_povrsina, datum_izgradnje_rekonstrukcije, osnovica_preth_god,
                            porez_preth_god, status_lica
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ");
                    $updateStmt = $db->prepare("
                        UPDATE potvrde SET
                            sifra_opstine = ?, vlasnistvo_od = ?, vlasnistvo_do = ?,
                            status_prijave = ?, izvor_podataka = ?, datum_prijave = ?, pib = ?,
                            obveznik = ?, stanuje = ?, adresa_obveznika = ?, adresa_objekta = ?,
                            vrsta_prava = ?, vrsta_nepokretnosti = ?, zona = ?,
                            oporeziva_povrsina = ?, datum_izgradnje_rekonstrukcije = ?,
                            osnovica_preth_god = ?, porez_preth_god = ?, status_lica = ?,
                            updated_at = CURRENT_TIMESTAMP
                        WHERE jmbg = ? AND sifra_akta = ? AND broj_prijave = ?
                    ");
                    
                    if ($mode === 'append') {
                        $existingStmt = $db->prepare('SELECT jmbg, sifra_akta, broj_prijave FROM potvrde');
                        $existingStmt->execute();
                        $existingKeys = [];
                        foreach ($existingStmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
                            $existingKeys[$row['jmbg'] . '_' . $row['sifra_akta'] . '_' . $row['broj_prijave']] = true;
                        }
                    }
                    
                    foreach ($dataArray as $item) {
                        if ($mode === 'append') {
                            $key = $item['jmbg'] . '_' . $item['sifra_akta'] . '_' . $item['broj_prijave'];
                            if (isset($existingKeys[$key])) {
                                $skipped++;
                                continue;
                            }
                        }
                        
                        $checkStmt = $db->prepare('SELECT * FROM potvrde WHERE jmbg = ? AND sifra_akta = ? AND broj_prijave = ?');
                        $checkStmt->execute([$item['jmbg'], $item['sifra_akta'], $item['broj_prijave']]);
                        $existing = $checkStmt->fetch(PDO::FETCH_ASSOC);
                        
                        if ($existing) {
                            $updateStmt->execute([
                                $item['sifra_opstine'] ?? null, $item['vlasnistvo_od'] ?? null, $item['vlasnistvo_do'] ?? null,
                                $item['status_prijave'] ?? null, $item['izvor_podataka'] ?? null, $item['datum_prijave'] ?? null,
                                $item['pib'] ?? null, $item['obveznik'] ?? null, $item['stanuje'] ?? null,
                                $item['adresa_obveznika'] ?? null, $item['adresa_objekta'] ?? null,
                                $item['vrsta_prava'] ?? null, $item['vrsta_nepokretnosti'] ?? null, $item['zona'] ?? null,
                                $item['oporeziva_povrsina'] ?? null, $item['datum_izgradnje_rekonstrukcije'] ?? null,
                                $item['osnovica_preth_god'] ?? null, $item['porez_preth_god'] ?? null, $item['status_lica'] ?? null,
                                $item['jmbg'], $item['sifra_akta'], $item['broj_prijave']
                            ]);
                            $updated++;
                        } else {
                            $insertStmt->execute([
                                $item['sifra_opstine'] ?? null, $item['sifra_akta'] ?? null, $item['broj_prijave'] ?? null,
                                $item['jmbg'], $item['vlasnistvo_od'] ?? null, $item['vlasnistvo_do'] ?? null,
                                $item['status_prijave'] ?? null, $item['izvor_podataka'] ?? null, $item['datum_prijave'] ?? null,
                                $item['pib'] ?? null, $item['obveznik'] ?? null, $item['stanuje'] ?? null,
                                $item['adresa_obveznika'] ?? null, $item['adresa_objekta'] ?? null,
                                $item['vrsta_prava'] ?? null, $item['vrsta_nepokretnosti'] ?? null, $item['zona'] ?? null,
                                $item['oporeziva_povrsina'] ?? null, $item['datum_izgradnje_rekonstrukcije'] ?? null,
                                $item['osnovica_preth_god'] ?? null, $item['porez_preth_god'] ?? null, $item['status_lica'] ?? null
                            ]);
                            $inserted++;
                        }
                    }
                }
                
                $db->commit();
                $result = ['inserted' => $inserted, 'updated' => $updated, 'skipped' => $skipped, 'total' => count($dataArray)];
                echo json_encode($result, JSON_UNESCAPED_UNICODE);
            } catch (Exception $e) {
                $db->rollBack();
                throw $e;
            }
            break;

        case 'count':
            $stmt = $db->prepare('SELECT COUNT(*) as count FROM ' . $table);
            $stmt->execute();
            $result = $stmt->fetch(PDO::FETCH_ASSOC);
            echo json_encode($result['count'], JSON_UNESCAPED_UNICODE);
            break;

        case 'deleteAll':
            $db->exec('DELETE FROM ' . $table);
            $result = ['success' => true];
            echo json_encode($result, JSON_UNESCAPED_UNICODE);
            break;

        case 'getStats':
            $uplatniceDb = getDb($baseDir . '/resources/uplatnice.db');
            $potvrdeDb = getDb($baseDir . '/resources/potvrde.db');
            
            $stmt = $uplatniceDb->prepare('SELECT COUNT(*) as count FROM uplatnice');
            $stmt->execute();
            $uplatniceCount = $stmt->fetch(PDO::FETCH_ASSOC)['count'];
            
            $stmt = $potvrdeDb->prepare('SELECT COUNT(*) as count FROM potvrde');
            $stmt->execute();
            $potvrdeCount = $stmt->fetch(PDO::FETCH_ASSOC)['count'];
            
            $result = ['uplatnice' => (int)$uplatniceCount, 'potvrde' => (int)$potvrdeCount];
            echo json_encode($result, JSON_UNESCAPED_UNICODE);
            break;

        default:
            http_response_code(400);
            echo json_encode(['error' => 'Invalid action: ' . $action]);
            break;
    }
} catch (Exception $e) {
    http_response_code(500);
    
    // Log error to PHP error log
    error_log("API Error: " . $e->getMessage() . " in " . $e->getFile() . ":" . $e->getLine());
    error_log("Stack trace: " . $e->getTraceAsString());
    
    $errorResponse = [
        'error' => $e->getMessage(),
        'action' => $action ?? 'unknown',
        'table' => $table ?? 'unknown'
    ];
    
    // Add more debug info if debug parameter is present
    if (isset($_GET['debug']) || isset($input['debug'])) {
        $errorResponse['trace'] = $e->getTraceAsString();
        $errorResponse['file'] = $e->getFile();
        $errorResponse['line'] = $e->getLine();
        $errorResponse['path'] = $path ?? 'unknown';
        $errorResponse['pathParts'] = $pathParts ?? [];
        $errorResponse['input'] = $input ?? null;
    }
    
    echo json_encode($errorResponse, JSON_UNESCAPED_UNICODE);
} catch (Error $e) {
    // Catch PHP fatal errors
    http_response_code(500);
    error_log("API Fatal Error: " . $e->getMessage() . " in " . $e->getFile() . ":" . $e->getLine());
    
    $errorResponse = [
        'error' => 'Fatal error: ' . $e->getMessage(),
        'action' => $action ?? 'unknown',
        'table' => $table ?? 'unknown'
    ];
    
    if (isset($_GET['debug']) || isset($input['debug'])) {
        $errorResponse['file'] = $e->getFile();
        $errorResponse['line'] = $e->getLine();
    }
    
    echo json_encode($errorResponse, JSON_UNESCAPED_UNICODE);
}
?>


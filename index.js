require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');
const bodyParser = require('body-parser');
const requestIp = require('request-ip');

const app = express();
const PORT = process.env.PORT || 10000;  // Default to 10000 for Render

// Configure static files with proper MIME types and debugging
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

// Configure EJS and static files
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Serve static files with proper configuration
app.use(express.static(path.join(__dirname, 'public'), {
    maxAge: '1h',
    etag: true,
    lastModified: true,
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('.gif')) {
            res.setHeader('Content-Type', 'image/gif');
        }
        // Enable CORS for static files
        res.setHeader('Access-Control-Allow-Origin', '*');
    }
}));

// Add content type middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(requestIp.mw()); // For accurate IP detection

// Security middleware
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    next();
});

const ADMIN_PASSWORD = process.env.ADMIN_PASS || 'admin123';
const DATA_FILE = 'submissions.txt';

// Enhanced IP detection
function getClientIp(req) {
    // Cloudflare support
    const cfConnectingIp = req.headers['cf-connecting-ip'];
    if (cfConnectingIp) return cfConnectingIp;
    
    // Standard headers
    return req.clientIp || 
           req.headers['x-forwarded-for']?.split(',')[0] || 
           req.connection?.remoteAddress || 
           req.socket?.remoteAddress || 
           req.connection?.socket?.remoteAddress;
}

// Routes
app.get('/', (req, res) => {
    const ip = getClientIp(req);
    res.render('index', { ip: ip });
});

app.post('/submitInstagram', (req, res) => {
    const { instagramId } = req.body;
    const ip = getClientIp(req);
    const userAgent = req.headers['user-agent'];
    const timestamp = new Date().toISOString();
    
    if (!instagramId) {
        return res.status(400).json({ error: 'Instagram ID is required' });
    }

    const entry = {
        timestamp,
        ip,
        instagramId,
        userAgent
    };

    fs.appendFile(DATA_FILE, JSON.stringify(entry) + '\n', (err) => {
        if (err) {
            console.error('Error saving data:', err);
            return res.status(500).json({ error: 'Failed to save data' });
        }
        res.status(200).json({ 
            success: true, 
            ip: ip,  // Include IP in response
            message: `Thanks for submitting! Your IP: ${ip}`
        });
    });
});

// Enhanced admin panel with IP details
app.get('/admin', (req, res) => {
    const password = req.query.password;
    const authenticated = password === ADMIN_PASSWORD;
    
    let entries = [];
    if (authenticated && fs.existsSync(DATA_FILE)) {
        const data = fs.readFileSync(DATA_FILE, 'utf-8');
        entries = data.trim().split('\n')
                     .map(line => JSON.parse(line))
                     .reverse();
    }

    res.render('admin', {
        authenticated,
        entries,
        passwordIncorrect: password && !authenticated
    });
});

// Debug route to check if static files are accessible
app.get('/debug-static', (req, res) => {
    const publicPath = path.join(__dirname, 'public');
    fs.readdir(publicPath, (err, files) => {
        if (err) {
            return res.status(500).json({ error: 'Cannot read public directory', details: err.message });
        }
        res.json({ 
            publicPath,
            files,
            env: process.env.NODE_ENV
        });
    });
});

// Error handling
app.use((err, req, res, next) => {
    console.error(`Error: ${err.message}`);
    console.error(err.stack);
    res.status(500).json({ 
        error: 'Server error', 
        message: process.env.NODE_ENV === 'development' ? err.message : undefined 
    });
});

const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
}).on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} is already in use`);
    } else {
        console.error('Error starting server:', err);
    }
    process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    server.close(() => {
        console.log('Server shutting down');
    });
});
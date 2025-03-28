const express = require('express');
const fs = require('fs');
const path = require('path');
const bodyParser = require('body-parser');
const requestIp = require('request-ip');

const app = express();
const PORT = process.env.PORT || 3000;

// Configure EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(requestIp.mw()); // For accurate IP detection
app.use(express.static(path.join(__dirname, 'public')));

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
    res.render('index', { ip: getClientIp(req) });
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
        res.status(200).json({ success: true });
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

// Error handling
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
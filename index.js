require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const requestIp = require('request-ip');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');

const app = express();
const port = process.env.PORT || 8080;

// Security middleware
app.use(helmet());
app.set('trust proxy', true);

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later'
});
app.use(limiter);

// IP detection middleware
app.use(requestIp.mw({
    attributeName: 'clientIp',
    headerNames: ['x-forwarded-for', 'x-real-ip', 'cf-connecting-ip']
}));

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Static files and body parsing
app.use(express.static('public'));
app.use(express.json());

// Routes
app.get('/', (req, res) => {
    res.render('index');
});

app.get('/getIP', (req, res) => {
    res.json({ ip: req.clientIp });
});

app.post('/submitInstagram', (req, res) => {
    const { instagramId } = req.body;
    
    // Input validation
    if (!instagramId || typeof instagramId !== 'string' || instagramId.length > 30) {
        return res.status(400).json({ success: false, error: 'Invalid Instagram ID' });
    }

    const ip = req.clientIp;
    const date = new Date().toLocaleString();
    const data = `Instagram: ${instagramId} | IP: ${ip} | Date: ${date}\n`;

    fs.appendFile('instagram_ids.txt', data, (err) => {
        if (err) {
            console.error('Failed to save Instagram ID:', err);
            return res.status(500).json({ success: false, error: 'Server error' });
        }
        console.log('New Instagram ID saved:', instagramId);
        res.json({ success: true });
    });
});

app.get('/admin', (req, res) => {
    const password = req.query.password;
    const authenticated = password === process.env.ADMIN_PASSWORD;

    if (authenticated) {
        fs.readFile('instagram_ids.txt', 'utf8', (err, data) => {
            const entries = err ? [] : data.split('\n').filter(line => line.trim());
            res.render('admin', { authenticated, entries });
        });
    } else {
        res.render('admin', { authenticated: false, entries: [] });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
});

// Start server
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
    // Create file if it doesn't exist
    if (!fs.existsSync('instagram_ids.txt')) {
        fs.writeFileSync('instagram_ids.txt', '');
    }
});
const express = require('express');
const path = require('path');
const bcrypt = require('bcrypt');
const admin = require('firebase-admin');
const session = require('express-session');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

let db;
let firebaseError = null;

try {
  const serviceAccount = require('./key.json');
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  db = getFirestore();
  
  // Test the connection silently
  db.collection('test').limit(1).get().then(() => {
    // Firebase is working
  }).catch((error) => {
    firebaseError = error;
  });
  
} catch (e) {
  firebaseError = e;
}

const app = express();
const port = 3000;

const checkFirebase = (req, res, next) => {
  if (firebaseError) {
    return res.status(500).send(`
      <h1>Firebase Configuration Error</h1>
      <p>Your Firebase credentials are invalid. Please check the server console for instructions.</p>
      <p><strong>Error:</strong> ${firebaseError.message}</p>
      <p>Please update your key.json file and restart the server.</p>
    `);
  }
  next();
};

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Session setup with optimized settings
app.use(session({
  secret: 'your_secret_key',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: false,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'home.html'));
});

app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/signup', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'signup.html'));
});

app.post('/signupSubmit', checkFirebase, async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).send('All fields are required.');
  }

  try {
    const existingUser = await db.collection('SignUp-Details')
      .where('Email', '==', email.toLowerCase().trim())
      .limit(1)
      .get();
      
    if (!existingUser.empty) {
      return res.status(400).send('Error: Email already exists. Please use a different email.');
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    await db.collection('SignUp-Details').add({
      Name: name.trim(),
      Email: email.toLowerCase().trim(),
      Password: hashedPassword,
      CreatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    res.send('Sign Up successful! Please log in.');
  } catch (error) {
    if (error.code === 16) {
      firebaseError = error;
      return res.status(500).send(`
        <h1>Firebase Authentication Error</h1>
        <p>Your Firebase credentials are invalid. Please check the server console for instructions.</p>
        <p><strong>Error:</strong> ${error.message}</p>
      `);
    }
    res.status(500).send('An error occurred during signup.');
  }
});

app.post('/loginSubmit', checkFirebase, async (req, res) => {
  const { email, password } = req.body;
  
  if (!email || !password) {
    return res.status(400).send('Email and password are required.');
  }

  try {
    const userSnapshot = await db.collection('SignUp-Details')
      .where('Email', '==', email.toLowerCase().trim())
      .limit(1)
      .get();

    if (userSnapshot.empty) {
      return res.status(400).send('Error: Email not found. Please sign up.');
    }

    const doc = userSnapshot.docs[0];
    const userData = doc.data();
    const passwordMatch = await bcrypt.compare(password, userData.Password);
    
    if (passwordMatch) {
      req.session.user = { 
        email: userData.Email, 
        name: userData.Name,
        userId: doc.id 
      };
      return res.redirect('/weather');
    }

    return res.status(401).send('Error: Incorrect password.');
  } catch (error) {
    if (error.code === 16) {
      firebaseError = error;
      return res.status(500).send(`
        <h1>Firebase Authentication Error</h1>
        <p>Your Firebase credentials are invalid. Please check the server console for instructions.</p>
        <p><strong>Error:</strong> ${error.message}</p>
      `);
    }
    res.status(500).send('An error occurred during login.');
  }
});

app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
});

app.get('/weather', (req, res) => {
  if (!req.session.user) {
    return res.redirect('/login');
  }
  res.sendFile(path.join(__dirname, 'public', 'weather.html'));
});

// Store search history with optimized data structure
app.post('/api/search', checkFirebase, async (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  const { city } = req.body;
  if (!city || typeof city !== 'string') {
    return res.status(400).json({ error: 'Valid city name is required' });
  }

  const cityName = city.trim();
  if (cityName.length === 0) {
    return res.status(400).json({ error: 'City name cannot be empty' });
  }
  
  try {
    await db.collection('WeatherSearchHistory').add({
      Email: req.session.user.email,
      City: cityName,
      Timestamp: admin.firestore.FieldValue.serverTimestamp()
    });
    
    res.json({ success: true });
  } catch (err) {
    if (err.code === 16) {
      firebaseError = err;
      return res.status(500).json({ error: 'Firebase authentication failed. Please check server logs.' });
    }
    res.status(500).json({ error: 'Failed to save search' });
  }
});

// Optimized history retrieval with proper query
app.get('/api/history', checkFirebase, async (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  try {
    const snapshot = await db.collection('WeatherSearchHistory')
      .where('Email', '==', req.session.user.email)
      .orderBy('Timestamp', 'desc')
      .limit(10)
      .get();
    
    const userHistory = snapshot.docs.map(doc => ({
      ...doc.data(),
      id: doc.id
    }));
    
    res.json({ history: userHistory });
  } catch (err) {
    if (err.code === 16) {
      firebaseError = err;
      return res.status(500).json({ error: 'Firebase authentication failed. Please check server logs.' });
    }
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

// Weather API with caching
const weatherCache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

app.get('/api/weather/:city', async (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  const { city } = req.params;
  const apiKey = '0bc2e3c7fe27411f98343947241812';
  
  // Check cache first
  const cacheKey = city.toLowerCase();
  const cached = weatherCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return res.json(cached.data);
  }
  
  try {
    const response = await fetch(`https://api.weatherapi.com/v1/current.json?key=${apiKey}&q=${encodeURIComponent(city)}`);
    const data = await response.json();
    
    if (data.error) {
      return res.status(400).json({ error: data.error.message });
    }
    
    // Cache the result
    weatherCache.set(cacheKey, {
      data,
      timestamp: Date.now()
    });
    
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch weather data' });
  }
});

app.get('/api/user', (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  res.json({ user: req.session.user });
});

// Optimized most recent search with single query
app.get('/api/most-recent-search', checkFirebase, async (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  try {
    const snapshot = await db.collection('WeatherSearchHistory')
      .where('Email', '==', req.session.user.email)
      .orderBy('Timestamp', 'desc')
      .limit(1)
      .get();
    
    if (snapshot.empty) {
      return res.json({ mostRecent: null });
    }
    
    const mostRecent = snapshot.docs[0].data();
    res.json({ mostRecent });
    
  } catch (err) {
    if (err.code === 16) {
      firebaseError = err;
      return res.status(500).json({ error: 'Firebase authentication failed. Please check server logs.' });
    }
    res.status(500).json({ error: 'Failed to fetch most recent search' });
  }
});

// Clean up cache periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of weatherCache.entries()) {
    if (now - value.timestamp > CACHE_DURATION) {
      weatherCache.delete(key);
    }
  }
}, CACHE_DURATION);

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}/`);
});
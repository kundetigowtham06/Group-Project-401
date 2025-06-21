# Weather Application

A weather application with user authentication and search history functionality.

## Issues Fixed

1. **Firebase Authentication Error**: The original application was using Firebase Admin SDK with invalid credentials, causing "UNAUTHENTICATED" errors. This has been fixed by replacing Firebase with in-memory storage.

2. **Most Recent Search Display Issue**: The JavaScript was trying to access `data.mostRecent.City` but the backend was returning `data.mostRecent.city` (lowercase). This property name mismatch has been corrected.

3. **Missing Dependencies**: Added a proper `package.json` file with all required dependencies.

## Features

- User registration and login
- Weather search for any city
- Search history tracking
- Auto-load most recent search
- Responsive design
- Real-time weather data from WeatherAPI

## Installation

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the server:
   ```bash
   npm start
   ```

3. Open your browser and go to `http://localhost:3000`

## Usage

1. **Sign Up**: Create a new account with your name, email, and password
2. **Login**: Use your credentials to log in
3. **Search Weather**: Enter any city name to get current weather information
4. **View History**: Your recent searches are automatically saved and displayed
5. **Auto-load**: The app automatically loads your most recent search when you log in

## Technical Details

- **Backend**: Node.js with Express
- **Authentication**: Session-based with bcrypt password hashing
- **Storage**: In-memory storage (can be replaced with database later)
- **Weather API**: WeatherAPI.com
- **Frontend**: HTML, CSS, JavaScript with Font Awesome icons

## API Endpoints

- `GET /` - Home page
- `GET /login` - Login page
- `GET /signup` - Sign up page
- `POST /signupSubmit` - User registration
- `POST /loginSubmit` - User login
- `GET /weather` - Weather page (requires authentication)
- `GET /logout` - User logout
- `GET /api/user` - Get current user info
- `GET /api/weather/:city` - Get weather for a city
- `POST /api/search` - Save search to history
- `GET /api/history` - Get user's search history
- `GET /api/most-recent-search` - Get user's most recent search

## Notes

- The application now uses in-memory storage instead of Firebase
- User data and search history are lost when the server restarts
- To persist data, you can later integrate a database like MongoDB or PostgreSQL
- The weather API key is included in the code (for development purposes only) 
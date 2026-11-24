# AI Healthcare Chatbot

An AI-assisted healthcare awareness application built with React, Express, MySQL, and Google Gemini. It provides user profile management, JWT-based authentication, symptom chat, emergency keyword detection, doctor suggestions, and general self-care guidance.

> **Medical disclaimer:** This project is a demonstration and educational tool, not a medical diagnosis or treatment system. It does not replace a doctor, emergency services, or professional medical advice. Seek immediate in-person help for severe or worsening symptoms.

## Features

- User registration and login
- JWT authentication with 30-day tokens
- Profile details such as blood group, city, phone number, and critical conditions
- Browser-side session persistence through `localStorage`
- Symptom chat interface
- Gemini API-key or Google service-account OAuth integration
- Automatic local fallback replies when Gemini is unavailable
- Emergency keyword detection with nearby doctor lookup
- Chat and user data stored in MySQL
- Responsive React UI

## Tech Stack

**Frontend**

- React 19
- Vite
- Axios
- Tailwind CSS
- Custom CSS

**Backend**

- Node.js
- Express 5
- MySQL2
- JSON Web Tokens
- Google Gemini Generative Language API
- Google Auth Library

## Project Structure

```text
AI-HEALTHCARE-CHATBOT/
├── client/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── App.css
│   │   ├── index.css
│   │   └── main.jsx
│   ├── public/
│   ├── package.json
│   └── vite.config.js
├── server/
│   ├── index.js
│   ├── db.js
│   └── .env
├── keys/
│   └── gemini-sa.json
├── package.json
└── README.md
```

## Requirements

- Node.js 18 or newer
- npm
- MySQL 8 or a compatible MySQL server
- A Google Gemini API key, or a Google Cloud service-account credential

## Installation

Clone the repository and enter the project directory:

```bash
git clone <your-repository-url>
cd AI-HEALTHCARE-CHATBOT
```

Install backend dependencies:

```bash
npm install
```

Install frontend dependencies:

```bash
cd client
npm install
cd ..
```

## MySQL Setup

Create the database and tables before starting the application.

```sql
CREATE DATABASE IF NOT EXISTS healthcare_chatbot;
USE healthcare_chatbot;

CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  phone VARCHAR(30),
  blood_group VARCHAR(10),
  critical_disease VARCHAR(255),
  disease_since VARCHAR(100),
  city VARCHAR(100),
  consent BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE doctors (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  specialty VARCHAR(100),
  phone VARCHAR(30),
  address VARCHAR(255),
  city VARCHAR(100)
);

CREATE TABLE chat_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  message TEXT NOT NULL,
  reply TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

Optionally add doctor records for emergency recommendations:

```sql
INSERT INTO doctors (name, specialty, phone, address, city)
VALUES ('Dr. Example', 'General Physician', '+91-00000-00000', 'Demo Clinic', 'Bhopal');
```

## Environment Variables

Create or update `server/.env`:

```dotenv
DB_HOST=localhost
DB_USER=your_mysql_user
DB_PASS=your_mysql_password
DB_NAME=healthcare_chatbot

JWT_SECRET=replace_with_a_long_random_secret
PORT=4000

# Set to 1 to try service-account OAuth before the API key
USE_OAUTH=0
GEMINI_MODEL=gemini-2.5-flash

# API-key authentication
GEMINI_API_KEY=your_gemini_api_key

# Service-account authentication
GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/to/gemini-sa.json
```

You only need to configure one Gemini authentication method. To use an API key, set `GEMINI_API_KEY` and set `USE_OAUTH=0`. To use a service account, set `USE_OAUTH=1` and `GOOGLE_APPLICATION_CREDENTIALS`.

Never commit real credentials, API keys, database passwords, JWT secrets, or service-account JSON files. Add these paths to `.gitignore`:

```gitignore
server/.env
keys/
.env
.env.*
node_modules/
client/node_modules/
dist/
```

If a key or credential is already committed or has been exposed, revoke and replace it immediately.

## Running the Application

The backend uses port `4000`, and the Vite frontend uses port `5173`.

Start the backend:

```bash
npm start
```

In a second terminal, start the frontend:

```bash
cd client
npm run dev
```

Open `http://localhost:5173` in a browser.

The Vite development server proxies requests beginning with `/api` to `http://localhost:4000`.

## API Endpoints

All chat and profile endpoints require a bearer token except registration, login, and the ping route.

| Method | Endpoint | Authentication | Description |
| --- | --- | --- | --- |
| `POST` | `/api/register` | No | Create a user and return a JWT |
| `POST` | `/api/login` | No | Look up a user and return a JWT |
| `GET` | `/api/me` | Bearer token | Fetch the authenticated user profile |
| `POST` | `/api/chat` | Bearer token | Submit a symptom or health-awareness message |
| `GET` | `/api/ping` | No | Check server availability |

Example bearer header:

```text
Authorization: Bearer <jwt-token>
```

Example chat request:

```json
{
  "message": "I have a mild headache"
}
```

## Authentication Flow

1. The user registers or logs in.
2. The backend creates a signed JWT.
3. The frontend stores the token in `localStorage`.
4. Axios sends the token through the `Authorization` header.
5. Protected routes verify the token and load the user from MySQL.
6. Logging out removes the token from browser storage.

## Gemini Behavior

The backend supports two Gemini modes:

- **API key:** calls the Generative Language REST API directly.
- **OAuth:** obtains an access token from a Google service account.

When OAuth is enabled, the backend attempts OAuth first and falls back to the API key if OAuth fails. If no external provider is available or returns a result, the server uses an internal local-response function.

The Gemini prompt requests concise, non-prescriptive, educational guidance and instructs the model not to provide doses or prescribing details.

## Emergency Handling

The chat endpoint detects keywords such as:

- Chest pain
- Difficulty breathing
- Severe bleeding
- Severe pain
- Unconsciousness
- Collapse
- No pulse

When detected, the backend immediately returns an emergency-care warning. It attempts to list doctors in the user's city, then falls back to a general list of doctors from the database.

The emergency detector is intentionally not a substitute for clinical triage. It does not identify every emergency and should not be used for real-world decision-making.

## Development Commands

Backend:

```bash
npm start
```

Frontend development server:

```bash
cd client
npm run dev
```

Frontend production build:

```bash
cd client
npm run build
```

Frontend lint:

```bash
cd client
npm run lint
```

Frontend preview:

```bash
cd client
npm run preview
```

## Production Notes

- Replace the fallback JWT secret and require a real `JWT_SECRET`.
- Use environment variables from a secure secrets manager.
- Enable HTTPS.
- Add password authentication or a trusted identity provider before production use.
- Apply rate limits and request-size limits.
- Validate, normalize, and sanitize all user input.
- Restrict CORS origins.
- Replace demo doctor data with a verified, authorized source.
- Avoid storing sensitive medical information unless required and properly secured.
- Add retention, encryption, audit logging, consent, and deletion policies.
- Use a HIPAA/GDPR/privacy review as appropriate for the deployment region.
- Add automated tests for authentication, SQL queries, emergency detection, and chat fallbacks.
- Do not expose database or API errors directly to clients.

## Troubleshooting

**Server cannot connect to MySQL**

- Confirm MySQL is running.
- Check `DB_HOST`, `DB_USER`, `DB_PASS`, and `DB_NAME`.
- Confirm the database and tables exist.
- Ensure the MySQL user has permission to access the database.

**Frontend cannot reach the backend**

- Confirm `npm start` is running on port `4000`.
- Confirm Vite is running on port `5173`.
- Keep frontend API calls relative to `/api` because the Vite proxy forwards them.

**Gemini replies are not returned**

- Confirm `GEMINI_API_KEY` is valid.
- If using OAuth, confirm `GOOGLE_APPLICATION_CREDENTIALS` is an absolute path to a valid JSON credential.
- Confirm `USE_OAUTH` is set to `1` or `true` when OAuth is intended.
- Check backend logs for API or OAuth errors.

**User is not authorized**

- Confirm registration or login returned a token.
- Confirm the frontend has stored and attached the bearer token.
- Confirm `JWT_SECRET` has not changed while tokens are in use.

## License

No license is currently specified. Add a license file if you intend to distribute or reuse this project publicly.
# NeuroNex-AI-Healthcare-Chatbot

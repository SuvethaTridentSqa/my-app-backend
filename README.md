This project is an AI-powered URL shortener that helps users create, customize, secure, and share short links easily.
It also provides analytics, QR code generation, geo-traffic insights, and an AI chatbot for a better user experience.

## Technologies Used

- Node.js
- Express - 5.2.1
- MongoDB with Mongoose - 9.8.1
- Redis - 5.3.2
- JWT (JSON Web Token) - 9.0.2
- bcrypt - 5.1.1
- Axios - 1.19.0
- Cheerio - 1.2.0
- CORS - 2.8.6
- Cookie Parser - 1.4.7
- Dotenv - 17.4.2
- Helmet - 7.0.0
- Express Rate Limit - 7.0.0
- GeoIP Lite - 1.4.10
- QRCode - 1.5.1
- Discord.js - 14.27.0
- Nodemon - 3.1.14 (Development)

## Prerequisites

Before running the project, make sure you have the following installed:

- Node.js (LTS version recommended)
- npm
- MongoDB
- Redis (if Redis is enabled)
- Git

You will also need to configure the required environment variables in a `.env` file.

## Project Structure

```text
project/
├── backend/
│   ├── controllers/    # Handles application logic
│   ├── routes/         # Defines API routes
│   ├── models/         # Database models
│   ├── middleware/     # Backend middleware
│   ├── services/       # Business logic and external services
│   ├── scripts/        # Utility and setup scripts
│   ├── config/         # Configuration files
│   ├── .env            # Environment variables
│   ├── server.js       # Backend server entry point
│   └── package.json    # Backend dependencies and scripts
│
└── README.md           # Project documentation
```

## Installation

### 1. Clone the repository

```bash
git clone <your-repository-url>
cd <project-folder>
```

### 2.Install the dependencies

```bash
npm install
```

## To run the Development Server

```bash
npm run dev
```

## Environment Variables

Create a `.env` file in the backend/project root and add:

```env
PORT=5000
DISABLE_REDIS=true
MONGO_URI=your_mongodb_connection_string
```

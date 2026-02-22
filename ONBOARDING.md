# Onboarding for new dev

## Project overview

This is a simple MVP backend for a messenger/chat service.  
The goal of the current stage is to have a working backend with basic messaging functionality.

Currently, the backend supports creating users (via seed script) and sending / reading messages.

## Current state

Backend MVP is ready

Stack:
- Node.js
- Express
- Prisma (ORM)
- PostgreSQL

Available endpoints:
- GET /health
- GET /messages
- POST /messages

There is a seed script that creates a test user in the database.

## Architecture

Backend:
- Node.js + Express - HTTP API
- Prisma — ORM for database access
- PostgreSQL — main database

Request flow:

Client → Express API → Prisma → PostgreSQL

## Project structure

messenger/backend/
- server.js — Express server, API routes
- db.js — Prisma client initialization
- prisma/schema.prisma — Database schema (User, Message)
- scripts/seed.js — Creates test user in DB
- .env — DATABASE_URL

## Implemented features

- Health check endpoint:  
  GET /health

- Messages API:
  - GET /messages — get message history
  - POST /messages — create new message

- Database schema:
  - User model
  - Message model with relation to User

- Seed script:
  - Creates a test user in database

## How to run locally

1. Start database (via Docker):
   ```bash
   docker compose up -d

2. Install backend dependencies
   ```bash
     cd messenger/backend
   npm install
   
4. Create a file messenger/backend/.env with:
   ```bash
    DATABASE_URL=postgresql://postgres:postgres@localhost:5432/messenger

4. Run migrations
   ```bash
   npx prisma migrate dev

6. Seed test user
   ```bash
    node scripts/seed.js

8. Start backend server
   ```bash
     node server.js

   

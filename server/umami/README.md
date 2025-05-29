# Umami Analytics Setup

This directory contains the configuration for running Umami Analytics alongside the Solo server.

## Setup

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

2. Edit the `.env` file with your settings:
   - Set database credentials
   - Configure domain name
   - Set hash salt
   - Update other environment variables as needed

3. Start the services:
   ```bash
   docker-compose up -d
   ```

4. Access Umami at `https://analytics.yourdomain.com`

5. Default login:
   - Username: admin
   - Password: umami

   Make sure to change these credentials after first login!

## Configuration

The setup includes:
- PostgreSQL database
- Umami analytics server
- Traefik reverse proxy with automatic SSL

## Environment Variables

See `.env.example` for all available configuration options.
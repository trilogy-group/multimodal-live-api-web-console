FROM --platform=linux/amd64 electronuserland/builder:wine

# Install dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    git \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Install global dependencies
RUN npm install -g cross-env

# Copy the application
COPY . .

# Build command will be run from docker-compose or docker run 
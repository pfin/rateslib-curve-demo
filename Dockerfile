# Use Python 3.12 slim image
FROM python:3.12-slim

# Install build dependencies
RUN apt-get update && apt-get install -y \
    curl \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install Rust
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
ENV PATH="/root/.cargo/bin:${PATH}"

# Set working directory
WORKDIR /app

# Copy Python requirements
COPY api/requirements.txt ./api/

# Install Python dependencies including rateslib
RUN pip install --no-cache-dir -r api/requirements.txt

# Copy the rest of the application
COPY . .

# Install Node.js dependencies and build Next.js
RUN apt-get update && apt-get install -y nodejs npm
RUN npm install
RUN npm run build

# Expose port
EXPOSE 3000

# Start the application
CMD ["npm", "start"]
# Multi-stage Docker build for WordPress development
# Optimized for layer caching and fast rebuilds

# =============================================================================
# Stage 1: WP-CLI Builder
# Downloads and verifies WP-CLI in a separate stage for caching
# =============================================================================
FROM alpine:3.19 AS wp-cli-builder

# Install curl for downloading WP-CLI
RUN apk add --no-cache curl

# Download WP-CLI (cached unless WP-CLI version changes)
ARG WP_CLI_VERSION=2.10.0
RUN curl -o /wp-cli.phar -fSL "https://github.com/wp-cli/wp-cli/releases/download/v${WP_CLI_VERSION}/wp-cli-${WP_CLI_VERSION}.phar" \
    && chmod +x /wp-cli.phar

# =============================================================================
# Stage 2: PHP Extensions Builder
# Pre-compiles PHP extensions that rarely change
# =============================================================================
FROM wordpress:php8.3-apache AS php-extensions

# Install build dependencies (cached layer)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libzip-dev \
    libpng-dev \
    libjpeg62-turbo-dev \
    libfreetype6-dev \
    libwebp-dev \
    && rm -rf /var/lib/apt/lists/*

# Configure and install additional PHP extensions (cached layer)
RUN docker-php-ext-configure gd --with-freetype --with-jpeg --with-webp \
    && docker-php-ext-install -j$(nproc) \
    zip \
    exif \
    opcache

# =============================================================================
# Stage 3: Production Image
# Final optimized image with all components
# =============================================================================
FROM wordpress:php8.3-apache AS production

# Labels for image metadata
LABEL maintainer="Flavian WordPress Development"
LABEL description="Optimized WordPress development image with WP-CLI"
LABEL version="1.0.0"

# Copy compiled PHP extensions from builder stage
COPY --from=php-extensions /usr/local/lib/php/extensions/ /usr/local/lib/php/extensions/
COPY --from=php-extensions /usr/local/etc/php/conf.d/ /usr/local/etc/php/conf.d/

# Copy WP-CLI from builder stage
COPY --from=wp-cli-builder /wp-cli.phar /usr/local/bin/wp
RUN chmod +x /usr/local/bin/wp

# Install runtime dependencies only (smaller than build dependencies).
# Note: libzip5 (not libzip4) — the libzip soname bumped to .so.5 in Debian 13
# (trixie), the base of wordpress:php8.3-apache. The other runtime libs kept
# their names across bookworm→trixie.
RUN apt-get update && apt-get install -y --no-install-recommends \
    less \
    mariadb-client \
    libzip5 \
    libpng16-16 \
    libjpeg62-turbo \
    libfreetype6 \
    libwebp7 \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Configure PHP for development (cached layer - rarely changes)
RUN { \
    echo 'upload_max_filesize = 64M'; \
    echo 'post_max_size = 64M'; \
    echo 'max_execution_time = 300'; \
    echo 'memory_limit = 256M'; \
    echo 'opcache.enable = 1'; \
    echo 'opcache.memory_consumption = 128'; \
    echo 'opcache.interned_strings_buffer = 8'; \
    echo 'opcache.max_accelerated_files = 10000'; \
    echo 'opcache.revalidate_freq = 0'; \
    echo 'opcache.validate_timestamps = 1'; \
    } > /usr/local/etc/php/conf.d/wordpress-optimized.ini

# Enable Apache modules (cached layer)
RUN a2enmod rewrite expires headers

# Create WP-CLI config directory
RUN mkdir -p /var/www/.wp-cli/cache \
    && chown -R www-data:www-data /var/www/.wp-cli

# Set working directory
WORKDIR /var/www/html

# Health check for container orchestration
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost/ || exit 1

# Expose port
EXPOSE 80

# Default command (inherited from wordpress base image)
CMD ["apache2-foreground"]

# =============================================================================
# Stage 4: Development Image (optional, for additional dev tools)
# =============================================================================
FROM production AS development

# Install development tools (only in dev image)
RUN apt-get update && apt-get install -y --no-install-recommends \
    vim \
    git \
    unzip \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Install Composer for development
COPY --from=composer:2 /usr/bin/composer /usr/local/bin/composer

# Development-specific PHP configuration
RUN { \
    echo 'display_errors = On'; \
    echo 'display_startup_errors = On'; \
    echo 'error_reporting = E_ALL'; \
    echo 'log_errors = On'; \
    echo 'xdebug.mode = debug,develop'; \
    echo 'xdebug.start_with_request = yes'; \
    echo 'xdebug.client_host = host.docker.internal'; \
    } > /usr/local/etc/php/conf.d/wordpress-development.ini

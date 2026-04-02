#!/bin/bash
# Validate environment variables for security

INSECURE_PATTERNS="changeme|password|admin|root|12345|qwerty"

FOUND=0

if [ ! -f ".env" ]; then
    echo "⚠ No .env file found. Copy .env.example to .env and update values."
    FOUND=1
else
    while IFS='=' read -r key value; do
        # Skip comments and empty lines
        [[ "$key" =~ ^#.*$ || -z "$key" ]] && continue

        # Check password/secret/key fields for insecure values
        if [[ "$key" =~ PASSWORD|SECRET|KEY ]] && echo "$value" | grep -qiE "$INSECURE_PATTERNS"; then
            echo "⚠ WARNING: $key appears to use a default/insecure value"
            FOUND=1
        fi
    done < .env
fi

if [ "$FOUND" -eq 1 ]; then
    echo ""
    echo "⚠ Please update insecure or missing values in .env before starting the environment."
fi
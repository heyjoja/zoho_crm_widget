#!/bin/bash
set -e

echo "🏗️  Building web-component..."
cd web-component
npm run build
cd ../

echo "🧹 Cleaning contacts/app folder..."
rm -rfv contacts/app/*

echo "📦 Copying dist to contacts/app folder..."
cp -rv web-component/dist/* contacts/app/

echo "📦 Packing Zoho widget..."
cd contacts
zet pack
cd ../

echo "✅ Done! Package is ready."
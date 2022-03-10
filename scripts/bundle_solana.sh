#!/bin/sh
node_modules/.bin/esbuild lib/solana/webview.ts --bundle --outfile=lib/solana/webview.cjs --format=iife --global-name=webview --define:global=window

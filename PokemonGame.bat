@echo off
title Pokemon Game Launcher
cd /d "%~dp0"
echo Starting Pokemon Game...
start "" http://localhost:5173
npm run dev

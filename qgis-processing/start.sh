#!/bin/bash
pip install -r requirements.txt
gunicorn --bind 0.0.0.0:$PORT --workers 2 --timeout 120 climate_server:app

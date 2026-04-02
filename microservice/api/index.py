from flask import Flask, jsonify

app = Flask(__name__)

@app.route("/")
def home():
    return jsonify({
        "status": "online",
        "service": "3-phase meter simulator deployment",
        "message": "Note: Vercel standard serverless environments are for HTTP functions. Background tasks and continuous MQTT connections (e.g. while True loops in meter_simulator.py) will encounter Vercel function timeout limits. This API exposes an entrypoint for successful Vercel builds."
    })

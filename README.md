# CryGuard — Smart Baby Cry Detection & Monitoring System

A real-time baby monitoring system that uses an **ESP32** with an **INMP441 MEMS microphone** to detect baby cries using a TensorFlow ML model. It also streams live sensor data (temperature, humidity, motion, light) and provides **real-time audio listening** through a modern React dashboard.

---

## Features

- **AI Cry Detection** — TensorFlow CNN model analyzes audio from ESP32 to detect baby crying
- **Real-Time Audio Listen** — Stream live audio from the baby's room to your browser speaker
- **Sensor Dashboard** — Live temperature, humidity, motion, and light level monitoring
- **WebSocket Communication** — Instant updates with no polling
- **Browser Notifications** — Desktop alerts when crying is detected
- **ESP32 Connection Status** — Live connection indicator

---

## Architecture

```
ESP32 (INMP441 + DHT22 + PIR + LDR)
  │
  ├── HTTP POST /api/audio       → Cry detection (ML model)
  ├── HTTP POST /api/sensor-data → Sensor readings
  └── WebSocket /ws/audio-stream → Real-time audio stream
                │
        ┌───────┴───────┐
        │  FastAPI Backend  │  (Python, port 8080)
        └───────┬───────┘
                │ WebSocket relay
        ┌───────┴───────┐
        │  React Frontend   │  (Vite, port 3000)
        └───────────────┘
```

---

## Project Structure

```
cry-guard/
├── backend/                 # Python FastAPI backend
│   ├── app.py               # Main FastAPI application
│   ├── config.py            # Configuration settings
│   ├── requirements.txt     # Python dependencies
│   ├── train_model.py       # ML model training script
│   ├── models/
│   │   └── baby_cry_model.h5  # Trained TensorFlow model
│   ├── routes/
│   │   ├── audio_routes.py         # POST /api/audio (cry detection)
│   │   ├── sensor_routes.py        # POST/GET /api/sensor-data
│   │   ├── ws_routes.py            # WebSocket /ws (dashboard updates)
│   │   └── audio_stream_routes.py  # WebSocket /ws/audio-stream & /ws/audio-listen
│   ├── services/
│   │   ├── cry_detection_service.py  # TensorFlow inference
│   │   └── state_manager.py         # Central state & broadcasting
│   └── utils/
│       └── audio_processing.py      # Audio preprocessing (librosa)
│
├── frontend/                # React + Vite frontend
│   ├── package.json
│   ├── vite.config.js
│   └── src/
│       ├── App.jsx
│       ├── main.jsx
│       ├── index.css
│       ├── components/
│       │   ├── Header.jsx           # App header + ESP32 status
│       │   ├── CryBanner.jsx        # Cry/Calm status banner
│       │   ├── SensorGrid.jsx       # Sensor cards grid
│       │   ├── ListenButton.jsx     # Real-time audio listen button
│       │   └── NotificationsPanel.jsx  # Cry alert history
│       └── hooks/
│           └── useWebSocket.js      # WebSocket connection hook
│
└── espcode/
    └── espcode.ino          # ESP32 Arduino firmware
```

---

## Prerequisites

| Tool       | Version   | Purpose              |
|------------|-----------|----------------------|
| Python     | 3.11+     | Backend server       |
| Node.js    | 18+       | Frontend dev server  |
| npm        | 9+        | Package manager      |
| Arduino IDE| 2.x       | ESP32 firmware flash |

---

## How to Run

### 1. Clone the Repository

```bash
git clone https://github.com/YOUR_USERNAME/cry-guard.git
cd cry-guard
```

### 2. Backend Setup (Python)

```bash
cd backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
# Windows (PowerShell):
.\venv\Scripts\Activate.ps1
# Windows (CMD):
.\venv\Scripts\activate.bat
# macOS / Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run the backend server
python app.py

---

## MongoDB Setup

The backend requires a MongoDB database (cloud or local). By default, it uses MongoDB Atlas. You must provide a connection string and database name in a `.env` file at the project root.

### 1. Create a `.env` file

Example:
```env
MONGO_URI = mongodb+srv://cry_guard:cryguard123@cluster0.gkabrw1.mongodb.net/?appName=Cluster0
MONGO_DB_NAME = cryguard
```

> **Note:** You can use your own MongoDB Atlas cluster or a local MongoDB instance. Update `MONGO_URI` accordingly.

### 2. Database Collections

- `sensor_data`: Stores all sensor readings (temperature, humidity, motion, light, timestamp)
- `notifications`: Stores cry alert notifications
- `cry_status`: Stores the latest cry detection status
- `esp_status`: Stores ESP32 connection status

Indexes are created automatically on startup for efficient queries.

### 3. MongoDB Dependencies

The backend uses the following packages for MongoDB:

| Package  | Purpose                |
|----------|------------------------|
| motor    | Async MongoDB driver   |
| pymongo  | MongoDB client         |
| certifi  | SSL certificates       |

All are included in `requirements.txt`.

### 4. Test Connection

You can test your MongoDB connection with:
```bash
python mongo_test.py
```

---

## Example .env

```
MONGO_URI = mongodb+srv://<db_username>:<db_password>@cluster0.gkabrw1.mongodb.net/?appName=Cluster0
MONGO_DB_NAME = cryguard
```

---

## Backend Data Flow

- On startup, the backend connects to MongoDB and creates indexes.
- All sensor data, notifications, cry status, and ESP32 status are stored in MongoDB.
- If `MONGO_URI` is missing or invalid, the backend will not start.

---

## Troubleshooting (Extended)

| Issue                           | Solution                                              |
|---------------------------------|-------------------------------------------------------|
| MongoDB connection failed       | Check `.env` for correct `MONGO_URI` and network      |
| MongoDB not running (local)     | Start MongoDB service or use MongoDB Atlas            |
| MONGO_URI is not set            | Ensure `.env` exists and is loaded                    |
| Backend can't load model        | Ensure `models/baby_cry_model.h5` exists              |
| No sensor data on dashboard     | Verify ESP32 `SERVER_HOST` matches your PC's IP       |
| Audio listen not working        | Ensure ESP32 WebSocket library is installed           |
| Port already in use             | Kill existing process or change port in config        |
| TensorFlow import error         | Run `pip install tensorflow` inside venv              |

---
```

The backend will start on **http://localhost:8080**.

**Backend Dependencies (requirements.txt):**

| Package           | Purpose                           |
|-------------------|-----------------------------------|
| fastapi           | Web framework                     |
| uvicorn[standard] | ASGI server                       |
| librosa           | Audio feature extraction          |
| numpy             | Numerical operations              |
| tensorflow        | ML model inference (cry detection)|
| soundfile         | Audio file handling               |
| python-multipart  | File upload support               |
| websockets        | WebSocket support                 |

### 3. Frontend Setup (Node.js)

```bash
cd frontend

# Install dependencies
npm install

# Run the development server
npm run dev
```

The frontend will start on **http://localhost:3000**.

Open your browser and navigate to **http://localhost:3000** to see the dashboard.

### 4. Run Both Together

Open **two terminals**:

**Terminal 1 — Backend:**
```bash
cd backend
.\venv\Scripts\Activate.ps1   # Windows
python app.py
```

**Terminal 2 — Frontend:**
```bash
cd frontend
npm run dev
```

---

## ESP32 Setup

### Required Hardware

| Component    | Description                            |
|-------------|----------------------------------------|
| ESP32       | DevKit V1 (or compatible)              |
| INMP441     | I2S MEMS Microphone                    |
| DHT22       | Temperature & Humidity Sensor          |
| PIR Sensor  | HC-SR501 Motion Sensor                 |
| LDR Module  | Light Dependent Resistor (digital out) |

### Wiring / Pinout

#### INMP441 Microphone (I2S)

| INMP441 Pin | ESP32 Pin | Description        |
|-------------|-----------|-------------------|
| VDD         | 3.3V      | Power supply       |
| GND         | GND       | Ground             |
| L/R         | GND       | Left channel select|
| WS          | GPIO 25   | Word Select (LRCK) |
| SCK         | GPIO 26   | Serial Clock (BCLK)|
| SD          | GPIO 33   | Serial Data (DOUT) |

#### DHT22 Temperature & Humidity Sensor

| DHT22 Pin | ESP32 Pin | Description   |
|-----------|-----------|---------------|
| VCC       | 3.3V      | Power supply  |
| GND       | GND       | Ground        |
| DATA      | GPIO 5    | Data signal   |

#### PIR Motion Sensor (HC-SR501)

| PIR Pin | ESP32 Pin | Description   |
|---------|-----------|---------------|
| VCC     | 5V (VIN)  | Power supply  |
| GND     | GND       | Ground        |
| OUT     | GPIO 18   | Digital output|

#### LDR Light Sensor Module

| LDR Pin | ESP32 Pin | Description     |
|---------|-----------|-----------------|
| VCC     | 3.3V      | Power supply    |
| GND     | GND       | Ground          |
| DO      | GPIO 19   | Digital output  |

### Arduino IDE Setup

#### 1. Install ESP32 Board Support

1. Open Arduino IDE → **File** → **Preferences**
2. Add to **Additional Board Manager URLs**:
   ```
   https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
   ```
3. Go to **Tools** → **Board** → **Boards Manager**
4. Search **"esp32"** and install **"esp32 by Espressif Systems"** (v2.x or v3.x)

#### 2. Install Required Libraries

Open **Sketch** → **Include Library** → **Manage Libraries** and install:

| Library              | Author             | Purpose                          |
|---------------------|--------------------|----------------------------------|
| DHT sensor library  | Adafruit           | DHT22 temperature/humidity       |
| Adafruit Unified Sensor | Adafruit       | Sensor abstraction layer         |
| WebSockets          | Markus Sattler     | WebSocket client for audio stream|

> **Note:** The I2S driver (`driver/i2s.h`) and WiFi/HTTPClient libraries are included with the ESP32 board package — no separate install needed.

#### 3. Configure & Upload

1. Open `espcode/espcode.ino` in Arduino IDE
2. **Update WiFi credentials:**
   ```cpp
   const char* WIFI_SSID     = "YOUR_WIFI_SSID";
   const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";
   ```
3. **Update server IP** (your computer's local IP):
   ```cpp
   const char* SERVER_HOST = "192.168.x.x";  // Run 'ipconfig' to find this
   ```
4. **Board settings:**
   - Board: **ESP32 Dev Module**
   - Upload Speed: **921600**
   - Flash Frequency: **80MHz**
   - Partition Scheme: **Default 4MB with spiffs**
   - Port: Select your ESP32 COM port
5. Click **Upload**

#### 4. Find Your Computer's IP Address

```bash
# Windows
ipconfig

# macOS / Linux
ifconfig
```

Look for the IPv4 address under your WiFi adapter (e.g., `192.168.8.135`).

---

## API Endpoints

### REST API

| Method | Endpoint            | Description                      |
|--------|---------------------|----------------------------------|
| GET    | `/`                 | Health check                     |
| GET    | `/health`           | Health check                     |
| POST   | `/api/audio`        | Send WAV audio for cry detection |
| POST   | `/api/sensor-data`  | Send sensor readings (JSON)      |
| GET    | `/api/sensor-data`  | Get latest sensor data           |
| GET    | `/api/status`       | Get full system status           |

### WebSocket Endpoints

| Endpoint             | Direction          | Description                        |
|----------------------|--------------------|------------------------------------|
| `/ws`                | Server → Browser   | Dashboard updates (sensors, cry)   |
| `/ws/audio-stream`   | ESP32 → Server     | ESP32 sends raw PCM audio          |
| `/ws/audio-listen`   | Server → Browser   | Browser receives live audio stream |

---

## Real-Time Listen Feature

The **Listen to Baby** button on the dashboard enables real-time audio monitoring:

1. **ESP32** captures audio from INMP441 via I2S at 16kHz / 16-bit mono
2. **ESP32** sends raw PCM audio frames over WebSocket to `/ws/audio-stream`
3. **Backend** relays each audio frame to all connected browser listeners via `/ws/audio-listen`
4. **Browser** decodes PCM frames using the Web Audio API and plays through speakers

### Audio Specifications

| Parameter    | Value          |
|-------------|----------------|
| Sample Rate | 16,000 Hz      |
| Bit Depth   | 16-bit signed  |
| Channels    | 1 (Mono)       |
| Format      | Raw PCM (LE)   |
| Frame Size  | 512 samples    |

---

## Troubleshooting

| Issue                           | Solution                                              |
|---------------------------------|-------------------------------------------------------|
| ESP32 not connecting to WiFi    | Check SSID/password, ensure 2.4GHz network            |
| Backend can't load model        | Ensure `models/baby_cry_model.h5` exists               |
| No sensor data on dashboard     | Verify ESP32 `SERVER_HOST` matches your PC's IP       |
| Audio listen not working        | Ensure ESP32 WebSocket library is installed            |
| Port already in use             | Kill existing process or change port in config         |
| TensorFlow import error         | Run `pip install tensorflow` inside venv               |

---

## Tech Stack

| Layer    | Technology                            |
|----------|---------------------------------------|
| Firmware | Arduino C++ (ESP32)                   |
| Backend  | Python, FastAPI, TensorFlow, Librosa  |
| Frontend | React 18, Vite, Lucide Icons          |
| Protocol | HTTP REST, WebSocket                  |
| ML Model | TensorFlow/Keras CNN (.h5)            |

---

## License

MIT License — feel free to use and modify for your projects.
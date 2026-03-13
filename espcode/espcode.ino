#include <WiFi.h>
#include <HTTPClient.h>
#include <WebSocketsClient.h>
#include <driver/i2s.h>
#include <DHT.h>

// ======================== WiFi Config ========================
const char* WIFI_SSID     = "Dialog 4G 018";
const char* WIFI_PASSWORD = "917b765B";

// ======================== Server Config ======================
const char* SERVER_HOST      = "192.168.8.179";  
const int   SERVER_PORT      = 8080;
const char* SENSOR_ENDPOINT  = "/api/sensor-data";
const char* AUDIO_ENDPOINT   = "/api/audio";

// ======================== DHT22 Config =======================
#define DPIN  5
#define DTYPE DHT22
DHT dht(DPIN, DTYPE);

// ======================== PIR & LDR Config ===================
#define PIRPIN 18
#define LDRPIN 19

// ======================== INMP441 I2S Config =================
#define I2S_WS   25
#define I2S_SCK  26
#define I2S_SD   33
#define I2S_PORT I2S_NUM_0

// ======================== Audio Settings =====================
#define SAMPLE_RATE       16000
#define SAMPLE_BITS       16
#define CHANNELS          1
#define I2S_READ_SAMPLES  512
#define I2S_READ_BYTES    (I2S_READ_SAMPLES * (SAMPLE_BITS / 8))
#define AUDIO_SEND_SECONDS 7
#define AUDIO_CHUNK_BYTES (SAMPLE_RATE * (SAMPLE_BITS / 8) * AUDIO_SEND_SECONDS)
#define WAV_HEADER_SIZE   44

// ======================== Validation / Filtering =============
float lastValidTemp = NAN;
float lastValidHum  = NAN;

bool lastValidMotion = false;
bool lastValidLightDark = false;

const float TEMP_MIN = -10.0;
const float TEMP_MAX = 60.0;
const float HUM_MIN  = 0.0;
const float HUM_MAX  = 100.0;

const float ALPHA = 0.3;               // exponential smoothing factor
const int AUDIO_ACTIVITY_THRESHOLD = 4000; // basic sound threshold

// ======================== WebSocket Audio Stream =============
WebSocketsClient webSocket;
bool wsConnected = false;

// ======================== Buffers ============================
int16_t i2sReadBuffer[I2S_READ_SAMPLES];

// Cry detection accumulation buffer (allocated in setup)
uint8_t* cryBuffer = NULL;
int cryBufferOffset = 0;

// ======================== Timing =============================
unsigned long lastSensorSend = 0;
unsigned long sensorInterval = 5000;      // send sensor data every 5s

// ======================== Helpers ============================
bool isValidTemperature(float t) {
  return !isnan(t) && t >= TEMP_MIN && t <= TEMP_MAX;
}

bool isValidHumidity(float h) {
  return !isnan(h) && h >= HUM_MIN && h <= HUM_MAX;
}

float smoothValue(float newValue, float oldValue) {
  if (isnan(oldValue)) return newValue;
  return (ALPHA * newValue) + ((1.0 - ALPHA) * oldValue);
}

int stableDigitalRead(int pin, int samples = 5, int delayMs = 5) {
  int highCount = 0;
  for (int i = 0; i < samples; i++) {
    if (digitalRead(pin) == HIGH) {
      highCount++;
    }
    delay(delayMs);
  }
  return (highCount > samples / 2) ? HIGH : LOW;
}

bool isAudioChunkUseful(int16_t* buffer, size_t sampleCount) {
  long total = 0;
  for (size_t i = 0; i < sampleCount; i++) {
    total += abs(buffer[i]);
  }
  long avg = total / sampleCount;
  return avg > AUDIO_ACTIVITY_THRESHOLD;
}

// ======================== I2S Setup ==========================
void i2sInit() {
  i2s_config_t i2s_config = {
    .mode                 = (i2s_mode_t)(I2S_MODE_MASTER | I2S_MODE_RX),
    .sample_rate          = SAMPLE_RATE,
    .bits_per_sample      = I2S_BITS_PER_SAMPLE_16BIT,
    .channel_format       = I2S_CHANNEL_FMT_ONLY_LEFT,
    .communication_format = I2S_COMM_FORMAT_STAND_I2S,
    .intr_alloc_flags     = ESP_INTR_FLAG_LEVEL1,
    .dma_buf_count        = 8,
    .dma_buf_len          = I2S_READ_SAMPLES,
    .use_apll             = false,
    .tx_desc_auto_clear   = false,
    .fixed_mclk           = 0
  };

  i2s_pin_config_t pin_config = {
    .bck_io_num   = I2S_SCK,
    .ws_io_num    = I2S_WS,
    .data_out_num = I2S_PIN_NO_CHANGE,
    .data_in_num  = I2S_SD
  };

  i2s_driver_install(I2S_PORT, &i2s_config, 0, NULL);
  i2s_set_pin(I2S_PORT, &pin_config);
  i2s_zero_dma_buffer(I2S_PORT);

  Serial.println("[I2S] INMP441 microphone initialized.");
}

// ======================== WAV Header =========================
void writeWavHeader(uint8_t* buffer, int dataSize) {
  int fileSize = dataSize + WAV_HEADER_SIZE - 8;
  int byteRate = SAMPLE_RATE * CHANNELS * (SAMPLE_BITS / 8);
  int blockAlign = CHANNELS * (SAMPLE_BITS / 8);

  buffer[0]='R'; buffer[1]='I'; buffer[2]='F'; buffer[3]='F';
  buffer[4] = fileSize & 0xFF;
  buffer[5] = (fileSize >> 8) & 0xFF;
  buffer[6] = (fileSize >> 16) & 0xFF;
  buffer[7] = (fileSize >> 24) & 0xFF;
  buffer[8]='W'; buffer[9]='A'; buffer[10]='V'; buffer[11]='E';

  buffer[12]='f'; buffer[13]='m'; buffer[14]='t'; buffer[15]=' ';
  buffer[16]=16; buffer[17]=0; buffer[18]=0; buffer[19]=0;
  buffer[20]=1;  buffer[21]=0;
  buffer[22]=CHANNELS; buffer[23]=0;
  buffer[24] = SAMPLE_RATE & 0xFF;
  buffer[25] = (SAMPLE_RATE >> 8) & 0xFF;
  buffer[26] = (SAMPLE_RATE >> 16) & 0xFF;
  buffer[27] = (SAMPLE_RATE >> 24) & 0xFF;
  buffer[28] = byteRate & 0xFF;
  buffer[29] = (byteRate >> 8) & 0xFF;
  buffer[30] = (byteRate >> 16) & 0xFF;
  buffer[31] = (byteRate >> 24) & 0xFF;
  buffer[32] = blockAlign; buffer[33] = 0;
  buffer[34] = SAMPLE_BITS; buffer[35] = 0;

  buffer[36]='d'; buffer[37]='a'; buffer[38]='t'; buffer[39]='a';
  buffer[40] = dataSize & 0xFF;
  buffer[41] = (dataSize >> 8) & 0xFF;
  buffer[42] = (dataSize >> 16) & 0xFF;
  buffer[43] = (dataSize >> 24) & 0xFF;
}

// ======================== WebSocket Events ===================
void webSocketEvent(WStype_t type, uint8_t * payload, size_t length) {
  switch (type) {
    case WStype_DISCONNECTED:
      Serial.println("[WS] Disconnected from audio stream.");
      wsConnected = false;
      break;
    case WStype_CONNECTED:
      Serial.printf("[WS] Connected to audio stream at %s\n", payload);
      wsConnected = true;
      break;
    case WStype_TEXT:
      Serial.printf("[WS] Text: %s\n", payload);
      break;
    case WStype_PING:
    case WStype_PONG:
      break;
    default:
      break;
  }
}

// ======================== WiFi Connect =======================
void connectWiFi() {
  Serial.print("[WiFi] Connecting to ");
  Serial.println(WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int retries = 0;
  while (WiFi.status() != WL_CONNECTED && retries < 30) {
    delay(500);
    Serial.print(".");
    retries++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println();
    Serial.print("[WiFi] Connected! IP: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println();
    Serial.println("[WiFi] Connection FAILED. Will retry in loop.");
  }
}

// ======================== Send Sensor Data ===================
void sendSensorData() {
  float hu = dht.readHumidity();
  float tc = dht.readTemperature();

  int motionRaw = stableDigitalRead(PIRPIN);
  int lightRaw  = stableDigitalRead(LDRPIN);

  bool tempValid = isValidTemperature(tc);
  bool humValid  = isValidHumidity(hu);

  if (!tempValid) {
    Serial.println("[Sensor] Invalid temperature reading.");
    tc = lastValidTemp;
  } else {
    tc = smoothValue(tc, lastValidTemp);
    lastValidTemp = tc;
  }

  if (!humValid) {
    Serial.println("[Sensor] Invalid humidity reading.");
    hu = lastValidHum;
  } else {
    hu = smoothValue(hu, lastValidHum);
    lastValidHum = hu;
  }

  if (isnan(tc) || isnan(hu)) {
    Serial.println("[Sensor] No valid DHT data available yet. Skipping send.");
    return;
  }

  bool motion = (motionRaw == HIGH);
  bool lightDark = (lightRaw == HIGH);

  lastValidMotion = motion;
  lastValidLightDark = lightDark;

  Serial.printf("[Sensor] Temp: %.1f C | Hum: %.1f%% | Motion: %s | Light: %s\n",
                tc, hu,
                motion ? "YES" : "NO",
                lightDark ? "DARK" : "BRIGHT");

  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    String url = String("http://") + SERVER_HOST + ":" + SERVER_PORT + SENSOR_ENDPOINT;
    http.begin(url);
    http.addHeader("Content-Type", "application/json");

    String json = "{";
    json += "\"temperature\":" + String(tc, 1) + ",";
    json += "\"humidity\":" + String(hu, 1) + ",";
    json += "\"motion\":" + String(motion ? "true" : "false") + ",";
    json += "\"light_dark\":" + String(lightDark ? "true" : "false") + ",";
    json += "\"temp_valid\":" + String(tempValid ? "true" : "false") + ",";
    json += "\"hum_valid\":" + String(humValid ? "true" : "false");
    json += "}";

    int httpCode = http.POST(json);
    if (httpCode > 0) {
      Serial.printf("[HTTP] Sensor data sent. Response: %d\n", httpCode);
    } else {
      Serial.printf("[HTTP] Sensor send failed: %s\n", http.errorToString(httpCode).c_str());
    }
    http.end();
  }
}

// ======================== Send Cry Detection Audio ===========
void sendCryDetectionAudio() {
  if (cryBufferOffset < AUDIO_CHUNK_BYTES) return;

  int totalBytes = WAV_HEADER_SIZE + AUDIO_CHUNK_BYTES;
  uint8_t* wavBuffer = (uint8_t*)malloc(totalBytes);
  if (!wavBuffer) {
    Serial.println("[Audio] Failed to allocate WAV send buffer!");
    cryBufferOffset = 0;
    return;
  }

  writeWavHeader(wavBuffer, AUDIO_CHUNK_BYTES);
  memcpy(wavBuffer + WAV_HEADER_SIZE, cryBuffer, AUDIO_CHUNK_BYTES);

  Serial.printf("[Audio] Sending %d bytes for cry detection...\n", totalBytes);

  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    String url = String("http://") + SERVER_HOST + ":" + SERVER_PORT + AUDIO_ENDPOINT;
    http.begin(url);
    http.addHeader("Content-Type", "audio/wav");
    http.setTimeout(10000);

    int httpCode = http.POST(wavBuffer, totalBytes);
    if (httpCode > 0) {
      String response = http.getString();
      Serial.printf("[HTTP] Audio sent. Response(%d): %s\n", httpCode, response.c_str());
    } else {
      Serial.printf("[HTTP] Audio send failed: %s\n", http.errorToString(httpCode).c_str());
    }
    http.end();
  }

  free(wavBuffer);
  cryBufferOffset = 0;
}

// ======================== Setup ==============================
void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("\n========================================");
  Serial.println("   CryGuard ESP32 - Starting Up");
  Serial.println("========================================");

  dht.begin();
  pinMode(PIRPIN, INPUT);
  pinMode(LDRPIN, INPUT);
  Serial.println("[Sensor] DHT22, PIR, LDR initialized.");

  i2sInit();

  cryBuffer = (uint8_t*)malloc(AUDIO_CHUNK_BYTES);
  if (!cryBuffer) {
    Serial.println("[Audio] FATAL: Could not allocate cry detection buffer!");
  } else {
    Serial.printf("[Audio] Cry detection buffer allocated: %d bytes\n", AUDIO_CHUNK_BYTES);
  }
  cryBufferOffset = 0;

  connectWiFi();

  webSocket.begin(SERVER_HOST, SERVER_PORT, "/ws/audio-stream");
  webSocket.onEvent(webSocketEvent);
  webSocket.setReconnectInterval(3000);
  webSocket.enableHeartbeat(15000, 3000, 2);
  Serial.println("[WS] WebSocket audio stream initialized.");

  delay(1000);
  Serial.println("[System] Setup complete. Entering main loop.\n");
}

// ======================== Loop (NON-BLOCKING) ================
void loop() {
  unsigned long now = millis();

  webSocket.loop();

  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[WiFi] Disconnected. Reconnecting...");
    connectWiFi();
    return;
  }

  size_t bytesRead = 0;
  esp_err_t result = i2s_read(
    I2S_PORT,
    i2sReadBuffer,
    I2S_READ_BYTES,
    &bytesRead,
    pdMS_TO_TICKS(20)
  );

  if (result == ESP_OK && bytesRead > 0) {
    size_t samplesRead = bytesRead / sizeof(int16_t);

    if (wsConnected) {
      webSocket.sendBIN((uint8_t*)i2sReadBuffer, bytesRead);
    }

    if (cryBuffer != NULL) {
      if (isAudioChunkUseful(i2sReadBuffer, samplesRead)) {
        int remaining = AUDIO_CHUNK_BYTES - cryBufferOffset;
        int toCopy = (bytesRead < (size_t)remaining) ? bytesRead : remaining;
        memcpy(cryBuffer + cryBufferOffset, i2sReadBuffer, toCopy);
        cryBufferOffset += toCopy;
      } else {
        Serial.println("[Audio] Ignored low-activity audio chunk.");
      }

      if (cryBufferOffset >= AUDIO_CHUNK_BYTES) {
        sendCryDetectionAudio();
      }
    }
  }

  if (now - lastSensorSend >= sensorInterval) {
    lastSensorSend = now;
    sendSensorData();
  }
}
# CryGuard — Team Contribution Breakdown

This document details the division of work among the four team members for the CryGuard project. Each member is responsible for a major subsystem, with tasks distributed for balanced contribution and clear ownership.

| Member | Name & ID                        | Assigned Sensor         | Coding/DB Responsibility (for assigned sensor) |
|--------|-----------------------------------|-------------------------|-----------------------------------------------|
| 1      | Gunathilaka P A S R (IT22136824)  | INMP441 (Microphone)    | Sensor wiring, ESP32 code, backend API, DB for audio sensor |
| 2      | Ranaweera R A D S (IT22884510)    | DHT22 (Temp/Humidity)   | Sensor wiring, ESP32 code, backend API, DB for DHT22 sensor |
| 3      | Himsara P.V.D (IT22367112)        | PIR (Motion)            | Sensor wiring, ESP32 code, backend API, DB for PIR sensor   |
| 4      | Navodya B.G.S. (IT22589590)       | LDR (Light)             | Sensor wiring, ESP32 code, backend API, DB for LDR sensor   |

---




---
## Task Division (per sensor)

Each member is responsible for:
- Wiring and calibrating their assigned sensor
- Writing ESP32 code to read the sensor
- Sending sensor data to backend (HTTP/REST/WebSocket)
- Implementing backend API endpoint for their sensor
- Handling database storage for their sensor's data
- Demonstrating data flow from sensor to storage
- Handling noisy/missing values, sampling frequency, and pin mapping

All members contribute to:
- System integration
- Progress presentation
- Architecture diagram
- Code repository update
- Prototype demonstration
- Demonstrate data flow from sensors to storage endpoint

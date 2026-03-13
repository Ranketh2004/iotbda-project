# Baby Cry Detection Backend

FastAPI backend for receiving and processing audio data to detect baby cries.

## Setup

1. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

2. Place your trained model at `models/baby_cry_model.h5`.

3. Run the server:
   ```bash
   python app.py
   ```
   Or using uvicorn directly:
   ```bash
   uvicorn app:app --host 0.0.0.0 --port 8000 --reload
   ```

## Example Requests

### Health Check

```bash
curl -X GET "http://127.0.0.1:8000/"
```

### Detect Cry (Audio bytes payload)

Assuming you have a `test.wav` file in the same directory:

```bash
curl -X POST "http://127.0.0.1:8000/audio" \
     -H "Content-Type: application/octet-stream" \
     --data-binary @test.wav
```

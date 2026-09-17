from ultralytics import YOLO

# Load your custom trained model
model = YOLO('best.pt')

# --- CHOOSE ONE OPTION ---

# Option 1: Run live webcam detection
#model.predict(source=0, conf=0.5, show=True)

# Option 2: Run detection on an image (uncomment to use)
model.predict(source='test_image.webp', conf=0.15, save=True,show =True)

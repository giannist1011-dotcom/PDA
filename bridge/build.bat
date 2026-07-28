@echo off
rem Build του OrderDeck Print Bridge σε ένα .exe (χωρίς κονσόλα, tray μόνο)
rem Απαιτεί: python + pip install -r requirements.txt pyinstaller
pip install -r requirements.txt pyinstaller
pyinstaller --noconfirm --onefile --windowed --name OrderDeckPrintBridge bridge_app.py
echo.
echo Το εκτελέσιμο βρίσκεται στο dist\OrderDeckPrintBridge.exe
pause

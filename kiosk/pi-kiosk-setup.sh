#!/usr/bin/env bash
set -euo pipefail

URL="${1:-http://localhost:8080}"
USER_NAME="${SUDO_USER:-$(id -un)}"
USER_HOME="$(getent passwd "$USER_NAME" | cut -d: -f6)"

echo "==> Panel URL: $URL"
echo "==> User: $USER_NAME"

echo "==> Installing packages"
apt-get update -qq
apt-get install -y --no-install-recommends chromium-browser unclutter xdotool >/dev/null 2>&1 \
  || apt-get install -y --no-install-recommends chromium unclutter xdotool

CHROME_BIN="$(command -v chromium-browser || command -v chromium)"

echo "==> Writing the launch script"
cat > "$USER_HOME/kiosk.sh" <<EOF
#!/usr/bin/env bash
if [ -n "\${DISPLAY:-}" ]; then
  xset s off || true
  xset -dpms || true
  xset s noblank || true
  unclutter -idle 0.5 -root &
fi

PROFILE="\$HOME/.config/chromium-kiosk"
mkdir -p "\$PROFILE/Default"
sed -i 's/"exit_type":"Crashed"/"exit_type":"Normal"/' "\$PROFILE/Default/Preferences" 2>/dev/null || true

exec $CHROME_BIN \\
  --user-data-dir="\$PROFILE" \\
  --kiosk "$URL" \\
  --noerrdialogs \\
  --disable-infobars \\
  --disable-session-crashed-bubble \\
  --disable-features=TranslateUI,Translate \\
  --disable-pinch \\
  --overscroll-history-navigation=0 \\
  --check-for-update-interval=31536000 \\
  --autoplay-policy=no-user-gesture-required \\
  --start-fullscreen
EOF
chmod +x "$USER_HOME/kiosk.sh"
chown "$USER_NAME":"$USER_NAME" "$USER_HOME/kiosk.sh"

echo "==> Setting up autostart (systemd --user)"
install -d -o "$USER_NAME" -g "$USER_NAME" "$USER_HOME/.config/systemd/user"
cat > "$USER_HOME/.config/systemd/user/kiosk.service" <<EOF
[Unit]
Description=Homebridge Kiosk display
After=graphical-session.target
PartOf=graphical-session.target

[Service]
Type=simple
ExecStart=$USER_HOME/kiosk.sh
Restart=always
RestartSec=5

[Install]
WantedBy=graphical-session.target
EOF
chown -R "$USER_NAME":"$USER_NAME" "$USER_HOME/.config/systemd"

sudo -u "$USER_NAME" XDG_RUNTIME_DIR="/run/user/$(id -u "$USER_NAME")" systemctl --user daemon-reload || true
sudo -u "$USER_NAME" XDG_RUNTIME_DIR="/run/user/$(id -u "$USER_NAME")" systemctl --user enable kiosk.service || true
loginctl enable-linger "$USER_NAME" || true

cat <<'EOT'

==> Done.
   Reboot now:       sudo reboot
   Stop the kiosk:   systemctl --user stop kiosk
   Start the kiosk:  systemctl --user start kiosk

   The dim timeout is set by the panel's own screensaver
   (KIOSK_SCREENSAVER_AFTER in .env).

   To switch the display off entirely (on DSI screens):
     echo 0 | sudo tee /sys/class/backlight/*/brightness
EOT

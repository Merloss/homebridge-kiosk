# Putting it on a wall

The panel is a plain web page, so the screen barely matters. Two common setups
are covered here.

---

## A) Raspberry Pi + touchscreen (most control)

**Hardware**

| Part | Note |
|---|---|
| Raspberry Pi 4 (2 GB) / Pi 5 / Pi Zero 2 W | A Zero 2 W works, but Chromium animations can stutter |
| 7" DSI touchscreen (800×480) or a 10" HDMI IPS | The official 7" panel is plug-and-play |
| USB-C power + a wall mount or frame | The Pi screws onto the back of the screen |

**Setup**

```bash
# On the Pi, pointing at wherever the panel server runs:
sudo bash kiosk/pi-kiosk-setup.sh http://192.168.1.50:8080
sudo reboot
```

The script installs Chromium, writes a `~/kiosk.sh` that starts it fullscreen
(`--kiosk`), hides the mouse cursor (`unclutter`), disables the screensaver and
DPMS, and adds a `systemd --user` service so it starts on boot.

**Backlight / dimming at night**

The panel's own screensaver (the clock screen) is controlled by
`KIOSK_SCREENSAVER_AFTER`. To physically dim the display:

```bash
# DSI screen
echo 30 | sudo tee /sys/class/backlight/*/brightness   # 0-255
# HDMI screen
vcgencmd display_power 0                                # off
vcgencmd display_power 1                                # on
```

Dim at midnight, back up at 07:00:

```bash
crontab -e
0 0 * * * echo 10 | tee /sys/class/backlight/*/brightness
0 7 * * * echo 200 | tee /sys/class/backlight/*/brightness
```

---

## B) An old tablet (Android / iPad)

No extra software: the panel installs as a PWA.

**Android**
1. Open the panel URL in Chrome → menu → **Add to Home screen**.
2. Launch it from the home screen; it opens fullscreen with no browser bar.
3. To lock it down: Settings → *Screen pinning*, then pin the app. For something
   sturdier, use the "Fully Kiosk Browser" app.
4. Settings → Display → *Sleep*: **Never** (keep it awake while charging).

**iPad**
1. Open in Safari → Share → **Add to Home Screen**.
2. Settings → Accessibility → turn on **Guided Access**, then triple-click the
   side button inside the app, and the tablet locks to that screen.
3. Settings → Display & Brightness → Auto-Lock: **Never**.

> Note: iOS does not support `navigator.vibrate`, so there is no haptic
> feedback. Everything else behaves the same.

---

## Networking

The panel and Homebridge need to be on the same LAN. The simplest arrangement is
to run the panel server on the machine Homebridge already runs on (the same Pi,
via Docker for example) and let the tablet or screen just point a browser at it.

If you want access from outside your network, put a reverse proxy
(Traefik/Caddy) in front of it and set `KIOSK_ACCESS_CODE`. Better still, reach
it over a VPN.

# 🚀 Performance Optimization - Quick Start Guide

## For Android/Mobile Users

### First Time Setup (2 minutes)

1. **Open the Optimize Tab**
   - Click ⚡ in the sidebar
   - Wait for device specs to appear

2. **Check Your Device Specs**
   - You'll see: Device Type, CPU Cores, RAM
   - Example: "Android, 8 cores, 12 GB"

3. **Select a Profile**
   - **For 12GB Android Device**: Select "High-End Device"
   - **For 6-8GB Android Device**: Select "Medium Device"  
   - **For 2-4GB Android Device**: Select "Low-End Device"

4. **Review Recommendations**
   - The system suggests safe RAM allocation
   - Allocation range = min to max safe values
   - Green slider shows recommended amount

5. **Click "Apply Optimization"**
   - System saves the settings
   - You'll see a success message

6. **Restart Your Server**
   - Go to Dashboard
   - Click "Restart"
   - Wait for "Online" status

7. **Monitor Performance**
   - Go to Metrics tab
   - Watch TPS (should be 15+)
   - Monitor CPU and RAM usage

---

## Device-Specific Recommendations

### Example: Android Phone with Octa-Core CPU & 12GB RAM

**Settings:**
- Profile: High-End Device
- RAM Allocation: 4000-6000 MB
- Aikar Flags: ✓ Enabled
- Disable Animations: Optional
- Reduce View Distance: Optional

**Expected Performance:**
- TPS: 18-20 (very stable)
- CPU: 25-40% usage
- RAM: 4-5 GB used
- Smoothness: Excellent

### Example: Android Tablet with Quad-Core & 4GB RAM

**Settings:**
- Profile: Medium Device
- RAM Allocation: 1500-2000 MB
- Aikar Flags: ✓ Enabled
- Disable Animations: Optional
- Reduce View Distance: Optional

**Expected Performance:**
- TPS: 15-18 (stable)
- CPU: 35-50% usage
- RAM: 1.5-2 GB used
- Smoothness: Good

### Example: Android Phone with 2GB RAM

**Settings:**
- Profile: Low-End Device
- RAM Allocation: 512-768 MB
- Aikar Flags: ✓ Enabled
- Disable Animations: ✓ Enabled
- Reduce View Distance: ✓ Enabled

**Expected Performance:**
- TPS: 12-15 (acceptable)
- CPU: 50-70% usage
- RAM: 0.5-0.8 GB used
- Smoothness: Fair (playable)

---

## What Each Setting Does

### RAM Allocation
- **More RAM** = Better performance, more players
- **Less RAM** = Lower power usage, better battery
- Slider shows safe min/max for your device

### Aikar Flags
- **Enabled**: ~25% faster garbage collection
- **Disabled**: Standard Java GC (slower)
- Recommendation: Always enable

### Disable Animations
- **Enabled**: Less rendering = faster on weak devices
- **Disabled**: Normal animations
- Best for: Low-end devices

### Reduce View Distance
- **Enabled**: Server doesn't render far chunks
- **Disabled**: Normal view distance
- Best for: Low-end devices + slow networks

---

## How to Monitor

### In-Game
- Use `/tps` command to check server TPS
- Target: 18-20 TPS (stable gameplay)

### HoneyBee Dashboard
- Click 📊 Metrics tab
- Watch the TPS graph in real-time
- Should stay above 15

### Console
- Look for GC (Garbage Collection) messages
- Healthy: One GC every 30-60 seconds
- Unhealthy: Multiple GCs per second

---

## If Performance is Bad

### Try This (In Order)

1. **Reduce RAM Allocation by 25%**
   - Example: 4000 MB → 3000 MB
   - Apply → Restart

2. **Enable "Reduce View Distance"**
   - Switch toggle on
   - Apply → Restart

3. **Enable "Disable Animations"**
   - Switch toggle on
   - Apply → Restart

4. **Check for Other Apps**
   - Close background apps
   - Stop other heavy processes
   - Try again

5. **Switch to Low-End Profile**
   - Select "Low-End Device"
   - Apply → Restart

6. **Check Server Logs**
   - Go to Console
   - Look for error messages
   - Search HoneyBee docs for error

---

## If Performance is Good

### Next Steps

1. **Monitor for 24 Hours**
   - Keep checking Metrics
   - Note average TPS and CPU
   - Check for crashes

2. **Gradually Test**
   - Add more players
   - Run more plugins
   - Monitor performance change

3. **Fine-Tune if Needed**
   - Increase RAM allocation slightly
   - Disable animation settings if not needed
   - Try Medium profile if on High

---

## Common Questions

**Q: Will optimization hurt battery life?**  
A: More efficient settings actually help battery by using less CPU.

**Q: Can I change settings without restarting?**  
A: You must restart server for JVM arguments to take effect.

**Q: How often should I optimize?**  
A: Once after initial setup. Only re-optimize if adding players.

**Q: Can I use my phone for other things while server runs?**  
A: Yes, but server performance will drop. Budget 30-40% CPU for other apps.

**Q: What if device specs are wrong?**  
A: Click "Refresh Specs" button to re-detect.

---

## Safety Notes

⚠️ **Do NOT**:
- Allocate more RAM than recommended
- Run server in full power mode while gaming
- Ignore overheating warnings
- Ignore server crash messages

✅ **DO**:
- Start with recommended settings
- Monitor performance for 1 hour
- Adjust gradually if needed
- Restart server if very laggy
- Keep device cool

---

## Still Need Help?

📖 Read: `PERFORMANCE_OPTIMIZATION.md` (full guide)  
📋 Check: Server console for errors  
🔧 Try: Refresh Specs → Reset to Defaults → Apply again  

---

**That's it!** Your Minecraft server is now optimized for your device. 🎮

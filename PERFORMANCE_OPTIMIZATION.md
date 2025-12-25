# Performance Optimization Guide

## Overview

The HoneyBee Wrapper now includes a comprehensive **Performance Optimization** feature that automatically detects your device specifications (CPU cores, RAM) and provides intelligent recommendations for Minecraft Server performance tuning. This is especially useful for users running servers on Android phones, tablets, and other mobile devices.

## Features

### 1. **Automatic Device Detection**
- **Device Type**: Detects if you're using Android, iOS, or Desktop
- **CPU Cores**: Reads the number of CPU cores available (via `navigator.hardwareConcurrency`)
- **System RAM**: Detects available system memory (via `navigator.deviceMemory` API)
- **Device Memory**: Estimates available JavaScript heap memory

### 2. **Smart RAM Allocation**
The system automatically recommends optimal RAM allocation based on your device:

| Device Type | RAM Available | Min Recommended | Recommended | Max Recommended |
|-------------|---------------|-----------------|-------------|-----------------|
| Low-End (≤2GB) | 512MB - 2GB | 512MB | 768MB | 1GB |
| Medium (2GB - 6GB) | 2GB - 6GB | 1GB | 2GB | 3GB |
| High-End (6GB+) | 6GB+ | 2GB | 4GB | 6GB+ |

### 3. **Optimization Profiles**
Choose from preset profiles or customize your own:

- **Low-End Device**: 512MB - 2GB
  - Automatically enables string deduplication
  - Reduces GC overhead
  - Recommended for Android phones

- **Medium Device**: 2GB - 6GB
  - Balanced performance and memory usage
  - Good for most tablets and older devices

- **High-End Device**: 6GB+
  - Maximum performance
  - Optimal for gaming devices and servers
  - Full Aikar flag support

- **Custom**: Fine-tune all settings manually

### 4. **Advanced JVM Arguments**

#### Aikar Flags (Recommended)
Automatically enables highly optimized JVM flags:
- G1GC garbage collector (best for Minecraft)
- Parallel reference processing
- Optimized GC pause times
- String deduplication
- And more performance improvements

#### Additional Optimizations
- **Disable Animations**: Reduces rendering overhead on low-end devices
- **Reduce View Distance**: Lowers chunk rendering (can be configured server-side too)
- **Heap Size Configuration**: Automatically sets Xms (initial) and Xmx (maximum) heap

## How to Use

### Step 1: Navigate to Optimize Tab
1. Open HoneyBee Wrapper in your browser
2. Click the **⚡ Optimize** tab in the sidebar

### Step 2: Review Device Specs
The system will automatically display:
- Your device type (Android/iOS/Desktop)
- CPU core count
- Available system RAM
- Browser-estimated memory

### Step 3: Choose Optimization Profile
Select one of the profiles:
- **Low-End Device** (for Android phones with limited RAM)
- **Medium Device** (for tablets or older computers)
- **High-End Device** (for powerful devices)
- **Custom** (for manual tuning)

### Step 4: Adjust RAM Allocation
Use the slider or input field to set how much RAM the Minecraft server should use:
- The system provides min/max/recommended ranges
- Recommendation is based on your device specs
- Don't allocate more than 75% of available system RAM

### Step 5: Configure Additional Options
- **Enable Aikar Flags**: Recommended (enabled by default)
- **Disable Animations**: Enable for low-end devices
- **Reduce View Distance**: Enable for better performance on weak devices

### Step 6: Review Generated JVM Arguments
The "Generated JVM Args" section shows exactly what will be applied:
```
-Xmx2048M -Xms1024M -XX:+UseG1GC -XX:+ParallelRefProcEnabled ...
```

### Step 7: Apply Optimization
Click **"Apply Optimization"** button. The settings will be saved.

⚠️ **Important**: Server must be restarted for changes to take effect.

### Step 8: Restart Server
After applying optimization:
1. Go to **Dashboard** tab
2. Click **Restart** button
3. Wait for server to come back online

## Mobile Device Optimization Tips

### For Android Phones (6GB RAM)
1. Select **Medium Device** profile
2. Allocate 2GB - 2.5GB RAM
3. Enable Aikar Flags
4. Optionally enable "Disable Animations"
5. Test and monitor performance

### For Android Tablets (8GB+ RAM)
1. Select **High-End Device** profile
2. Allocate 3GB - 4GB RAM
3. Keep Aikar Flags enabled
4. Monitor TPS in Metrics tab

### For Low-End Android Devices (2GB RAM)
1. Select **Low-End Device** profile
2. Allocate 512MB - 1GB RAM
3. Enable both "Disable Animations" and "Reduce View Distance"
4. Be prepared for lower server performance

## Understanding JVM Arguments

The generated arguments include:

| Argument | Purpose | Example |
|----------|---------|---------|
| `-Xmx` | Maximum heap size | `-Xmx2048M` (2GB max) |
| `-Xms` | Initial heap size | `-Xms1024M` (1GB initial) |
| `-XX:+UseG1GC` | Enable G1 garbage collector | Better for Minecraft |
| `-XX:+ParallelRefProcEnabled` | Parallel reference processing | Faster GC |
| `-XX:MaxGCPauseMillis=200` | Target GC pause time | Lower = smoother gameplay |
| `-XX:+UseStringDeduplication` | Memory optimization | Reduces memory footprint |

## Monitoring Performance

After applying optimization:

1. **Check Console**: Monitor for GC messages
2. **Check Metrics Tab**: 
   - Watch CPU usage (should be stable)
   - Monitor RAM usage (should stay below allocation)
   - Check TPS (should stay above 15)
3. **In-Game**: 
   - Monitor frame rates
   - Check for lag spikes
   - Verify smooth chunk loading

## Reset to Defaults

To reset optimization to recommended defaults:
1. Click **"Reset to Default"** button
2. System will restore recommended settings
3. Restart server to apply

## Refresh Device Specs

If device specs seem incorrect:
1. Click **"Refresh Specs"** button
2. System will re-detect device information
3. Recommendations will update accordingly

## Troubleshooting

### Device specs show "Unknown" or "Detecting..."
- Wait a few seconds for detection to complete
- Try clicking "Refresh Specs" button
- Check browser console for errors

### Optimization not applied
- Ensure you clicked "Apply Optimization" button
- Check that server was restarted
- Verify JVM arguments in Settings tab

### Server crashes after optimization
- Reduce allocated RAM
- Try Medium or Low-End profile
- Check server logs for GC errors

### Server is slow despite optimization
- Monitor CPU and RAM usage
- Check if other processes are consuming resources
- Try reducing view distance further
- Reduce world difficulty or player count

## Advanced Configuration

### Custom JVM Args
1. Select **Custom** optimization profile
2. Manually modify generated arguments
3. Click "Apply Optimization"
4. Restart server

### Monitoring Garbage Collection
Server logs show GC activity like:
```
[17:30:45] [GC Worker Thread#0 (G1 Evacuation Pause)]: ...
```

Lower GC frequency = better performance.

## System Requirements

- **Browser Support**: Modern browser with:
  - `navigator.hardwareConcurrency` (CPU core detection)
  - `navigator.deviceMemory` (RAM detection) - optional
  - `performance.memory` (heap size detection) - optional
- **Server**: Java 11+ (for best G1GC performance)

## Performance Impact

With proper optimization, expect:
- **Smoother gameplay**: More stable TPS
- **Faster chunk loading**: Better GC efficiency
- **Reduced lag spikes**: Optimized pause times
- **Lower CPU usage**: Better thread management
- **Longer uptime**: Fewer server crashes

---

**Last Updated**: December 2025  
**Version**: 1.0 - Performance Optimization Feature

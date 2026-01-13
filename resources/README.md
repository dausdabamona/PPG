# PPG App Resources

This directory contains source assets for the PPG Android application.

## App Icon

The app icon should be a 1024x1024 PNG file with the PPG branding.

### Requirements:
- Format: PNG with transparency
- Size: 1024x1024 pixels (source)
- Safe zone: Keep important content within center 66% for adaptive icons

### Generate Android Icons

Use one of these tools to generate all required Android icon sizes:

1. **Android Studio**: File > New > Image Asset
2. **Online Tool**: https://icon.kitchen/
3. **Command Line**: Use `@aspect-io/icon-generator`

### Icon Sizes Needed:
- mipmap-mdpi: 48x48
- mipmap-hdpi: 72x72
- mipmap-xhdpi: 96x96
- mipmap-xxhdpi: 144x144
- mipmap-xxxhdpi: 192x192

## Splash Screen

The splash screen uses the app's primary color (#1a5f2a) with the icon centered.

### Customization:
Edit `/android/app/src/main/res/values/colors.xml` to change colors:
```xml
<color name="splash_background">#1a5f2a</color>
```

### Splash Image Sizes (if using custom image):
- drawable-port-mdpi: 320x480
- drawable-port-hdpi: 480x800
- drawable-port-xhdpi: 720x1280
- drawable-port-xxhdpi: 960x1600
- drawable-port-xxxhdpi: 1280x1920

## PPG Brand Colors

| Color | Hex | Usage |
|-------|-----|-------|
| Primary Green | #1a5f2a | Main brand color, headers |
| Primary Light | #2d8a3e | Hover states, accents |
| Primary Dark | #0d3d18 | Status bar, dark elements |
| Accent Gold | #ffc107 | Highlights, badges |
| White | #FFFFFF | Text on dark backgrounds |
